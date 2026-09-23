from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import sqlite3

from database import get_db_connection, init_db, hash_password
from constants import DEFAULT_SHIFTS
from models import (
    LoginRequest, CreateUserRequest, ShiftRegistrationRequest,
    PublishScheduleRequest, CreateShiftNoteRequest, UpdateShiftNoteStatusRequest,
    CreateFeedbackRequest, ReplyFeedbackRequest, CreateNotificationRequest, SmtpSettingsRequest, TestEmailRequest
)
from auth import create_token, get_current_user, require_admin
from email_service import send_schedule_email, send_real_email, get_smtp_config

app = FastAPI(title="Work Management System API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def root():
    return {
        "system": "Work Management System",
        "status": "online",
        "shifts_count": len(DEFAULT_SHIFTS)
    }

# ================= AUTHENTICATION =================
@app.post("/api/auth/login")
def login(req: LoginRequest):
    conn = get_db_connection()
    pw_hash = hash_password(req.password)
    user = conn.execute(
        "SELECT id, username, full_name, email, phone, role, department, status FROM users WHERE username = ? AND password_hash = ?",
        (req.username, pw_hash)
    ).fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=400, detail="Tên đăng nhập hoặc mật khẩu không chính xác")
        
    if user["status"] != "active":
        raise HTTPException(status_code=403, detail="Tài khoản này đã bị khóa")

    token = create_token(user["id"], user["username"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": dict(user)
    }

@app.get("/api/auth/me")
def get_profile(current_user: dict = Depends(get_current_user)):
    return current_user

# ================= USER MANAGEMENT (ADMIN) =================
@app.get("/api/users")
def list_users(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    users = conn.execute("SELECT id, username, full_name, email, phone, role, department, status, created_at FROM users ORDER BY id ASC").fetchall()
    conn.close()
    return [dict(u) for u in users]

@app.post("/api/users")
def create_user(req: CreateUserRequest, admin: dict = Depends(require_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check duplicate
    existing = cursor.execute("SELECT id FROM users WHERE username = ?", (req.username,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Tên tài khoản '{req.username}' đã tồn tại")
        
    pw_hash = hash_password(req.password)
    cursor.execute("""
    INSERT INTO users (username, password_hash, full_name, email, phone, role, department)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (req.username, pw_hash, req.full_name, req.email, req.phone, req.role, req.department))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {"message": "Tạo tài khoản thành công", "user_id": new_id}

# ================= SHIFTS & SCHEDULE =================
@app.get("/api/shifts/templates")
def get_shift_templates():
    return DEFAULT_SHIFTS

@app.get("/api/shifts/schedule")
def get_schedule(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db_connection()
    query = """
    SELECT sr.id, sr.user_id, sr.shift_id, sr.work_date, sr.status, sr.note,
           u.full_name, u.username, u.email, u.phone,
           st.name as shift_name, st.start_time, st.end_time, st.label as shift_label
    FROM shift_registrations sr
    JOIN users u ON sr.user_id = u.id
    JOIN shift_templates st ON sr.shift_id = st.id
    WHERE sr.work_date >= ? AND sr.work_date <= ?
    ORDER BY sr.work_date ASC, sr.shift_id ASC
    """
    rows = conn.execute(query, (start_date, end_date)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/shifts/register")
def register_shift(req: ShiftRegistrationRequest, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if already registered
    existing = cursor.execute(
        "SELECT id FROM shift_registrations WHERE user_id = ? AND shift_id = ? AND work_date = ?",
        (current_user["id"], req.shift_id, req.work_date)
    ).fetchone()
    
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Bạn đã đăng ký ca làm này rồi!")

    cursor.execute("""
    INSERT INTO shift_registrations (user_id, shift_id, work_date, note, status)
    VALUES (?, ?, ?, ?, 'registered')
    """, (current_user["id"], req.shift_id, req.work_date, req.note))
    
    reg_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"message": "Đăng ký ca làm thành công", "registration_id": reg_id}

@app.delete("/api/shifts/register")
def cancel_registration(
    shift_id: int = Query(...),
    work_date: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "DELETE FROM shift_registrations WHERE user_id = ? AND shift_id = ? AND work_date = ?",
        (current_user["id"], shift_id, work_date)
    )
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    if affected == 0:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch đăng ký để hủy")
        
    return {"message": "Đã hủy đăng ký ca làm"}

@app.post("/api/shifts/publish")
def publish_schedule(req: PublishScheduleRequest, admin: dict = Depends(require_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Tạo thông báo chung cho toàn bộ nhân viên trên app
    title = f"Lịch làm việc tuần mới đã được xuất bản!"
    cursor.execute("""
    INSERT INTO notifications (target_user_id, sender_id, title, message, type)
    VALUES (0, ?, ?, ?, 'schedule_published')
    """, (admin["id"], title, req.announcement))
    
    email_tasks = []
    if req.send_email:
        # Lấy danh sách nhân viên có lịch làm trong tuần
        users = cursor.execute("SELECT id, full_name, email FROM users WHERE role = 'staff' AND email != ''").fetchall()
        for u in users:
            shifts = cursor.execute("""
            SELECT sr.work_date, st.name as shift_name, st.label as time_range, sr.status
            FROM shift_registrations sr
            JOIN shift_templates st ON sr.shift_id = st.id
            WHERE sr.user_id = ? AND sr.work_date >= ?
            ORDER BY sr.work_date ASC, sr.shift_id ASC
            """, (u["id"], req.week_start)).fetchall()
            
            shifts_summary = [dict(s) for s in shifts]
            email_tasks.append((u["email"], u["full_name"], shifts_summary))

    conn.commit()
    conn.close()

    emails_sent = 0
    for recipient_email, recipient_name, shifts_summary in email_tasks:
        send_schedule_email(recipient_email, recipient_name, req.week_start, shifts_summary, req.announcement)
        emails_sent += 1

    return {
        "message": "Đã xuất bản lịch làm việc thành công!",
        "notification_created": True,
        "emails_sent": emails_sent
    }

# ================= SỔ GHI CHÚ CA LÀM (BÁO BẬN ĐỘT XUẤT) =================
@app.get("/api/shift-notes")
def list_shift_notes(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    query = """
    SELECT sn.id, sn.user_id, sn.shift_id, sn.work_date, sn.original_time, sn.adjusted_time,
           sn.reason, sn.note_type, sn.status, sn.admin_response, sn.created_at,
           u.full_name as author_name, u.email as author_email,
           st.name as shift_name, st.label as shift_label
    FROM shift_notes sn
    JOIN users u ON sn.user_id = u.id
    JOIN shift_templates st ON sn.shift_id = st.id
    ORDER BY sn.id DESC
    """
    rows = conn.execute(query).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/shift-notes")
def create_shift_note(req: CreateShiftNoteRequest, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    INSERT INTO shift_notes (user_id, shift_id, work_date, original_time, adjusted_time, reason, note_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    """, (current_user["id"], req.shift_id, req.work_date, req.original_time, req.adjusted_time, req.reason, req.note_type))
    
    note_id = cursor.lastrowid
    
    # Tự động gửi thông báo cho Admin
    notif_msg = f"{current_user['full_name']} báo bận ca ngày {req.work_date} ({req.original_time}). Giờ có thể làm: {req.adjusted_time}. Lý do: {req.reason}"
    cursor.execute("""
    INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
    VALUES (1, ?, 'Ghi chú điều chỉnh ca làm việc mới', ?, 'shift_note_submitted', ?)
    """, (current_user["id"], notif_msg, note_id))
    
    conn.commit()
    conn.close()
    return {"message": "Đã gửi ghi chú báo ca thành công đến quản lý", "note_id": note_id}

@app.put("/api/shift-notes/{note_id}/status")
def update_shift_note_status(note_id: int, req: UpdateShiftNoteStatusRequest, admin: dict = Depends(require_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    note = cursor.execute("SELECT user_id, work_date, original_time FROM shift_notes WHERE id = ?", (note_id,)).fetchone()
    if not note:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy ghi chú")
        
    cursor.execute("""
    UPDATE shift_notes
    SET status = ?, admin_response = ?
    WHERE id = ?
    """, (req.status, req.admin_response, note_id))
    
    # Bắn thông báo phản hồi lại cho nhân viên
    status_text = "đã được duyệt" if req.status == "approved" else ("đã được ghi nhận" if req.status == "acknowledged" else "bị từ chối")
    msg = f"Quản lý {status_text} ghi chú điều chỉnh ca ngày {note['work_date']}. Phản hồi: {req.admin_response or 'Không có'}"
    cursor.execute("""
    INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
    VALUES (?, ?, 'Kết quả duyệt ghi chú ca làm', ?, 'shift_note_approved', ?)
    """, (note["user_id"], admin["id"], msg, note_id))
    
    conn.commit()
    conn.close()
    return {"message": "Đã cập nhật trạng thái ghi chú ca làm"}

# ================= FEEDBACK TOÀN CÔNG TY =================
@app.get("/api/feedbacks")
def list_feedbacks(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    query = """
    SELECT f.id, f.user_id, f.author_name, f.is_anonymous, f.category, f.title, f.content,
           f.likes_count, f.status, f.admin_reply, f.created_at,
           EXISTS(SELECT 1 FROM feedback_likes fl WHERE fl.feedback_id = f.id AND fl.user_id = ?) as has_liked
    FROM feedbacks f
    ORDER BY f.id DESC
    """
    rows = conn.execute(query, (current_user["id"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/feedbacks")
def create_feedback(req: CreateFeedbackRequest, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    author_name = "Nhân viên ẩn danh" if req.is_anonymous else current_user["full_name"]
    is_anon = 1 if req.is_anonymous else 0
    
    cursor.execute("""
    INSERT INTO feedbacks (user_id, author_name, is_anonymous, category, title, content, likes_count, status)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'pending')
    """, (current_user["id"], author_name, is_anon, req.category, req.title, req.content))
    
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"message": "Đã gửi ý kiến đóng góp thành công", "feedback_id": new_id}

@app.post("/api/feedbacks/{feedback_id}/like")
def toggle_feedback_like(feedback_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    existing = cursor.execute(
        "SELECT 1 FROM feedback_likes WHERE feedback_id = ? AND user_id = ?",
        (feedback_id, current_user["id"])
    ).fetchone()
    
    if existing:
        cursor.execute("DELETE FROM feedback_likes WHERE feedback_id = ? AND user_id = ?", (feedback_id, current_user["id"]))
        cursor.execute("UPDATE feedbacks SET likes_count = MAX(0, likes_count - 1) WHERE id = ?", (feedback_id,))
        liked = False
    else:
        cursor.execute("INSERT INTO feedback_likes (feedback_id, user_id) VALUES (?, ?)", (feedback_id, current_user["id"]))
        cursor.execute("UPDATE feedbacks SET likes_count = likes_count + 1 WHERE id = ?", (feedback_id,))
        liked = True
        
    conn.commit()
    conn.close()
    return {"liked": liked}

@app.post("/api/feedbacks/{feedback_id}/reply")
def reply_feedback(feedback_id: int, req: ReplyFeedbackRequest, admin: dict = Depends(require_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    fb = cursor.execute("SELECT user_id, title, is_anonymous FROM feedbacks WHERE id = ?", (feedback_id,)).fetchone()
    if not fb:
        conn.close()
        raise HTTPException(status_code=404, detail="Không tìm thấy feedback")
        
    cursor.execute("""
    UPDATE feedbacks
    SET admin_reply = ?, status = ?
    WHERE id = ?
    """, (req.admin_reply, req.status, feedback_id))
    
    # Nếu không phải ẩn danh, gửi thông báo cho người viết feedback
    if not fb["is_anonymous"]:
        msg = f"Ban quản lý đã phản hồi góp ý của bạn: '{fb['title']}'"
        cursor.execute("""
        INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
        VALUES (?, ?, 'Phản hồi góp ý từ Ban Quản Lý', ?, 'feedback_reply', ?)
        """, (fb["user_id"], admin["id"], msg, feedback_id))
        
    conn.commit()
    conn.close()
    return {"message": "Đã lưu phản hồi cho góp ý"}

# ================= NOTIFICATIONS =================
@app.get("/api/notifications")
def list_notifications(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    query = """
    SELECT id, target_user_id, sender_id, title, message, type, related_id, is_read, created_at
    FROM notifications
    WHERE target_user_id = ? OR target_user_id = 0
    ORDER BY id DESC
    LIMIT 50
    """
    rows = conn.execute(query, (current_user["id"],)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.put("/api/notifications/{notif_id}/read")
def mark_read(notif_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    conn.execute("UPDATE notifications SET is_read = 1 WHERE id = ?", (notif_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@app.put("/api/notifications/read-all")
def mark_all_read(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    conn.execute("UPDATE notifications SET is_read = 1 WHERE target_user_id = ? OR target_user_id = 0", (current_user["id"],))
    conn.commit()
    conn.close()
    return {"success": True}

# ================= EMAIL LOGS (OUTBOX INSPECTION) =================
@app.get("/api/emails/outbox")
def list_email_logs(current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    logs = conn.execute("SELECT id, recipient_email, recipient_name, subject, html_body, status, sent_at FROM email_logs ORDER BY id DESC LIMIT 50").fetchall()
    conn.close()
    return [dict(l) for l in logs]

# ================= SMTP CONFIGURATION & LIVE TESTING =================
@app.get("/api/settings/smtp")
def get_smtp_settings(admin: dict = Depends(require_admin)):
    conn = get_db_connection()
    rows = conn.execute("SELECT key, value FROM system_settings WHERE key LIKE 'smtp_%'").fetchall()
    conn.close()
    data = {r["key"]: r["value"] for r in rows}
    return {
        "host": data.get("smtp_host", "smtp.gmail.com"),
        "port": int(data.get("smtp_port", "587")),
        "user": data.get("smtp_user", ""),
        "from_name": data.get("smtp_from_name", "Hệ Thống Phân Ca WorkShiftPro"),
        "has_password": bool(data.get("smtp_password", ""))
    }

@app.post("/api/settings/smtp")
def update_smtp_settings(req: SmtpSettingsRequest, admin: dict = Depends(require_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_host', ?)", (req.host,))
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_port', ?)", (str(req.port),))
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_user', ?)", (req.user,))
    cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_from_name', ?)", (req.from_name,))
    if req.password:
        cursor.execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_password', ?)", (req.password.strip(),))
    conn.commit()
    conn.close()
    return {"message": "Đã lưu cấu hình SMTP thành công!"}

@app.post("/api/emails/test-send")
def test_send_email(req: TestEmailRequest, admin: dict = Depends(require_admin)):
    subject = "[WorkShiftPro] Kiểm tra gửi Email thật thành công!"
    html_body = f"""
    <div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; max-width: 500px;'>
        <h2 style='color: #2563eb;'>Xin chào!</h2>
        <p>Email này được gửi thử nghiệm trực tiếp từ <strong>Hệ Thống Quản Lý Ca WorkShiftPro</strong>.</p>
        <div style='background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; color: #065f46;'>
            <strong>Trạng thái:</strong> Cấu hình SMTP hoạt động hoàn hảo! Hệ thống đã sẵn sàng tự động gửi lịch làm việc cho toàn bộ nhân viên.
        </div>
        <p style='margin-top: 15px; font-size: 12px; color: #64748b;'>Thao tác bởi Quản trị viên</p>
    </div>
    """
    result = send_real_email(req.recipient_email, "Bạn", subject, html_body)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Không thể gửi email qua SMTP."))
    return result
