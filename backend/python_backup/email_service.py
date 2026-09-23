import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from database import get_db_connection

def get_smtp_config():
    conn = get_db_connection()
    rows = conn.execute("SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%'").fetchall()
    conn.close()
    
    config = {r["key"]: r["value"] for r in rows}
    
    # Fallback to os.environ if empty
    host = config.get("smtp_host") or os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(config.get("smtp_port") or os.getenv("SMTP_PORT", "587"))
    user = config.get("smtp_user") or os.getenv("SMTP_USER", "")
    password = config.get("smtp_password") or os.getenv("SMTP_PASSWORD", "")
    from_name = config.get("smtp_from_name") or os.getenv("SMTP_FROM_NAME", "Hệ Thống Phân Ca WorkShiftPro")
    
    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password.replace(" ", ""), # Remove spaces in Google App Password
        "from_name": from_name
    }

def generate_schedule_email_html(recipient_name: str, week_start: str, shifts_summary: list, announcement: str) -> str:
    rows_html = ""
    if shifts_summary:
        for item in shifts_summary:
            rows_html += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; font-weight: 600; color: #1e293b;">{item.get('work_date', '')}</td>
                <td style="padding: 12px; color: #0284c7; font-weight: bold;">{item.get('shift_name', '')}</td>
                <td style="padding: 12px; color: #475569;">{item.get('time_range', '')}</td>
                <td style="padding: 12px; color: #16a34a; font-weight: 500;">{item.get('status', 'Đã xếp lịch')}</td>
            </tr>
            """
    else:
        rows_html = """
        <tr>
            <td colspan="4" style="padding: 16px; text-align: center; color: #64748b;">
                Tuần này bạn chưa có ca làm việc nào được phân công hoặc đang cập nhật bổ sung.
            </td>
        </tr>
        """

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
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
        <div class="container">
            <div class="header">
                <h2 style="margin:0; font-size: 20px; color: #ffffff;">THÔNG BÁO LỊCH LÀM VIỆC TUẦN</h2>
                <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px; color: #e0e7ff;">Tuần bắt đầu từ: {week_start}</p>
            </div>
            <div class="content">
                <p>Xin chào <strong>{recipient_name}</strong>,</p>
                <div class="announcement">
                    <strong>Thông báo từ Quản lý:</strong><br/>
                    {announcement}
                </div>
                <p>Dưới đây là chi tiết các ca làm việc của bạn theo timeline chuẩn (6 ca/ngày):</p>
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
                        {rows_html}
                    </tbody>
                </table>
                <div style="text-align: center;">
                    <a href="http://localhost:5174" class="btn">Vào Hệ Thống Xác Nhận Ca</a>
                </div>
            </div>
            <div class="footer">
                Hệ thống Quản lý Ca làm việc & Đăng ký Lịch trực nội bộ WorkShiftPro.<br/>
                Vui lòng không phản hồi trực tiếp qua email tự động này.
            </div>
        </div>
    </body>
    </html>
    """

def send_real_email(recipient_email: str, recipient_name: str, subject: str, html_body: str):
    config = get_smtp_config()
    sender_email = config["user"]
    sender_password = config["password"]
    host = config["host"]
    port = config["port"]
    from_name = config["from_name"]
    
    if not sender_email or not sender_password:
        # Save as unsent in logs
        conn = get_db_connection()
        conn.execute("""
        INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status)
        VALUES (?, ?, ?, ?, 'missing_config')
        """, (recipient_email, recipient_name, subject, html_body))
        conn.commit()
        conn.close()
        return {
            "success": False,
            "status": "missing_config",
            "error": "Chưa điền Email hoặc Mật khẩu ứng dụng SMTP trong phần Cài đặt Email."
        }
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{sender_email}>"
        msg["To"] = recipient_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()
            
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()
        
        # Log to database
        conn = get_db_connection()
        conn.execute("""
        INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status)
        VALUES (?, ?, ?, ?, 'sent')
        """, (recipient_email, recipient_name, subject, html_body))
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "status": "sent",
            "message": f"Đã gửi email thật thành công đến {recipient_email}"
        }
    except smtplib.SMTPAuthenticationError as e:
        error_detail = "Sai tên đăng nhập hoặc Mật khẩu ứng dụng (App Password) của Gmail."
        conn = get_db_connection()
        conn.execute("""
        INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status)
        VALUES (?, ?, ?, ?, 'auth_error')
        """, (recipient_email, recipient_name, subject, html_body))
        conn.commit()
        conn.close()
        return {"success": False, "status": "auth_error", "error": error_detail}
    except Exception as e:
        error_detail = str(e)
        conn = get_db_connection()
        conn.execute("""
        INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status)
        VALUES (?, ?, ?, ?, 'failed')
        """, (recipient_email, recipient_name, subject, html_body))
        conn.commit()
        conn.close()
        return {"success": False, "status": "failed", "error": error_detail}

def send_schedule_email(recipient_email: str, recipient_name: str, week_start: str, shifts_summary: list, announcement: str):
    subject = f"[WorkShiftPro] Lịch Làm Việc Tuần Mới ({week_start})"
    html_body = generate_schedule_email_html(recipient_name, week_start, shifts_summary, announcement)
    return send_real_email(recipient_email, recipient_name, subject, html_body)
