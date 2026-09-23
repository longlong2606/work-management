import sqlite3
import os
import hashlib
from constants import DEFAULT_SHIFTS

DB_PATH = os.path.join(os.path.dirname(__file__), "work_management.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    salt = "wm_salt_2026"
    return hashlib.sha256((salt + password).encode("utf-8")).hexdigest()

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        role TEXT NOT NULL DEFAULT 'staff',
        department TEXT DEFAULT 'Bộ phận Vận hành',
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Shift templates table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shift_templates (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT
    )
    """)

    # Shift registrations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shift_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        shift_id INTEGER NOT NULL,
        work_date TEXT NOT NULL,
        status TEXT DEFAULT 'registered',
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (shift_id) REFERENCES shift_templates(id),
        UNIQUE(user_id, shift_id, work_date)
    )
    """)

    # Shift notes (Báo bận đột xuất / Xin điều chỉnh giờ làm ca)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS shift_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        shift_id INTEGER NOT NULL,
        work_date TEXT NOT NULL,
        original_time TEXT NOT NULL,
        adjusted_time TEXT NOT NULL,
        reason TEXT NOT NULL,
        note_type TEXT DEFAULT 'adjusted_hours',
        status TEXT DEFAULT 'pending',
        admin_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (shift_id) REFERENCES shift_templates(id)
    )
    """)

    # Feedbacks table (Bảng góp ý toàn công ty)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        author_name TEXT NOT NULL,
        is_anonymous INTEGER DEFAULT 0,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        likes_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        admin_reply TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Feedback Likes table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feedback_likes (
        feedback_id INTEGER,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (feedback_id, user_id),
        FOREIGN KEY (feedback_id) REFERENCES feedbacks(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
    """)

    # Notifications table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_user_id INTEGER,
        sender_id INTEGER,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        related_id INTEGER,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Email Outbox Logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS email_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT NOT NULL,
        subject TEXT NOT NULL,
        html_body TEXT NOT NULL,
        status TEXT DEFAULT 'simulated',
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Seed shift templates if empty
    cursor.execute("SELECT COUNT(*) FROM shift_templates")
    if cursor.fetchone()[0] == 0:
        for s in DEFAULT_SHIFTS:
            cursor.execute("""
            INSERT INTO shift_templates (id, name, start_time, end_time, label, description)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (s["id"], s["name"], s["start_time"], s["end_time"], s["label"], s["description"]))

    # Seed initial accounts if empty
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        admin_pass = hash_password("admin123")
        staff_pass = hash_password("123456")

        cursor.execute("""
        INSERT INTO users (username, password_hash, full_name, email, phone, role, department)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("admin", admin_pass, "Quản Lý Vận Hành", "admin@company.com", "0901234567", "admin", "Ban Quản Trị"))

        cursor.execute("""
        INSERT INTO users (username, password_hash, full_name, email, phone, role, department)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("nv_an", staff_pass, "Nguyễn Văn An", "an.nguyen@company.com", "0987654321", "staff", "Tổ Trực Kỹ Thuật"))

        cursor.execute("""
        INSERT INTO users (username, password_hash, full_name, email, phone, role, department)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("nv_binh", staff_pass, "Trần Thị Bình", "binh.tran@company.com", "0912345678", "staff", "Tổ Dịch Vụ Sinh Viên"))

        # Seed sample feedback
        cursor.execute("""
        INSERT INTO feedbacks (user_id, author_name, is_anonymous, category, title, content, likes_count, status, admin_reply)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (2, "Nguyễn Văn An", 0, "facilities", "Đề xuất bảo dưỡng điều hòa phòng trực ca 3 & 4",
              "Thời gian gần đây phòng trực tầng 2 điều hòa làm lạnh hơi yếu vào các ca chiều nắng nóng (13h-17h). Đề xuất công ty kiểm tra vệ sinh lọc gió.",
              3, "in_progress", "Quản lý đã tiếp nhận và liên hệ đội kỹ thuật tòa nhà bảo trì vào sáng thứ 6 tới."))

        cursor.execute("""
        INSERT INTO feedbacks (user_id, author_name, is_anonymous, category, title, content, likes_count, status, admin_reply)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (3, "Nhân viên ẩn danh", 1, "schedule", "Mong muốn có thêm bảng tổng kết số giờ làm cuối tháng",
              "Hệ thống đăng ký 6 ca rất tiện, nếu có thêm cột tổng kết số ca/giờ đã làm được trong tháng để nhân viên đối soát thì tuyệt vời ạ.",
              5, "pending", None))

        # Seed sample notification
        cursor.execute("""
        INSERT INTO notifications (target_user_id, sender_id, title, message, type)
        VALUES (0, 1, "Chào mừng đến với Cổng Quản Lý Ca Làm Việc", "Hệ thống đã chuẩn hóa 6 ca làm việc theo khung giờ của trường. Chúc các bạn làm việc hiệu quả!", "general")
        """)

    conn.commit()
    conn.close()
