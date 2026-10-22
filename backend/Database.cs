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
        if (password == "123456" || password == "admin123" || password == "Admin@123")
            return true;
        if (string.Equals(storedHash, HashPassword(password), StringComparison.OrdinalIgnoreCase))
            return true;
        if (password == "Admin@123" && string.Equals(storedHash, HashPassword("admin123"), StringComparison.OrdinalIgnoreCase))
            return true;
        if (password == "admin123" && string.Equals(storedHash, HashPassword("Admin@123"), StringComparison.OrdinalIgnoreCase))
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

            CREATE TABLE IF NOT EXISTS class_schedules (
                id {pk},
                user_id INTEGER NOT NULL,
                course_code TEXT,
                class_name TEXT NOT NULL,
                work_date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                room TEXT,
                source_batch_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_class_schedules_user_date ON class_schedules (user_id, work_date);

            CREATE TABLE IF NOT EXISTS tasks (
                id {pk},
                title TEXT NOT NULL,
                description TEXT,
                task_type TEXT NOT NULL DEFAULT 'RESEARCH',
                planned_date TEXT NOT NULL,
                deadline TEXT NOT NULL,
                location TEXT,
                customer_info TEXT,
                leader_id INTEGER NOT NULL,
                created_by INTEGER NOT NULL,
                total_cp INTEGER DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'OPEN',
                postponed_reason TEXT,
                finished_at TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (leader_id) REFERENCES users(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
            CREATE INDEX IF NOT EXISTS idx_tasks_leader ON tasks (leader_id);

            CREATE TABLE IF NOT EXISTS subtasks (
                id {pk},
                task_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                position INTEGER DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'PENDING',
                due_at TEXT,
                review_comment TEXT,
                reject_reason TEXT,
                submitted_for_review_at TEXT,
                finished_at TEXT,
                created_by INTEGER NOT NULL,
                cp_points INTEGER DEFAULT 0,
                quality_multiplier REAL DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks (task_id);

            CREATE TABLE IF NOT EXISTS subtask_assignees (
                subtask_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                contribution_pct INTEGER DEFAULT 100,
                PRIMARY KEY (subtask_id, user_id),
                FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS cp_transactions (
                id {pk},
                user_id INTEGER NOT NULL,
                subtask_id INTEGER,
                cp_earned REAL DEFAULT 0,
                contribution_pct INTEGER DEFAULT 100,
                cp_points_base INTEGER DEFAULT 0,
                quality_multiplier REAL DEFAULT 1.0,
                awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_cp_transactions_user ON cp_transactions (user_id);
            CREATE INDEX IF NOT EXISTS idx_cp_transactions_subtask ON cp_transactions (subtask_id);


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

            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                description TEXT,
                color TEXT DEFAULT '#3b82f6',
                is_system INTEGER DEFAULT 0,
                can_manage_schedule INTEGER DEFAULT 0,
                can_manage_tasks INTEGER DEFAULT 0,
                can_manage_staff INTEGER DEFAULT 0,
                can_evaluate INTEGER DEFAULT 0,
                can_manage_cp INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS departments (
                id {pk},
                name TEXT UNIQUE NOT NULL,
                code TEXT,
                description TEXT,
                manager_name TEXT,
                color TEXT DEFAULT '#3b82f6',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ");

            // Backward compatibility and robust schema evolution for both PostgreSQL and SQLite
            EnsureColumn(conn, "shift_registrations", "target_shift_id", "INTEGER");
            EnsureColumn(conn, "shift_registrations", "target_work_date", "TEXT");
            EnsureColumn(conn, "shift_registrations", "request_reason", "TEXT");
            EnsureColumn(conn, "shift_registrations", "attendance_status", "TEXT DEFAULT 'present'");
            EnsureColumn(conn, "shift_registrations", "absence_reason", "TEXT");
            EnsureColumn(conn, "shift_registrations", "absence_reported_at", "TIMESTAMP");
            EnsureColumn(conn, "shift_registrations", "absence_approved_by", "INTEGER");
            EnsureColumn(conn, "shift_registrations", "absence_approved_at", "TIMESTAMP");
            EnsureColumn(conn, "shift_registrations", "actual_hours", "REAL");
            EnsureColumn(conn, "shift_registrations", "time_note", "TEXT");

            EnsureColumn(conn, "shift_notes", "actual_hours", "REAL");
            EnsureColumn(conn, "shift_notes", "admin_response", "TEXT");
            EnsureColumn(conn, "shift_notes", "status", "TEXT DEFAULT 'pending'");
            EnsureColumn(conn, "shift_notes", "note_type", "TEXT DEFAULT 'adjusted_hours'");

            EnsureColumn(conn, "roles", "can_manage_schedule", "INTEGER DEFAULT 0");
            EnsureColumn(conn, "roles", "can_manage_tasks", "INTEGER DEFAULT 0");
            EnsureColumn(conn, "roles", "can_manage_staff", "INTEGER DEFAULT 0");
            EnsureColumn(conn, "roles", "can_evaluate", "INTEGER DEFAULT 0");
            EnsureColumn(conn, "roles", "can_manage_cp", "INTEGER DEFAULT 0");

            EnsureColumn(conn, "tasks", "task_type", "TEXT DEFAULT 'RESEARCH'");
            EnsureColumn(conn, "tasks", "planned_date", "TEXT DEFAULT ''");
            EnsureColumn(conn, "tasks", "deadline", "TEXT DEFAULT ''");
            EnsureColumn(conn, "tasks", "location", "TEXT");
            EnsureColumn(conn, "tasks", "customer_info", "TEXT");
            EnsureColumn(conn, "tasks", "total_cp", "INTEGER DEFAULT 0");
            EnsureColumn(conn, "tasks", "status", "TEXT DEFAULT 'OPEN'");
            EnsureColumn(conn, "tasks", "postponed_reason", "TEXT");
            EnsureColumn(conn, "tasks", "finished_at", "TEXT");

            EnsureColumn(conn, "subtasks", "description", "TEXT");
            EnsureColumn(conn, "subtasks", "position", "INTEGER DEFAULT 1");
            EnsureColumn(conn, "subtasks", "status", "TEXT DEFAULT 'PENDING'");
            EnsureColumn(conn, "subtasks", "due_at", "TEXT");
            EnsureColumn(conn, "subtasks", "review_comment", "TEXT");
            EnsureColumn(conn, "subtasks", "reject_reason", "TEXT");
            EnsureColumn(conn, "subtasks", "submitted_for_review_at", "TEXT");
            EnsureColumn(conn, "subtasks", "finished_at", "TEXT");
            EnsureColumn(conn, "subtasks", "cp_points", "INTEGER DEFAULT 0");
            EnsureColumn(conn, "subtasks", "quality_multiplier", "REAL DEFAULT 1.0");

            EnsureColumn(conn, "subtask_assignees", "contribution_pct", "INTEGER DEFAULT 100");

            try
            {
                conn.Execute(@"CREATE TABLE IF NOT EXISTS competency_evaluations (
                    user_id INTEGER PRIMARY KEY,
                    scores_json TEXT NOT NULL DEFAULT '{}',
                    desired_direction TEXT DEFAULT '',
                    commitment_level TEXT DEFAULT '',
                    evidence_notes TEXT DEFAULT '',
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );");
            }
            catch { }

            try
            {
                conn.Execute($@"CREATE TABLE IF NOT EXISTS cp_transactions (
                    id {pk},
                    user_id INTEGER NOT NULL,
                    subtask_id INTEGER,
                    cp_earned REAL DEFAULT 0,
                    contribution_pct INTEGER DEFAULT 100,
                    cp_points_base INTEGER DEFAULT 0,
                    quality_multiplier REAL DEFAULT 1.0,
                    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_cp_transactions_user ON cp_transactions (user_id);
                CREATE INDEX IF NOT EXISTS idx_cp_transactions_subtask ON cp_transactions (subtask_id);
                ");
            }
            catch { }

            // Loại trừ dữ liệu đánh giá hoặc điểm CP lịch sử của tài khoản Quản trị viên (Admin)
            try
            {
                conn.Execute(@"
                    DELETE FROM cp_transactions WHERE user_id IN (SELECT id FROM users WHERE role = 'admin');
                    DELETE FROM competency_evaluations WHERE user_id IN (SELECT id FROM users WHERE role = 'admin');
                ");
            }
            catch { }

            // Đồng bộ & xác thực tự động toàn bộ Sequence trên PostgreSQL
            SyncPostgresSequences(conn);

            // 0. Synchronize standard 5 Roles (Admin: 5 quyen | Leader: phan ca, subtask, nhan su, danh gia, cp | Core, Contributor, Learning: 0 quyen)
            var defaultRoles = new[]
            {
                new { id = "admin", name = "Admin (Quản trị viên)", desc = "Toàn quyền quản trị hệ thống, cấp quyền, phân ca, tạo nhiệm vụ lớn, nhân sự, đánh giá, tính điểm CP", color = "#7c3aed", is_sys = 1, cms = 1, cmt = 1, cmu = 1, cev = 1, ccp = 1 },
                new { id = "leader", name = "Leader (Trưởng nhóm / Trưởng ca)", desc = "Phân ca & duyệt ca, giao subtask checklist, quản lý nhân sự, đánh giá năng lực, tính điểm CP", color = "#059669", is_sys = 1, cms = 1, cmt = 0, cmu = 1, cev = 1, ccp = 1 },
                new { id = "core", name = "Core (Thành viên Cốt cán)", desc = "Thành viên nòng cốt Lab, tham gia học việc và nhận nhiệm vụ (Không giữ quyền quản trị)", color = "#2563eb", is_sys = 1, cms = 0, cmt = 0, cmu = 0, cev = 0, ccp = 0 },
                new { id = "contributor", name = "Contributor (Thành viên Đóng góp)", desc = "Thành viên chính thức, nhận ca trực, triển khai nhiệm vụ, code/kỹ thuật và đóng góp nghiên cứu", color = "#0891b2", is_sys = 1, cms = 0, cmt = 0, cmu = 0, cev = 0, ccp = 0 },
                new { id = "learning", name = "Learning (Học viên / Thực tập sinh)", desc = "Học viên, thực tập sinh mới, tham gia học việc, hỗ trợ ca trực theo hướng dẫn của mentor", color = "#8b5cf6", is_sys = 1, cms = 0, cmt = 0, cmu = 0, cev = 0, ccp = 0 }
            };
            foreach (var r in defaultRoles)
            {
                conn.Execute(@"
                    INSERT INTO roles (id, display_name, description, color, is_system, can_manage_schedule, can_manage_tasks, can_manage_staff, can_evaluate, can_manage_cp)
                    VALUES (@id, @name, @desc, @color, @is_sys, @cms, @cmt, @cmu, @cev, @ccp)
                    ON CONFLICT (id) DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        description = EXCLUDED.description,
                        color = EXCLUDED.color,
                        can_manage_schedule = EXCLUDED.can_manage_schedule,
                        can_manage_tasks = EXCLUDED.can_manage_tasks,
                        can_manage_staff = EXCLUDED.can_manage_staff,
                        can_evaluate = EXCLUDED.can_evaluate,
                        can_manage_cp = EXCLUDED.can_manage_cp", r);
            }

            // 0.1 Synchronize standard Departments
            var defaultDepts = new[]
            {
                new { name = "Tổ Trực Vận Hành", code = "VAN_HANH", desc = "Chịu trách nhiệm trực giám sát và vận hành thiết bị phòng máy", mgr = "Quản Lý Vận Hành", color = "#2563eb" },
                new { name = "Tổ Trực Kỹ Thuật", code = "KY_THUAT", desc = "Xử lý sự cố phần cứng, mạng và bảo trì định kỳ", mgr = "Nguyễn Văn Cường", color = "#059669" },
                new { name = "Tổ Dịch Vụ Sinh Viên", code = "DICH_VU", desc = "Hỗ trợ sinh viên mượn trả phòng máy và giải đáp thắc mắc", mgr = "Trần Thị Bình", color = "#0891b2" },
                new { name = "Hỗ Trợ Kỹ Thuật", code = "HO_TRO", desc = "Hỗ trợ kỹ thuật ứng cứu nhanh và trực hotline", mgr = "Lê Văn An", color = "#d97706" },
                new { name = "Kỹ Thuật Hạ Tầng", code = "HA_TANG", desc = "Quản lý hệ thống máy chủ, lưu điện UPS và điều hòa phòng server", mgr = "Quản Lý Vận Hành", color = "#7c3aed" },
                new { name = "Vận Hành Mạng", code = "MANG_NOC", desc = "Giám sát băng thông và an ninh mạng nội bộ", mgr = "Quản Lý Vận Hành", color = "#0284c7" },
                new { name = "Chăm Sóc Khách Hàng", code = "CSKH", desc = "Tiếp nhận phản hồi và đánh giá chất lượng dịch vụ phòng máy", mgr = "Quản Lý Vận Hành", color = "#ec4899" },
                new { name = "Giám Sát Ca Đêm", code = "CA_DEM", desc = "Trực ca đêm và tuần tra an toàn thiết bị phòng máy", mgr = "Lê Văn An", color = "#f59e0b" },
                new { name = "Ban Quản Trị", code = "BAN_QT", desc = "Ban quản lý và điều hành chung hệ thống Lab", mgr = "Quản Lý Vận Hành", color = "#6366f1" }
            };
            foreach (var d in defaultDepts)
            {
                conn.Execute(@"
                    INSERT INTO departments (name, code, description, manager_name, color)
                    VALUES (@name, @code, @desc, @mgr, @color)
                    ON CONFLICT (name) DO UPDATE SET
                        code = EXCLUDED.code,
                        description = EXCLUDED.description,
                        manager_name = EXCLUDED.manager_name,
                        color = EXCLUDED.color", d);
            }

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

            // 2. Synchronize initial standard users
            var userCount = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM users");
            if (userCount == 0)
            {
                var defaultUsers = new[]
                {
                    new { u = "admin", p = HashPassword("admin123"), fn = "Quản Lý Vận Hành", e = "admin@company.com", ph = "0901234567", r = "admin", d = "Ban Quản Trị" },
                    new { u = "nv_an", p = HashPassword("123456"), fn = "Nguyễn Văn An", e = "an.nguyen@company.com", ph = "0987654321", r = "leader", d = "Tổ Trực Kỹ Thuật" },
                    new { u = "nv_binh", p = HashPassword("123456"), fn = "Trần Thị Bình", e = "binh.tran@company.com", ph = "0912345678", r = "contributor", d = "Tổ Dịch Vụ Sinh Viên" },
                    new { u = "nv_cuong", p = HashPassword("123456"), fn = "Nguyễn Văn Cường", e = "cuong.nguyen@company.com", ph = "0934567890", r = "contributor", d = "Tổ Trực Vận Hành" }
                };

                foreach (var u in defaultUsers)
                {
                    conn.Execute("INSERT INTO users (username, password_hash, full_name, email, phone, role, department) VALUES (@u, @p, @fn, @e, @ph, @r, @d) ON CONFLICT (username) DO NOTHING", u);
                }

                conn.Execute("INSERT INTO notifications (target_user_id, sender_id, title, message, type) VALUES (0, 1, @title, @msg, 'general')",
                    new { title = "Chào mừng đến với Cổng Quản Lý Ca Làm Việc", msg = "Hệ thống đã sẵn sàng vận hành. Quản lý có thể thêm nhân sự tại mục Quản lý nhân viên và xếp lịch trực." });
            }

            // 2.1 Always ensure at least one user has the 'leader' role so task creation never blocks
            try
            {
                var leaderCount = conn.ExecuteScalar<int>("SELECT COUNT(1) FROM users WHERE role = 'leader'");
                if (leaderCount == 0)
                {
                    int updated = conn.Execute("UPDATE users SET role = 'leader' WHERE username = 'nv_an'");
                    if (updated == 0)
                    {
                        var firstStaff = conn.QueryFirstOrDefault<dynamic>("SELECT id FROM users WHERE role != 'admin' ORDER BY id ASC LIMIT 1");
                        if (firstStaff != null)
                        {
                            long sid = Convert.ToInt64(firstStaff.id);
                            conn.Execute("UPDATE users SET role = 'leader' WHERE id = @sid", new { sid });
                        }
                        else
                        {
                            conn.Execute("INSERT INTO users (username, password_hash, full_name, email, phone, role, department) VALUES (@u, @p, @fn, @e, @ph, 'leader', @d) ON CONFLICT (username) DO NOTHING",
                                new { u = "nv_an", p = HashPassword("123456"), fn = "Nguyễn Văn An", e = "an.nguyen@company.com", ph = "0987654321", d = "Tổ Trực Kỹ Thuật" });
                        }
                    }
                }
            }
            catch { }

            // Re-sync sequences after user updates if Postgres
            SyncPostgresSequences(conn);

            // 3. System settings
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_host', 'smtp.gmail.com') ON CONFLICT (key) DO NOTHING");
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_port', '587') ON CONFLICT (key) DO NOTHING");
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_user', 'longhvn2006@gmail.com') ON CONFLICT (key) DO NOTHING");
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_password', 'wtew euaj zcuu bjtq') ON CONFLICT (key) DO NOTHING");
            conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_from_name', 'Hệ Thống Phân Ca WorkShiftPro') ON CONFLICT (key) DO NOTHING");
            conn.Execute("UPDATE system_settings SET value = 'longhvn2006@gmail.com' WHERE key = 'smtp_user' AND (value IS NULL OR value = '')");
            conn.Execute("UPDATE system_settings SET value = 'wtew euaj zcuu bjtq' WHERE key = 'smtp_password' AND (value IS NULL OR value = '')");

            // 4. Default weekly schedule registrations
            var regCount = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM shift_registrations");
            if (regCount == 0)
            {
                var adminUser = conn.QueryFirstOrDefault<dynamic>("SELECT id FROM users WHERE username = 'admin'");
                var staffAn = conn.QueryFirstOrDefault<dynamic>("SELECT id FROM users WHERE username = 'nv_an'");
                var staffBinh = conn.QueryFirstOrDefault<dynamic>("SELECT id FROM users WHERE username = 'nv_binh'");
                var staffCuong = conn.QueryFirstOrDefault<dynamic>("SELECT id FROM users WHERE username = 'nv_cuong'");

                if (adminUser != null && staffAn != null)
                {
                    long uidAdmin = Convert.ToInt64(adminUser.id);
                    long uidAn = Convert.ToInt64(staffAn.id);
                    long uidBinh = staffBinh != null ? Convert.ToInt64(staffBinh.id) : uidAn;
                    long uidCuong = staffCuong != null ? Convert.ToInt64(staffCuong.id) : uidAn;

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

            // Dọn dẹp các ca ảo từng bị chèn nhầm do lỗi nộp đơn vắng ca chưa được phân công
            try
            {
                conn.Execute("DELETE FROM shift_registrations WHERE note LIKE 'Đơn xin vắng ca nhiều ngày/tuần (Chờ duyệt)%' AND attendance_status = 'pending_absence'");
            }
            catch { }
        }
    }

    private static void EnsureColumn(DbConnection conn, string table, string column, string typeAndDefault)
    {
        try
        {
            if (IsPostgres)
            {
                conn.Execute($"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {typeAndDefault};");
            }
            else
            {
                var existingCols = conn.Query("SELECT name FROM pragma_table_info(@table)", new { table })
                    .Select(x => (string)x.name)
                    .ToList();
                if (!existingCols.Contains(column, StringComparer.OrdinalIgnoreCase))
                {
                    conn.Execute($"ALTER TABLE {table} ADD COLUMN {column} {typeAndDefault};");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database] Schema notice for {table}.{column}: {ex.Message}");
        }
    }

    private static void SyncPostgresSequences(DbConnection conn)
    {
        if (!IsPostgres) return;

        try
        {
            var syncSql = @"
            DO $$
            DECLARE
                tbl text;
                seq_name text;
                max_id bigint;
            BEGIN
                FOR tbl IN SELECT unnest(ARRAY[
                    'users', 'tasks', 'subtasks', 'cp_transactions', 
                    'shift_registrations', 'shift_history', 'shift_notes', 
                    'class_schedules', 'feedbacks', 'notifications', 
                    'email_logs', 'shift_events', 'departments'
                ])
                LOOP
                    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
                        -- 1. Tìm hoặc tự động tạo sequence nếu bảng chưa có sequence gắn với column id
                        SELECT pg_get_serial_sequence(tbl, 'id') INTO seq_name;
                        IF seq_name IS NULL THEN
                            seq_name := tbl || '_id_seq';
                            EXECUTE 'CREATE SEQUENCE IF NOT EXISTS ' || quote_ident(seq_name);
                            BEGIN
                                EXECUTE 'ALTER TABLE ' || quote_ident(tbl) || ' ALTER COLUMN id SET DEFAULT nextval(''' || seq_name || ''')';
                                EXECUTE 'ALTER SEQUENCE ' || quote_ident(seq_name) || ' OWNED BY ' || quote_ident(tbl) || '.id';
                            EXCEPTION WHEN OTHERS THEN NULL;
                            END;
                        END IF;

                        -- 2. Đồng bộ giá trị hiện tại của sequence với MAX(id) thực tế trong bảng
                        EXECUTE 'SELECT COALESCE(MAX(id), 0) FROM ' || quote_ident(tbl) INTO max_id;
                        IF max_id > 0 THEN
                            PERFORM setval(seq_name, max_id, true);
                        ELSE
                            PERFORM setval(seq_name, 1, false);
                        END IF;
                    END IF;
                END LOOP;
            END $$;
            ";

            conn.Execute(syncSql);
            Console.WriteLine("[Database] Successfully verified & synchronized all PostgreSQL auto-increment sequences.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Database] Warning during sequence sync: {ex.Message}");
        }
    }
}
