using System.Net;
using System.Net.Mail;
using System.Data;
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

    public static string GetAppUrl(IDbConnection? conn = null)
    {
        try
        {
            using var localConn = conn == null ? Database.GetConnection() : null;
            var activeConn = conn ?? localConn!;
            var url = activeConn.QueryFirstOrDefault<string>("SELECT value FROM system_settings WHERE key = 'app_url'");
            if (!string.IsNullOrWhiteSpace(url) && !url.Contains("localhost"))
            {
                return url.TrimEnd('/');
            }

            if (File.Exists("C:/Projects/tunnel_url.txt"))
            {
                var tUrl = File.ReadAllText("C:/Projects/tunnel_url.txt").Trim();
                if (!string.IsNullOrWhiteSpace(tUrl) && tUrl.StartsWith("http"))
                    return tUrl.TrimEnd('/');
            }

            if (!string.IsNullOrWhiteSpace(url))
            {
                return url.TrimEnd('/');
            }
        }
        catch { }

        // Default production domain
        return "https://dev-wms.codeforfun.id.vn";
    }

    public static string GenerateScheduleEmailHtml(string recipientName, string weekStart, IEnumerable<dynamic> shiftsSummary, string announcement, string? appUrl = null)
    {
        var targetUrl = !string.IsNullOrWhiteSpace(appUrl) ? appUrl.TrimEnd('/') : GetAppUrl();
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
        long? taskId = null,
        string? appUrl = null)
    {
        var targetUrl = !string.IsNullOrWhiteSpace(appUrl) ? appUrl.TrimEnd('/') : GetAppUrl();
        var taskUrl = taskId.HasValue && taskId.Value > 0
            ? $"{targetUrl}/tasks?taskId={taskId.Value}"
            : $"{targetUrl}/tasks";

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

    public static string GenerateTaskUpdatedEmailHtml(
        string recipientName,
        string taskTitle,
        string taskType,
        string? description,
        string deadline,
        int totalCp,
        string? location,
        string editorName,
        bool leaderChanged,
        long? taskId = null,
        string? appUrl = null)
    {
        var targetUrl = !string.IsNullOrWhiteSpace(appUrl) ? appUrl.TrimEnd('/') : GetAppUrl();
        var taskUrl = taskId.HasValue && taskId.Value > 0
            ? $"{targetUrl}/tasks?taskId={taskId.Value}"
            : $"{targetUrl}/tasks";

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

        var badgeText = leaderChanged ? "Phân công nhiệm vụ" : "Cập nhật nhiệm vụ";
        var headerTitle = leaderChanged ? "GIAO QUYỀN PHỤ TRÁCH NHIỆM VỤ" : "THÔNG TIN NHIỆM VỤ ĐÃ ĐƯỢC CẬP NHẬT";
        var infoText = leaderChanged
            ? $"Bạn vừa được <strong>{WebUtility.HtmlEncode(editorName)}</strong> chỉ định làm <strong>Trưởng nhóm phụ trách (Leader)</strong> cho nhiệm vụ này trên hệ thống."
            : $"Nhiệm vụ <strong>{WebUtility.HtmlEncode(taskTitle)}</strong> do bạn phụ trách vừa được <strong>{WebUtility.HtmlEncode(editorName)}</strong> chỉnh sửa và cập nhật lại thông tin.";

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
                    <span class=""badge"">{badgeText}</span>
                    <h2 style=""margin:0; font-size: 21px; color: #ffffff; font-weight: 700;"">{headerTitle}</h2>
                    <p style=""margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; color: #dbeafe;"">Hệ thống Điều phối Công việc Work Management</p>
                </div>
                <div class=""content"">
                    <p style=""font-size: 15px; color: #1e293b; margin-top: 0;"">Xin chào <strong>{WebUtility.HtmlEncode(recipientName)}</strong>,</p>
                    <div class=""info-box"">
                        {infoText}
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
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">👤 Người cập nhật:</td>
                            <td style=""padding: 10px 12px; color: #334155; font-weight: 600;"">{WebUtility.HtmlEncode(editorName)}</td>
                        </tr>
                    </table>

                    {descHtml}

                    <div style=""text-align: center; margin-top: 26px;"">
                        <a href=""{taskUrl}"" class=""btn"">Xem Chi Tiết & Phân Rã Checklist</a>
                    </div>
                </div>
                <div class=""footer"">
                    Hệ thống Phân ca & Quản lý Công việc Nội bộ WorkShiftPro.<br/>
                    Email này được gửi tự động khi có điều chỉnh hoặc cập nhật nhiệm vụ. Vui lòng không trả lời trực tiếp email này.
                </div>
            </div>
        </body>
        </html>";
    }

    public static string GenerateTaskEditorConfirmationEmailHtml(
        string editorName,
        string leaderName,
        string? leaderEmail,
        string taskTitle,
        string taskType,
        string? description,
        string deadline,
        int totalCp,
        string? location,
        long? taskId = null,
        string? appUrl = null)
    {
        var targetUrl = !string.IsNullOrWhiteSpace(appUrl) ? appUrl.TrimEnd('/') : GetAppUrl();
        var taskUrl = taskId.HasValue && taskId.Value > 0
            ? $"{targetUrl}/tasks?taskId={taskId.Value}"
            : $"{targetUrl}/tasks";

        var descHtml = !string.IsNullOrWhiteSpace(description)
            ? $@"<div style=""background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; margin-top: 15px; font-size: 14px; color: #334155; line-height: 1.6;"">
                    <strong style=""color: #0f172a;"">📋 Mô tả / Yêu cầu chi tiết đã lưu:</strong><br/>
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
                .header {{ background: linear-gradient(135deg, #0f172a, #334155); color: white; padding: 28px 24px; text-align: center; }}
                .badge {{ display: inline-block; background: rgba(59,130,246,0.3); border: 1px solid rgba(147,197,253,0.4); padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: #93c5fd; }}
                .content {{ padding: 28px 24px; }}
                .info-box {{ background: #f0fdf4; border-left: 4px solid #10b981; padding: 14px 16px; border-radius: 6px; margin-bottom: 20px; color: #166534; font-size: 14px; line-height: 1.5; }}
                table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; background: #fafafa; border-radius: 8px; overflow: hidden; border: 1px solid #f1f5f9; }}
                .footer {{ background: #f8fafc; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; line-height: 1.5; }}
                .btn {{ display: inline-block; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(15,23,42,0.3); }}
            </style>
        </head>
        <body>
            <div class=""container"">
                <div class=""header"">
                    <span class=""badge"">Xác nhận cập nhật nhiệm vụ</span>
                    <h2 style=""margin:0; font-size: 21px; color: #ffffff; font-weight: 700;"">BẠN ĐÃ CẬP NHẬT NHIỆM VỤ THÀNH CÔNG</h2>
                    <p style=""margin: 6px 0 0 0; opacity: 0.85; font-size: 13px; color: #cbd5e1;"">Thông báo xác nhận dành cho Người thực hiện chỉnh sửa</p>
                </div>
                <div class=""content"">
                    <p style=""font-size: 15px; color: #1e293b; margin-top: 0;"">Xin chào <strong>{WebUtility.HtmlEncode(editorName)}</strong>,</p>
                    <div class=""info-box"">
                        Bạn vừa hoàn tất chỉnh sửa thông tin nhiệm vụ lớn <strong>{WebUtility.HtmlEncode(taskTitle)}</strong> được giao cho <strong>{WebUtility.HtmlEncode(leaderName)}</strong>. Dưới đây là thông tin chi tiết đã lưu:
                    </div>
                    
                    <table>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500; width: 140px;"">📌 Tiêu đề nhiệm vụ:</td>
                            <td style=""padding: 10px 12px; color: #0f172a; font-weight: 700; font-size: 15px;"">{WebUtility.HtmlEncode(taskTitle)}</td>
                        </tr>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">👤 Phụ trách (Leader):</td>
                            <td style=""padding: 10px 12px; color: #2563eb; font-weight: 700;"">{WebUtility.HtmlEncode(leaderName)} {(!string.IsNullOrWhiteSpace(leaderEmail) ? $"({WebUtility.HtmlEncode(leaderEmail)})" : "")}</td>
                        </tr>
                        <tr style=""border-bottom: 1px solid #f1f5f9;"">
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">🏷️ Phân loại:</td>
                            <td style=""padding: 10px 12px; color: #334155; font-weight: 600;"">{WebUtility.HtmlEncode(taskType)}</td>
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
                            <td style=""padding: 10px 12px; color: #64748b; font-weight: 500;"">🕒 Thời gian lưu:</td>
                            <td style=""padding: 10px 12px; color: #64748b;"">{DateTime.UtcNow.AddHours(7):dd/MM/yyyy HH:mm}</td>
                        </tr>
                    </table>

                    {descHtml}

                    <div style=""text-align: center; margin-top: 26px;"">
                        <a href=""{taskUrl}"" class=""btn"">Mở Chi Tiết Nhiệm Vụ Trên Hệ Thống</a>
                    </div>
                </div>
                <div class=""footer"">
                    Hệ thống Phân ca & Quản lý Công việc Nội bộ WorkShiftPro.<br/>
                    Email này được gửi đến bạn để xác nhận thao tác cập nhật nhiệm vụ thành công.
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
        long? taskId = null,
        string? appUrl = null)
    {
        var targetUrl = !string.IsNullOrWhiteSpace(appUrl) ? appUrl.TrimEnd('/') : GetAppUrl();
        var taskUrl = taskId.HasValue && taskId.Value > 0
            ? $"{targetUrl}/tasks?taskId={taskId.Value}"
            : $"{targetUrl}/tasks";

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
        long taskId,
        long leaderId,
        string taskTitle,
        string? taskType,
        string? description,
        string deadline,
        int totalCp,
        string? location,
        string creatorName,
        long? creatorId = null)
    {
        _ = Task.Run(() =>
        {
            try
            {
                using var conn = Database.GetConnection();
                var leader = conn.QueryFirstOrDefault<dynamic>(
                    "SELECT full_name, email FROM users WHERE id = @id", new { id = leaderId });

                if (leader == null)
                {
                    conn.Execute(
                        "INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status) VALUES ('chua_xac_dinh', 'Leader', @s, 'Không tìm thấy tài khoản Leader được phân công.', 'failed')",
                        new { s = $"[WorkShiftPro] Phân công phụ trách nhiệm vụ: {taskTitle}" });
                    return;
                }
                string email = leader.email ?? "";
                string fullName = leader.full_name ?? "";

                var appUrl = GetAppUrl(conn);

                if (!string.IsNullOrWhiteSpace(email) && email.Contains('@'))
                {
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
                        taskId,
                        appUrl);

                    SendRealEmail(email, fullName, subject, html);
                }
                else
                {
                    conn.Execute(
                        "INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status) VALUES (@e, @n, @s, @b, 'failed')",
                        new {
                            e = string.IsNullOrWhiteSpace(email) ? "chua_co_email" : email,
                            n = fullName,
                            s = $"[WorkShiftPro] Phân công phụ trách nhiệm vụ: {taskTitle}",
                            b = $"Không thể gửi email vì tài khoản {fullName} chưa được cấu hình địa chỉ Email hợp lệ."
                        });
                }

                // Gửi email xác nhận cho Creator khi tạo nhiệm vụ giao cho người khác
                if (creatorId.HasValue && creatorId.Value != leaderId)
                {
                    var creator = conn.QueryFirstOrDefault<dynamic>(
                        "SELECT full_name, email FROM users WHERE id = @id", new { id = creatorId.Value });
                    string cEmail = creator?.email ?? "";
                    string cName = creator?.full_name ?? creatorName;
                    if (!string.IsNullOrWhiteSpace(cEmail) && cEmail.Contains('@'))
                    {
                        var cSubject = $"[WorkShiftPro] Xác nhận khởi tạo nhiệm vụ: {taskTitle} (Phụ trách: {fullName})";
                        var cHtml = GenerateTaskEditorConfirmationEmailHtml(
                            cName,
                            fullName,
                            email,
                            taskTitle,
                            taskType ?? "RESEARCH",
                            description,
                            deadline,
                            totalCp,
                            location,
                            taskId,
                            appUrl);
                        SendRealEmail(cEmail, cName, cSubject, cHtml);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EmailService] Lỗi gửi email giao task cho leader {leaderId}: {ex.Message}");
            }
        });
    }

    public static void SendTaskUpdatedNotification(
        long taskId,
        long leaderId,
        long editorId,
        string taskTitle,
        string? taskType,
        string? description,
        string deadline,
        int totalCp,
        string? location,
        string editorName,
        bool leaderChanged = false)
    {
        _ = Task.Run(() =>
        {
            try
            {
                using var conn = Database.GetConnection();
                var appUrl = GetAppUrl(conn);

                // 1. Lấy thông tin Leader (người được giao nhiệm vụ)
                var leader = conn.QueryFirstOrDefault<dynamic>(
                    "SELECT full_name, email FROM users WHERE id = @id", new { id = leaderId });
                string leaderName = leader?.full_name ?? "Trưởng nhóm";
                string leaderEmail = leader?.email ?? "";

                // 2. Lấy thông tin Editor (người thực hiện chỉnh sửa / Admin)
                var editor = conn.QueryFirstOrDefault<dynamic>(
                    "SELECT full_name, email FROM users WHERE id = @id", new { id = editorId });
                string resolvedEditorName = !string.IsNullOrWhiteSpace(editorName) ? editorName : (editor?.full_name ?? "Quản trị viên");
                string editorEmail = editor?.email ?? "";

                // Gửi email cho Leader phụ trách nhiệm vụ
                if (!string.IsNullOrWhiteSpace(leaderEmail) && leaderEmail.Contains('@'))
                {
                    var subject = leaderChanged
                        ? $"[WorkShiftPro] Phân công phụ trách nhiệm vụ: {taskTitle}"
                        : $"[WorkShiftPro] Cập nhật thông tin nhiệm vụ: {taskTitle}";
                    var html = GenerateTaskUpdatedEmailHtml(
                        leaderName,
                        taskTitle,
                        taskType ?? "RESEARCH",
                        description,
                        deadline,
                        totalCp,
                        location,
                        resolvedEditorName,
                        leaderChanged,
                        taskId,
                        appUrl);
                    SendRealEmail(leaderEmail, leaderName, subject, html);
                }
                else
                {
                    conn.Execute(
                        "INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status) VALUES (@e, @n, @s, @b, 'failed')",
                        new {
                            e = string.IsNullOrWhiteSpace(leaderEmail) ? "chua_co_email" : leaderEmail,
                            n = leaderName,
                            s = $"[WorkShiftPro] Cập nhật nhiệm vụ: {taskTitle}",
                            b = $"Không thể gửi email vì tài khoản {leaderName} chưa được cấu hình địa chỉ Email hợp lệ."
                        });
                }

                // 3. Gửi email xác nhận cho người chỉnh sửa ("trong phần chỉnh sửa lớn khi tôi chỉnh sửa xong cho người khác cũng sẽ gửi mail cho tôi")
                if (editorId != leaderId)
                {
                    if (!string.IsNullOrWhiteSpace(editorEmail) && editorEmail.Contains('@'))
                    {
                        var editorSubject = $"[WorkShiftPro] Xác nhận cập nhật nhiệm vụ: {taskTitle} (Phụ trách: {leaderName})";
                        var editorHtml = GenerateTaskEditorConfirmationEmailHtml(
                            resolvedEditorName,
                            leaderName,
                            leaderEmail,
                            taskTitle,
                            taskType ?? "RESEARCH",
                            description,
                            deadline,
                            totalCp,
                            location,
                            taskId,
                            appUrl);
                        SendRealEmail(editorEmail, resolvedEditorName, editorSubject, editorHtml);
                    }
                    else
                    {
                        conn.Execute(
                            "INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status) VALUES (@e, @n, @s, @b, 'failed')",
                            new {
                                e = string.IsNullOrWhiteSpace(editorEmail) ? "chua_co_email" : editorEmail,
                                n = resolvedEditorName,
                                s = $"[WorkShiftPro] Xác nhận cập nhật nhiệm vụ: {taskTitle}",
                                b = $"Không thể gửi email xác nhận cho người chỉnh sửa ({resolvedEditorName}) vì tài khoản chưa có địa chỉ Email hợp lệ."
                            });
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EmailService] Lỗi gửi email cập nhật task {taskId}: {ex.Message}");
            }
        });
    }

    public static void SendSubtaskAssignedNotification(
        long taskId,
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
                var appUrl = GetAppUrl(conn);

                var userIds = assigneeList.Select(a => a.userId).Distinct().ToList();
                string idsStr = string.Join(",", userIds);
                var users = conn.Query<dynamic>(
                    $"SELECT id, full_name, email FROM users WHERE id IN ({idsStr})").ToDictionary(u => Convert.ToInt64(u.id));

                foreach (var (userId, pct) in assigneeList)
                {
                    if (!users.TryGetValue(userId, out var user)) continue;
                    string email = user.email ?? "";
                    string fullName = user.full_name ?? "";

                    if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
                    {
                        conn.Execute(
                            "INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status) VALUES (@e, @n, @s, @b, 'failed')",
                            new {
                                e = string.IsNullOrWhiteSpace(email) ? "chua_co_email" : email,
                                n = fullName,
                                s = $"[WorkShiftPro] Giao mục việc mới: {subtaskTitle}",
                                b = $"Không thể gửi email vì tài khoản {fullName} chưa được cấu hình địa chỉ Email hợp lệ."
                            });
                        continue;
                    }

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
                        taskId,
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

    public static void SendSubtaskCommentNotification(
        long taskId,
        long subtaskId,
        string subtaskTitle,
        string taskTitle,
        long senderUserId,
        string senderName,
        string commentContent,
        long? leaderId,
        IEnumerable<long> assigneeIds)
    {
        _ = Task.Run(() =>
        {
            try
            {
                using var conn = Database.GetConnection();
                var appUrl = GetAppUrl(conn);

                var recipientIds = new List<long>();
                if (leaderId.HasValue && leaderId.Value != senderUserId)
                {
                    recipientIds.Add(leaderId.Value);
                }
                foreach (var aId in assigneeIds)
                {
                    if (aId != senderUserId && !recipientIds.Contains(aId))
                    {
                        recipientIds.Add(aId);
                    }
                }

                if (!recipientIds.Any()) return;

                string idsStr = string.Join(",", recipientIds);
                var users = conn.Query<dynamic>($"SELECT id, full_name, email FROM users WHERE id IN ({idsStr})");

                foreach (var u in users)
                {
                    string email = u.email ?? "";
                    string fullName = u.full_name ?? "";
                    if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) continue;

                    var subject = $"[WorkShiftPro] Trao đổi mới trong mục việc: {subtaskTitle}";
                    var taskLink = $"{appUrl}/#tasks?taskId={taskId}";
                    var html = $@"
                    <div style=""font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;"">
                        <h2 style=""color: #2563eb; margin-top: 0;"">💬 Trao Đổi Mới Trong Mục Việc</h2>
                        <p>Xin chào <strong>{fullName}</strong>,</p>
                        <p><strong>{senderName}</strong> vừa gửi trao đổi trong mục việc: <strong>{subtaskTitle}</strong> (thuộc nhiệm vụ: <em>{taskTitle}</em>):</p>
                        <div style=""background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px; font-style: italic; color: #1e293b;"">
                            ""{WebUtility.HtmlEncode(commentContent)}""
                        </div>
                        <p style=""margin-top: 20px;"">
                            <a href=""{taskLink}"" style=""background: #2563eb; color: #ffffff; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;"">
                                👉 Xem Chi Tiết & Phản Hồi
                            </a>
                        </p>
                        <hr style=""margin-top: 24px; border: none; border-top: 1px solid #e2e8f0;"" />
                        <p style=""font-size: 11px; color: #94a3b8;"">Kênh trao đổi riêng tư giữa Người phụ trách nhiệm vụ và Người thực hiện mục việc.</p>
                    </div>";

                    SendRealEmail(email, fullName, subject, html);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EmailService] Lỗi gửi email trao đổi subtask: {ex.Message}");
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
