using System.Net;
using System.Net.Mail;
using Dapper;

namespace WorkManagement.Api;

public static class EmailService
{
    public static (string host, int port, string user, string password, string fromName) GetSmtpConfig()
    {
        using var conn = Database.GetConnection();
        var rows = conn.Query<(string key, string value)>("SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%'");
        var dict = rows.ToDictionary(r => r.key, r => r.value ?? "");

        var host = dict.GetValueOrDefault("smtp_host", "smtp.gmail.com");
        if (string.IsNullOrEmpty(host)) host = "smtp.gmail.com";
        var portStr = dict.GetValueOrDefault("smtp_port", "587");
        int.TryParse(portStr, out var port);
        if (port <= 0) port = 587;

        var user = dict.GetValueOrDefault("smtp_user", "");
        var password = dict.GetValueOrDefault("smtp_password", "").Replace(" ", "");
        var fromName = dict.GetValueOrDefault("smtp_from_name", "Hệ Thống Phân Ca WorkShiftPro");

        return (host, port, user, password, fromName);
    }

    public static string GenerateScheduleEmailHtml(string recipientName, string weekStart, IEnumerable<dynamic> shiftsSummary, string announcement)
    {
        var rowsHtml = "";
        var hasShifts = false;

        foreach (var item in shiftsSummary)
        {
            hasShifts = true;
            rowsHtml += $@"
            <tr style=""border-bottom: 1px solid #e2e8f0;"">
                <td style=""padding: 12px; font-weight: 600; color: #1e293b;"">{item.work_date}</td>
                <td style=""padding: 12px; color: #0284c7; font-weight: bold;"">{item.shift_name}</td>
                <td style=""padding: 12px; color: #475569;"">{item.time_range}</td>
                <td style=""padding: 12px; color: #16a34a; font-weight: 500;"">{item.status ?? "Đã xếp lịch"}</td>
            </tr>";
        }

        if (!hasShifts)
        {
            rowsHtml = @"
            <tr>
                <td colspan=""4"" style=""padding: 16px; text-align: center; color: #64748b;"">
                    Tuần này bạn chưa có ca làm việc nào được phân công hoặc đang cập nhật bổ sung.
                </td>
            </tr>";
        }

        return $@"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=""utf-8"">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }}
                .header {{ background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 24px; text-align: center; }}
                .content {{ padding: 24px; }}
                .announcement {{ background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px; color: #1e40af; font-size: 14px; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }}
                th {{ background: #f1f5f9; padding: 12px; text-align: left; color: #475569; font-weight: 600; }}
                .footer {{ background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
                .btn {{ display: inline-block; background: #2563eb; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class=""container"">
                <div class=""header"">
                    <h2 style=""margin:0; font-size: 20px; color: #ffffff;"">THÔNG BÁO LỊCH LÀM VIỆC TUẦN</h2>
                    <p style=""margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; color: #e0e7ff;"">Tuần bắt đầu từ: {weekStart}</p>
                </div>
                <div class=""content"">
                    <p>Xin chào <strong>{recipientName}</strong>,</p>
                    <div class=""announcement"">
                        <strong>Thông báo từ Quản lý:</strong><br/>
                        {announcement}
                    </div>
                    <p>Dưới đây là chi tiết các ca làm việc của bạn theo timeline chuẩn (9 ca/ngày từ 08:00 đến 22:00):</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Ngày làm</th>
                                <th>Ca</th>
                                <th>Khung giờ</th>
                                <th>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rowsHtml}
                        </tbody>
                    </table>
                    <div style=""text-align: center;"">
                        <a href=""http://localhost:5173"" class=""btn"">Vào Hệ Thống Xác Nhận Ca</a>
                    </div>
                </div>
                <div class=""footer"">
                    Hệ thống Quản lý Ca làm việc & Đăng ký Lịch trực nội bộ WorkShiftPro.<br/>
                    Vui lòng không phản hồi trực tiếp qua email tự động này.
                </div>
            </div>
        </body>
        </html>";
    }

    public static (bool success, string status, string? error) SendRealEmail(string recipientEmail, string recipientName, string subject, string htmlBody)
    {
        var (host, port, user, password, fromName) = GetSmtpConfig();

        if (string.IsNullOrEmpty(user) || string.IsNullOrEmpty(password))
        {
            using var conn = Database.GetConnection();
            conn.Execute(
                "INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status) VALUES (@e, @n, @s, @b, 'simulated')",
                new { e = recipientEmail, n = recipientName, s = subject, b = htmlBody });

            return (false, "simulated", "Chưa điền Email hoặc Mật khẩu ứng dụng SMTP. Đã lưu thư vào Hòm Thư Đi (Outbox).");
        }

        try
        {
           using var client = new SmtpClient(host, port)
                {
                    UseDefaultCredentials = false,
                    Credentials = new NetworkCredential(user, password),
                    EnableSsl = true,
                    Timeout = 30000
                };

            var mail = new MailMessage
            {
                From = new MailAddress(user, fromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            mail.To.Add(recipientEmail);

            client.Send(mail);

            using var conn = Database.GetConnection();
            conn.Execute(
                "INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status) VALUES (@e, @n, @s, @b, 'sent')",
                new { e = recipientEmail, n = recipientName, s = subject, b = htmlBody });

            return (true, "sent", null);
        }
        catch (Exception ex)
        {
            using var conn = Database.GetConnection();
            conn.Execute(
                "INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status) VALUES (@e, @n, @s, @b, 'simulated')",
                new { e = recipientEmail, n = recipientName, s = subject, b = htmlBody });

            return (false, "simulated", $"Máy chủ SMTP từ chối xác thực ({ex.Message}). Đã lưu thư vào Hòm Thư Đi (Outbox).");
        }
    }
}
