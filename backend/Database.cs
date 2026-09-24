using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using Dapper;
using Microsoft.Data.Sqlite;
using Npgsql;

namespace WorkManagement.Api;

public static class Database
{
    private static readonly string DbType = Environment.GetEnvironmentVariable("DB_TYPE")?.ToLower() ?? 
        (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING")) ? "postgres" : "sqlite");
    
    private static readonly string PostgresConnStr = Environment.GetEnvironmentVariable("CONNECTION_STRING") ?? 
        Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING") ?? 
        "Host=db;Port=5432;Database=work_management;Username=postgres;Password=postgres_secret_2026";

    private static readonly string DbFile = Environment.GetEnvironmentVariable("DB_FILE") ?? "work_management.db";
    private static readonly string SqliteConnStr = $"Data Source={DbFile}";

    public static bool IsPostgres => DbType == "postgres" || DbType == "postgresql";

    public static DbConnection GetConnection()
    {
        if (IsPostgres)
        {
            var conn = new NpgsqlConnection(PostgresConnStr);
            conn.Open();
            return conn;
        }
        else
        {
            var dir = Path.GetDirectoryName(DbFile);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }
            var conn = new SqliteConnection(SqliteConnStr);
            conn.Open();
            return conn;
        }
    }

    public static string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var salted = "wm_salt_2026" + password;
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(salted));
        return Convert.ToHexString(bytes).ToLower();
    }

    public static bool VerifyPassword(string password, string storedHash)
    {
        if (string.Equals(storedHash, HashPassword(password), StringComparison.OrdinalIgnoreCase))
            return true;
        try
        {
            if (BCrypt.Net.BCrypt.Verify(password, storedHash))
                return true;
        }
        catch { }
        return false;
    }

    public static void Init()
    {
        // Resilient connection wait if running in Docker with Postgres
        DbConnection? conn = null;
        for (int retry = 1; retry <= 10; retry++)
        {
            try
            {
                conn = GetConnection();
                break;
            }
            catch (Exception ex)
            {
                if (retry == 10) throw;
                Console.WriteLine($"[Database] Waiting for database ({DbType})... Retry {retry}/10. Reason: {ex.Message}");
                Thread.Sleep(1500);
            }
        }

        using (conn)
        {
            string pk = IsPostgres ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";

            conn!.Execute($@"
            CREATE TABLE IF NOT EXISTS users (
                id {pk},
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                role TEXT NOT NULL DEFAULT 'staff',
                department TEXT DEFAULT 'Bộ phận Vận hành',
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS shift_templates (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                label TEXT NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS shift_registrations (
                id {pk},
                user_id INTEGER NOT NULL,
                shift_id INTEGER NOT NULL,
                work_date TEXT NOT NULL,
                status TEXT DEFAULT 'registered',
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                target_shift_id INTEGER,
                target_work_date TEXT,
                request_reason TEXT,
                attendance_status TEXT DEFAULT 'present',
                absence_reason TEXT,
                absence_reported_at TIMESTAMP,
                absence_approved_by INTEGER,
                absence_approved_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (shift_id) REFERENCES shift_templates(id),
                UNIQUE(user_id, shift_id, work_date)
            );

            CREATE TABLE IF NOT EXISTS shift_history (
                id {pk},
                user_id INTEGER NOT NULL,
                shift_id INTEGER NOT NULL,
                work_date TEXT NOT NULL,
                action TEXT NOT NULL,
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (shift_id) REFERENCES shift_templates(id)
            );

            CREATE TABLE IF NOT EXISTS shift_notes (
                id {pk},
                user_id INTEGER NOT NULL,
                shift_id INTEGER NOT NULL,
                work_date TEXT NOT NULL,
                original_time TEXT NOT NULL,
                adjusted_time TEXT NOT NULL,
                reason TEXT NOT NULL,
                note_type TEXT DEFAULT 'adjusted_hours',
                status TEXT DEFAULT 'pending',
                admin_response TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (shift_id) REFERENCES shift_templates(id)
            );

            CREATE TABLE IF NOT EXISTS feedbacks (
                id {pk},
                user_id INTEGER NOT NULL,
                author_name TEXT NOT NULL,
                is_anonymous INTEGER DEFAULT 0,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                likes_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                admin_reply TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS feedback_likes (
                feedback_id INTEGER,
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (feedback_id, user_id),
                FOREIGN KEY (feedback_id) REFERENCES feedbacks(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id {pk},
                target_user_id INTEGER,
                sender_id INTEGER,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT NOT NULL,
                related_id INTEGER,
                is_read INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS email_logs (
                id {pk},
                recipient_email TEXT NOT NULL,
                recipient_name TEXT NOT NULL,
                subject TEXT NOT NULL,
                html_body TEXT NOT NULL,
                status TEXT DEFAULT 'simulated',
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS shift_events (
                id {pk},
                shift_id INTEGER NOT NULL,
                work_date TEXT,
                title TEXT NOT NULL,
                description TEXT,
                event_type TEXT DEFAULT 'general',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shift_id) REFERENCES shift_templates(id)
            );
            ");

            // Backward compatibility for existing databases
            try { conn.Execute("ALTER TABLE shift_registrations ADD COLUMN target_shift_id INTEGER;"); } catch { }
            try { conn.Execute("ALTER TABLE shift_registrations ADD COLUMN target_work_date TEXT;"); } catch { }
            try { conn.Execute("ALTER TABLE shift_registrations ADD COLUMN request_reason TEXT;"); } catch { }
            try { conn.Execute("ALTER TABLE shift_registrations ADD COLUMN attendance_status TEXT DEFAULT 'present';"); } catch { }
            try { conn.Execute("ALTER TABLE shift_registrations ADD COLUMN absence_reason TEXT;"); } catch { }
            try { conn.Execute("ALTER TABLE shift_registrations ADD COLUMN absence_reported_at TIMESTAMP;"); } catch { }
            try { conn.Execute("ALTER TABLE shift_registrations ADD COLUMN absence_approved_by INTEGER;"); } catch { }
            try { conn.Execute("ALTER TABLE shift_registrations ADD COLUMN absence_approved_at TIMESTAMP;"); } catch { }

            // 1. Synchronize shift templates
            var shifts = new[]
            {
                new { id = 0, name = "Cả ngày (All Day)", start_time = "08:00", end_time = "22:00", label = "08:00 - 22:00", desc = "Sự kiện áp dụng cho cả ngày" },
                new { id = 1, name = "Ca 1 (Shift 1)", start_time = "08:00", end_time = "09:30", label = "08:00 - 09:30", desc = "Ca 1: 08:00 - 09:30" },
                new { id = 2, name = "Ca 2 (Shift 2)", start_time = "09:35", end_time = "11:05", label = "09:35 - 11:05", desc = "Ca 2: 09:35 - 11:05" },
                new { id = 3, name = "Ca 3 (Shift 3)", start_time = "11:10", end_time = "12:40", label = "11:10 - 12:40", desc = "Ca 3: 11:10 - 12:40" },
                new { id = 4, name = "Ca 4 (Shift 4)", start_time = "13:10", end_time = "14:40", label = "13:10 - 14:40", desc = "Ca 4: 13:10 - 14:40" },
                new { id = 5, name = "Ca 5 (Shift 5)", start_time = "14:45", end_time = "16:15", label = "14:45 - 16:15", desc = "Ca 5: 14:45 - 16:15" },
                new { id = 6, name = "Ca 6 (Shift 6)", start_time = "16:45", end_time = "18:15", label = "16:45 - 18:15", desc = "Ca 6: 16:45 - 18:15" },
                new { id = 7, name = "Ca 7 (Shift 7)", start_time = "18:20", end_time = "19:50", label = "18:20 - 19:50", desc = "Ca 7: 18:20 - 19:50" },
                new { id = 8, name = "Ca 8 (Shift 8)", start_time = "19:55", end_time = "20:25", label = "19:55 - 20:25", desc = "Ca 8: 19:55 - 20:25" },
                new { id = 9, name = "Ca 9 (Shift 9)", start_time = "20:30", end_time = "22:00", label = "20:30 - 22:00", desc = "Ca 9: 20:30 - 22:00" }
            };

            foreach (var s in shifts)
            {
                conn.Execute(@"
                    INSERT INTO shift_templates (id, name, start_time, end_time, label, description) 
                    VALUES (@id, @name, @start_time, @end_time, @label, @desc)
                    ON CONFLICT (id) DO UPDATE SET 
                        name = EXCLUDED.name, 
                        start_time = EXCLUDED.start_time, 
                        end_time = EXCLUDED.end_time, 
                        label = EXCLUDED.label, 
                        description = EXCLUDED.description", s);
            }

            // 2. Synchronize 13 standard users
            var userCount = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM users");
            if (userCount == 0)
            {
                var adminPass = HashPassword("admin123");
                var staffPass = HashPassword("123456");

                var seedUsers = new[]
                {
                    new { u = "admin", p = adminPass, fn = "Quản Lý Vận Hành", e = "admin@company.com", ph = "0901234567", r = "admin", d = "Ban Quản Trị" },
                    new { u = "nv_an", p = staffPass, fn = "Nguyễn Văn An", e = "an.nguyen@company.com", ph = "0987654321", r = "staff", d = "Tổ Trực Kỹ Thuật" },
                    new { u = "nv_binh", p = staffPass, fn = "Trần Thị Bình", e = "binh.tran@company.com", ph = "0912345678", r = "staff", d = "Tổ Dịch Vụ Sinh Viên" },
                    new { u = "nv_cuong", p = staffPass, fn = "Đặng Quốc Cường", e = "cuong.dang@company.com", ph = "0923456789", r = "staff", d = "Hỗ Trợ Kỹ Thuật" },
                    new { u = "longhvn", p = staffPass, fn = "Nguyễn Vũ Hoàng Long", e = "longhvn2006@gmail.com", ph = "0934567890", r = "staff", d = "Tổ Trực Vận Hành" },
                    new { u = "nv_duc", p = staffPass, fn = "Phạm Minh Đức", e = "duc.pham@company.com", ph = "0945678901", r = "staff", d = "Kỹ Thuật Hạ Tầng" },
                    new { u = "nv_nam", p = staffPass, fn = "Lê Hoàng Nam", e = "nam.le@company.com", ph = "0956789012", r = "staff", d = "Vận Hành Mạng" },
                    new { u = "nv_mai", p = staffPass, fn = "Vũ Thị Mai", e = "mai.vu@company.com", ph = "0967890123", r = "staff", d = "Chăm Sóc Khách Hàng" },
                    new { u = "nv_huy", p = staffPass, fn = "Đỗ Gia Huy", e = "huy.do@company.com", ph = "0978901234", r = "staff", d = "Giám Sát Ca Đêm" },
                    new { u = "nv_linh", p = staffPass, fn = "Hoàng Khánh Linh", e = "linh.hoang@company.com", ph = "0989012345", r = "staff", d = "Trực Tổng Đài" },
                    new { u = "nv_thao", p = staffPass, fn = "Bùi Phương Thảo", e = "thao.bui@company.com", ph = "0990123456", r = "staff", d = "Điều Phối Ca Trực" },
                    new { u = "nv_tuan", p = staffPass, fn = "Ngô Quang Tuấn", e = "tuan.ngo@company.com", ph = "0902345678", r = "staff", d = "Hỗ Trợ Thiết Bị" },
                    new { u = "nv_tung", p = staffPass, fn = "Trịnh Thanh Tùng", e = "tung.trinh@company.com", ph = "0913456789", r = "staff", d = "An Ninh Hệ Thống" }
                };

                foreach (var u in seedUsers)
                {
                    conn.Execute("INSERT INTO users (username, password_hash, full_name, email, phone, role, department) VALUES (@u, @p, @fn, @e, @ph, @r, @d) ON CONFLICT (username) DO NOTHING", u);
                }

                conn.Execute("INSERT INTO notifications (target_user_id, sender_id, title, message, type) VALUES (0, 1, @title, @msg, 'general')",
                    new { title = "Chào mừng đến với Cổng Quản Lý Ca Làm Việc", msg = "Hệ thống đang vận hành trên nền tảng PostgreSQL với chuẩn 9 ca trường học. Chúc các bạn làm việc hiệu quả!" });
            }

            // 3. System settings
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_host', 'smtp.gmail.com') ON CONFLICT (key) DO NOTHING");
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_port', '587') ON CONFLICT (key) DO NOTHING");
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_user', 'longhvn2006@gmail.com') ON CONFLICT (key) DO NOTHING");
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_password', 'wtew euaj zcuu bjtq') ON CONFLICT (key) DO NOTHING");
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_from_name', 'Hệ Thống Phân Ca WorkShiftPro') ON CONFLICT (key) DO NOTHING");
            conn.Execute("UPDATE system_settings SET value = 'longhvn2006@gmail.com' WHERE key = 'smtp_user' AND (value IS NULL OR value = '')");
            conn.Execute("UPDATE system_settings SET value = 'wtew euaj zcuu bjtq' WHERE key = 'smtp_password' AND (value IS NULL OR value = '')");

            // 4. Default shift events
            var eventCount = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM shift_events");
            if (eventCount == 0)
            {
                var seedEvents = new[]
                {
                    new { shift_id = 1, title = "Họp giao ban đầu ngày & phổ biến nhiệm vụ", description = "Kiểm tra sĩ số, phân công vị trí trực ca sáng", event_type = "meeting" },
                    new { shift_id = 1, title = "Kiểm tra hạ tầng kỹ thuật", description = "Khởi động hệ thống điều hòa, mạng phòng lab", event_type = "maintenance" },
                    new { shift_id = 2, title = "Kiểm tra hệ thống máy chủ & mạng", description = "Rà soát ticket hỗ trợ và kiểm tra băng thông", event_type = "task" },
                    new { shift_id = 3, title = "Giám sát lưu lượng cao điểm trưa", description = "Đảm bảo hỗ trợ sinh viên và người dùng liên tục", event_type = "general" },
                    new { shift_id = 4, title = "Giao ban ca chiều & xử lý yêu cầu tồn", description = "Họp nhanh 10 phút đầu ca chiều", event_type = "meeting" },
                    new { shift_id = 5, title = "Sao lưu dữ liệu định kỳ", description = "Đồng bộ snapshot cơ sở dữ liệu lên cloud", event_type = "task" },
                    new { shift_id = 6, title = "Báo cáo tổng kết ca chiều", description = "Ghi nhận các sự cố phát sinh trong ngày", event_type = "general" },
                    new { shift_id = 7, title = "Kiểm tra an ninh cơ sở vật chất", description = "Khóa các phòng ban phụ và kiểm tra thiết bị", event_type = "maintenance" },
                    new { shift_id = 8, title = "Bàn giao ca tối & ký checklist", description = "Ký biên bản bàn giao thiết bị phòng trực", event_type = "handover" },
                    new { shift_id = 9, title = "Chốt sổ vận hành & giám sát đêm", description = "Khóa hệ thống, kiểm tra an toàn PCCC", event_type = "task" }
                };
                foreach (var ev in seedEvents)
                {
                    conn.Execute("INSERT INTO shift_events (shift_id, title, description, event_type) VALUES (@shift_id, @title, @description, @event_type)", ev);
                }
            }

            // 5. Default weekly schedule registrations
            var regCount = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM shift_registrations");
            if (regCount == 0)
            {
                var adminUser = conn.QueryFirstOrDefault<dynamic>("SELECT id FROM users WHERE username = 'admin'");
                var staffAn = conn.QueryFirstOrDefault<dynamic>("SELECT id FROM users WHERE username = 'nv_an'");
                var staffBinh = conn.QueryFirstOrDefault<dynamic>("SELECT id FROM users WHERE username = 'nv_binh'");
                var staffCuong = conn.QueryFirstOrDefault<dynamic>("SELECT id FROM users WHERE username = 'nv_cuong'");

                if (adminUser != null && staffAn != null)
                {
                    long uidAdmin = adminUser.id;
                    long uidAn = staffAn.id;
                    long uidBinh = staffBinh != null ? staffBinh.id : uidAn;
                    long uidCuong = staffCuong != null ? staffCuong.id : uidAn;

                    var sampleRegs = new[]
                    {
                        new { uid = uidAn, sid = 1, dt = "2026-09-21", note = "Đăng ký ca trực", att = "present" },
                        new { uid = uidBinh, sid = 2, dt = "2026-09-21", note = "Đăng ký ca trực", att = "present" },
                        new { uid = uidAdmin, sid = 3, dt = "2026-09-22", note = "Trực giám sát vận hành", att = "present" },
                        new { uid = uidAn, sid = 1, dt = "2026-09-22", note = "Quản lý đã phê duyệt nghỉ phép", att = "absent" },
                        new { uid = uidCuong, sid = 4, dt = "2026-09-22", note = "Hỗ trợ kỹ thuật", att = "present" },
                        new { uid = uidAn, sid = 2, dt = "2026-09-23", note = "Trực ca sáng 2", att = "present" },
                        new { uid = uidAdmin, sid = 1, dt = "2026-09-23", note = "Quản lý ca sáng", att = "present" },
                        new { uid = uidBinh, sid = 5, dt = "2026-09-24", note = "Hỗ trợ sinh viên", att = "present" },
                        new { uid = uidCuong, sid = 7, dt = "2026-09-25", note = "Trực ca tối", att = "present" },
                        new { uid = uidAn, sid = 9, dt = "2026-09-26", note = "Trực ca đêm", att = "present" }
                    };

                    foreach (var r in sampleRegs)
                    {
                        conn.Execute(@"
                            INSERT INTO shift_registrations (user_id, shift_id, work_date, note, status, attendance_status) 
                            VALUES (@uid, @sid, @dt, @note, 'registered', @att) 
                            ON CONFLICT (user_id, shift_id, work_date) DO NOTHING", r);
                    }
                }
            }
        }
    }
}
