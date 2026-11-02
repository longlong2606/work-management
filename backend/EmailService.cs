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

    public static string GenerateScheduleEmailHtml(string recipientName, string weekStart, IEnumerable<dynamic> shiftsSummary, string announcement, string? appUrl = null)
    {
        var targetUrl = !string.IsNullOrWhiteSpace(appUrl) ? appUrl.TrimEnd('/') : "http://localhost:5173";
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
                        <a href=""{targetUrl}"" class=""btn"">Vào Hệ Thống Xác Nhận Ca</a>
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

    public static string GenerateTaskAssignedEmailHtml(
        string recipientName,
        string taskTitle,
        string taskType,
        string? description,
        string deadline,
        int totalCp,
        string? location,
        string creatorName,
        string? appUrl = null)
    {
        var targetUrl = !string.IsNullOrWhiteSpace(appUrl) ? appUrl.TrimEnd('/') : "http://localhost:5173";
        var taskUrl = $"{targetUrl}/tasks";

        var descHtml = !string.IsNullOrWhiteSpace(description)
            ? $@"<div style=""background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; margin-top: 15px; font-size: 14px; color: #334155; line-height: 1.6;"">
                    <strong style=""color: #0f172a;"">📋 Mô tả / Yêu cầu chi tiết:</strong><br/>
                    {WebUtility.HtmlEncode(description).Replace("\n", "<br/>")}
                 </div>"
            : "";

        var locationHtml = !string.IsNullOrWhiteSpace(location)
            ? $@"<tr style=""border-bottom: 1px solid #f1f5f9;"">
                    <td style=""padding: 10px 12px; color: #64748b; font-weight: 500; width: 140px;"">📍 Địa điểm/Đối tác:</td>
                    <td style=""padding: 10px 12px; color: #1e293b; font-weight: 600;"">{WebUtility.HtmlEncode(location)}</td>
                 </tr>"
            : "";

        return $@"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=""utf-8"">
            <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }}
                .header {{ background: linear-gradient(135deg, #1e3a8a, #2563eb); color: white; padding: 28px 24px; text-align: center; }}
                .badge {{ display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }}
                .content {{ padding: 28px 24px; }}
                .info-box {{ background: #eff6ff; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px; color: #1e40af; font-size: 14px; line-height: 1.5; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; background: #fafafa; border-radius: 8px; overflow: hidden; border: 1px solid #f1f5f9; }}
                .footer {{ background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; line-height: 1.5; }}
                .btn {{ display: inline-block; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(37,99,235,0.3); }}
            </style>
        </head>
        <body>
            <div class=""container"">
                <div class=""header"">
                    <span class=""badge"">Phân công nhiệm vụ</span>
                    <h2 style=""margin:0; font-size: 21px; color: #ffffff; font-weight: 700;"">GIAO QUYỀN PHỤ TRÁCH NHIỆM VỤ</h2>
                    <p style=""margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; color: #dbeafe;"">Hệ thống Điều phối Công việc Work Management</p>
                </div>
                <div class=""content"">
                    <p style=""font-size: 15px; color: #1e293b; margin-top: 0;"">Xin chào <strong>{WebUtility.HtmlEncode(recipientName)}</strong>,</p>
                    <div class=""info-box"">
                        Bạn vừa được <strong>{WebUtility.HtmlEncode(creatorName)}</strong> chỉ định làm <strong>Trưởng nhóm phụ trách (Leader)</strong> cho nhiệm vụ mới trên hệ thống.
                    </div>
                    
                    <table>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500; width: 140px;"">📌 Tiêu đề nhiệm vụ:</td>
                            <td style=""padding: 10px 12px; color: #0f172a; font-weight: 700; font-size: 15px;"">{WebUtility.HtmlEncode(taskTitle)}</td>
                        </tr>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">🏷️ Phân loại:</td>
                            <td style=""padding: 10px 12px; color: #2563eb; font-weight: 600;"">{WebUtility.HtmlEncode(taskType)}</td>
                        </tr>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">⏰ Hạn chót (Deadline):</td>
                            <td style=""padding: 10px 12px; color: #dc2626; font-weight: 700;"">{WebUtility.HtmlEncode(deadline)}</td>
                        </tr>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">🏆 Quỹ điểm CP:</td>
                            <td style=""padding: 10px 12px; color: #d97706; font-weight: 700;"">+{totalCp} CP</td>
                        </tr>
                        {locationHtml}
                        <tr>
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">👤 Người khởi tạo:</td>
                            <td style=""padding: 10px 12px; color: #334155; font-weight: 600;"">{WebUtility.HtmlEncode(creatorName)}</td>
                        </tr>
                    </table>

                    {descHtml}

                    <div style=""text-align: center; margin-top: 26px;"">
                        <a href=""{taskUrl}"" class=""btn"">Xem Chi Tiết & Phân Rã Checklist</a>
                    </div>
                </div>
                <div class=""footer"">
                    Hệ thống Phân ca & Quản lý Công việc Nội bộ WorkShiftPro.<br/>
                    Email này được gửi tự động khi có phân công nhiệm vụ mới. Vui lòng không trả lời trực tiếp email này.
                </div>
            </div>
        </body>
        </html>";
    }

    public static string GenerateSubtaskAssignedEmailHtml(
        string recipientName,
        string subtaskTitle,
        string parentTaskTitle,
        string? description,
        string dueAt,
        int cpPoints,
        int contributionPct,
        string creatorName,
        string? appUrl = null)
    {
        var targetUrl = !string.IsNullOrWhiteSpace(appUrl) ? appUrl.TrimEnd('/') : "http://localhost:5173";
        var taskUrl = $"{targetUrl}/tasks";

        var descHtml = !string.IsNullOrWhiteSpace(description)
            ? $@"<div style=""background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; margin-top: 15px; font-size: 14px; color: #334155; line-height: 1.6;"">
                    <strong style=""color: #0f172a;"">📝 Ghi chú / Hướng dẫn:</strong><br/>
                    {WebUtility.HtmlEncode(description).Replace("\n", "<br/>")}
                 </div>"
            : "";

        return $@"
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset=""utf-8"">
            <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
            <style>
                body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; }}
                .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }}
                .header {{ background: linear-gradient(135deg, #059669, #0d9488); color: white; padding: 28px 24px; text-align: center; }}
                .badge {{ display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }}
                .content {{ padding: 28px 24px; }}
                .info-box {{ background: #ecfdf5; border-left: 4px solid #10b981; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px; color: #065f46; font-size: 14px; line-height: 1.5; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; background: #fafafa; border-radius: 8px; overflow: hidden; border: 1px solid #f1f5f9; }}
                .footer {{ background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; line-height: 1.5; }}
                .btn {{ display: inline-block; background: linear-gradient(135deg, #059669, #047857); color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(5,150,105,0.3); }}
            </style>
        </head>
        <body>
            <div class=""container"">
                <div class=""header"">
                    <span class=""badge"">Phân công mục việc</span>
                    <h2 style=""margin:0; font-size: 21px; color: #ffffff; font-weight: 700;"">BẠN ĐƯỢC GIAO MỤC VIỆC MỚI</h2>
                    <p style=""margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; color: #ccfbf1;"">Hệ thống Điều phối Công việc Work Management</p>
                </div>
                <div class=""content"">
                    <p style=""font-size: 15px; color: #1e293b; margin-top: 0;"">Xin chào <strong>{WebUtility.HtmlEncode(recipientName)}</strong>,</p>
                    <div class=""info-box"">
                        Bạn vừa được <strong>{WebUtility.HtmlEncode(creatorName)}</strong> giao phụ trách một mục việc (checklist item) mới. Vui lòng kiểm tra và xác nhận tiếp nhận việc trên hệ thống.
                    </div>
                    
                    <table>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500; width: 140px;"">📌 Mục việc checklist:</td>
                            <td style=""padding: 10px 12px; color: #0f172a; font-weight: 700; font-size: 15px;"">{WebUtility.HtmlEncode(subtaskTitle)}</td>
                        </tr>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">📂 Nhiệm vụ cha:</td>
                            <td style=""padding: 10px 12px; color: #0284c7; font-weight: 600;"">{WebUtility.HtmlEncode(parentTaskTitle)}</td>
                        </tr>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">⏰ Hạn hoàn thành:</td>
                            <td style=""padding: 10px 12px; color: #dc2626; font-weight: 700;"">{WebUtility.HtmlEncode(dueAt)}</td>
                        </tr>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">🏆 Điểm thưởng CP:</td>
                            <td style=""padding: 10px 12px; color: #d97706; font-weight: 700;"">+{cpPoints} CP ({contributionPct}% đóng góp)</td>
                        </tr>
                        <tr>
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">👤 Người giao việc:</td>
                            <td style=""padding: 10px 12px; color: #334155; font-weight: 600;"">{WebUtility.HtmlEncode(creatorName)}</td>
                        </tr>
                    </table>

                    {descHtml}

                    <div style=""text-align: center; margin-top: 26px;"">
                        <a href=""{taskUrl}"" class=""btn"">Vào Tiếp Nhận & Thực Hiện Mục Việc</a>
                    </div>
                </div>
                <div class=""footer"">
                    Hệ thống Phân ca & Quản lý Công việc Nội bộ WorkShiftPro.<br/>
                    Email này được gửi tự động khi có mục việc được giao. Vui lòng không trả lời trực tiếp email này.
                </div>
            </div>
        </body>
        </html>";
    }

    public static void SendTaskAssignedNotification(
        long leaderId,
        string taskTitle,
        string? taskType,
        string? description,
        string deadline,
        int totalCp,
        string? location,
        string creatorName)
    {
        _ = Task.Run(() =>
        {
            try
            {
                using var conn = Database.GetConnection();
                var leader = conn.QueryFirstOrDefault<dynamic>(
                    "SELECT full_name, email FROM users WHERE id = @id", new { id = leaderId });

                if (leader == null) return;
                string email = leader.email ?? "";
                string fullName = leader.full_name ?? "";

                if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return;

                var appUrl = conn.QueryFirstOrDefault<string>(
                    "SELECT value FROM system_settings WHERE key = 'app_url'") ?? "http://localhost:5173";

                var subject = $"[WorkShiftPro] Phân công phụ trách nhiệm vụ: {taskTitle}";
                var html = GenerateTaskAssignedEmailHtml(
                    fullName,
                    taskTitle,
                    taskType ?? "RESEARCH",
                    description,
                    deadline,
                    totalCp,
                    location,
                    creatorName,
                    appUrl);

                SendRealEmail(email, fullName, subject, html);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EmailService] Lỗi gửi email giao task cho leader {leaderId}: {ex.Message}");
            }
        });
    }

    public static void SendSubtaskAssignedNotification(
        IEnumerable<(long userId, int contributionPct)> assignees,
        string subtaskTitle,
        string parentTaskTitle,
        string? description,
        string dueAt,
        int cpPoints,
        string creatorName)
    {
        var assigneeList = assignees.ToList();
        if (!assigneeList.Any()) return;

        _ = Task.Run(() =>
        {
            try
            {
                using var conn = Database.GetConnection();
                var appUrl = conn.QueryFirstOrDefault<string>(
                    "SELECT value FROM system_settings WHERE key = 'app_url'") ?? "http://localhost:5173";

                var userIds = assigneeList.Select(a => a.userId).Distinct().ToList();
                string idsStr = string.Join(",", userIds);
                var users = conn.Query<dynamic>(
                    $"SELECT id, full_name, email FROM users WHERE id IN ({idsStr})").ToDictionary(u => Convert.ToInt64(u.id));

                foreach (var (userId, pct) in assigneeList)
                {
                    if (!users.TryGetValue(userId, out var user)) continue;
                    string email = user.email ?? "";
                    string fullName = user.full_name ?? "";

                    if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) continue;

                    var subject = $"[WorkShiftPro] Giao mục việc mới: {subtaskTitle}";
                    var html = GenerateSubtaskAssignedEmailHtml(
                        fullName,
                        subtaskTitle,
                        parentTaskTitle,
                        description,
                        dueAt,
                        cpPoints,
                        pct,
                        creatorName,
                        appUrl);

                    SendRealEmail(email, fullName, subject, html);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EmailService] Lỗi gửi email giao subtask: {ex.Message}");
            }
        });
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
