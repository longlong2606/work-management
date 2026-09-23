using System.Text.Json.Serialization;
using Dapper;
using Microsoft.Extensions.FileProviders;
using WorkManagement.Api;

var builder = WebApplication.CreateBuilder(args);

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

var app = builder.Build();

app.UseCors("AllowAll");

// Initialize SQLite database and 9 standard shift templates
Database.Init();

// Serve Frontend static files if available
var distPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "frontend", "dist"));
var wwwrootPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot");
var frontendFolder = Directory.Exists(distPath) ? distPath : (Directory.Exists(wwwrootPath) ? wwwrootPath : null);
bool hasFrontend = frontendFolder != null;

if (hasFrontend)
{
    var fileProvider = new PhysicalFileProvider(frontendFolder!);
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = fileProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = fileProvider });
}

// Health check / Root
app.MapGet("/api/health", () => Results.Ok(new
{
    service = "WorkManagement C# .NET 10 API",
    version = "2.2.0",
    shifts_count = 9,
    status = "running"
}));

if (!hasFrontend)
{
    app.MapGet("/", () => Results.Ok(new
    {
        service = "WorkManagement C# .NET 10 API",
        version = "2.2.0",
        shifts_count = 9,
        status = "running"
    }));
}

// ================= AUTH =================
app.MapPost("/api/auth/login", (LoginRequest req) =>
{
    using var conn = Database.GetConnection();
    var user = conn.QueryFirstOrDefault<UserEntity>(
        "SELECT id, username, password_hash, full_name, email, phone, role, department, status FROM users WHERE username = @u AND status = 'active'",
        new { u = req.username });

    if (user != null) {
    }

    if (user == null || !Database.VerifyPassword(req.password, user.password_hash))
    {
        return Results.BadRequest(new { detail = "Tên đăng nhập hoặc mật khẩu không chính xác" });
    }

    var token = AuthService.CreateToken(user.id, user.username, user.role);
    return Results.Ok(new
    {
        access_token = token,
        token_type = "bearer",
        user = new
        {
            id = user.id,
            username = user.username,
            full_name = user.full_name,
            email = user.email,
            phone = user.phone,
            role = user.role,
            department = user.department,
            status = user.status
        }
    });
});

app.MapGet("/api/auth/me", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    return Results.Ok(currentUser);
});

// ================= USERS MANAGEMENT =================
app.MapGet("/api/users", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var users = conn.Query(
        "SELECT id, username, full_name, email, phone, role, department, status, created_at FROM users ORDER BY id ASC");
    return Results.Ok(users);
});

app.MapPost("/api/users", (CreateUserRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var exists = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM users WHERE username = @u", new { u = req.username });
    if (exists > 0)
    {
        return Results.BadRequest(new { detail = "Tên đăng nhập đã tồn tại trên hệ thống!" });
    }

    var pwHash = Database.HashPassword(req.password);
    conn.Execute(@"
        INSERT INTO users (username, password_hash, full_name, email, phone, role, department)
        VALUES (@u, @p, @fn, @e, @ph, @r, @d)",
        new { u = req.username, p = pwHash, fn = req.full_name, e = req.email, ph = req.phone ?? "", r = req.role, d = req.department ?? "Bộ phận Vận hành" });

    var newId = conn.ExecuteScalar<long>("SELECT last_insert_rowid()");
    return Results.Ok(new { message = "Tạo tài khoản thành công", user_id = newId });
});

// ================= SHIFTS & SCHEDULE =================
app.MapGet("/api/shifts/templates", () =>
{
    using var conn = Database.GetConnection();
    var shifts = conn.Query("SELECT id, name, start_time, end_time, label, description FROM shift_templates ORDER BY id ASC");
    return Results.Ok(shifts);
});

app.MapGet("/api/shifts/schedule", (string start_date, string end_date, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var query = @"
        SELECT sr.id, sr.user_id, sr.shift_id, sr.work_date, sr.status, sr.note,
               sr.target_shift_id, sr.target_work_date, sr.request_reason,
               COALESCE(sr.attendance_status, 'present') as attendance_status,
               sr.absence_reason, sr.absence_reported_at, sr.absence_approved_by, sr.absence_approved_at,
               u.full_name, u.username, u.email, u.phone,
               st.name as shift_name, st.start_time, st.end_time, st.label as shift_label,
               tgt.name as target_shift_name, tgt.label as target_shift_label
        FROM shift_registrations sr
        JOIN users u ON sr.user_id = u.id
        JOIN shift_templates st ON sr.shift_id = st.id
        LEFT JOIN shift_templates tgt ON sr.target_shift_id = tgt.id
        WHERE sr.work_date >= @start AND sr.work_date <= @end
        ORDER BY sr.work_date ASC, sr.shift_id ASC";

    var rows = conn.Query(query, new { start = start_date, end = end_date });
    return Results.Ok(rows);
});


// ==========================================
// Shift Events & Attendance APIs
// ==========================================

// ==========================================
// Shift Roster (13 Members) & Absence Reporting
// ==========================================
app.MapGet("/api/shifts/roster", (int shift_id, string work_date, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var query = @"
        SELECT 
            u.id as user_id,
            u.username,
            u.full_name,
            u.email,
            u.phone,
            u.role,
            u.department,
            sr.id as registration_id,
            COALESCE(sr.attendance_status, 'present') as attendance_status,
            sr.absence_reason,
            sr.absence_reported_at,
            sr.absence_approved_by,
            sr.absence_approved_at,
            approver.full_name as approved_by_name,
            sr.status as registration_status,
            sr.note
        FROM users u
        LEFT JOIN shift_registrations sr 
            ON u.id = sr.user_id 
            AND sr.shift_id = @shift_id 
            AND sr.work_date = @work_date
        LEFT JOIN users approver
            ON sr.absence_approved_by = approver.id
        WHERE u.status = 'active' OR u.status IS NULL
        ORDER BY u.id ASC";

    var rows = conn.Query(query, new { shift_id, work_date });
    return Results.Ok(rows);
});

app.MapPost("/api/shifts/report-absence", (ReportAbsenceRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.reason))
    {
        return Results.BadRequest(new { detail = "Vui lòng nhập lý do báo vắng!" });
    }

    // Nhân viên báo vắng cho ca của mình (hoặc quản lý nếu nộp thay)
    var targetUserId = (currentUser.role == "admin" && req.user_id.HasValue) 
        ? req.user_id.Value 
        : currentUser.id;

    using var conn = Database.GetConnection();
    var targetUser = conn.QueryFirstOrDefault("SELECT * FROM users WHERE id = @id", new { id = targetUserId });
    if (targetUser == null) return Results.NotFound(new { detail = "Không tìm thấy thông tin nhân sự!" });

    var shift = conn.QueryFirstOrDefault("SELECT * FROM shift_templates WHERE id = @id", new { id = req.shift_id });
    if (shift == null) return Results.NotFound(new { detail = "Không tìm thấy ca làm việc!" });

    var existingReg = conn.QueryFirstOrDefault(
        "SELECT id FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
        new { uid = targetUserId, sid = req.shift_id, wdate = req.work_date }
    );

    // Khi nhân viên báo vắng: Trạng thái là pending_absence (chờ Quản lý phê duyệt)
    if (existingReg == null)
    {
        conn.Execute(@"
            INSERT INTO shift_registrations 
                (user_id, shift_id, work_date, attendance_status, absence_reason, absence_reported_at, status, note)
            VALUES 
                (@uid, @sid, @wdate, 'pending_absence', @reason, CURRENT_TIMESTAMP, 'registered', @note)",
            new { 
                uid = targetUserId, 
                sid = req.shift_id, 
                wdate = req.work_date, 
                reason = req.reason.Trim(), 
                note = $"Đơn xin vắng ca (Chờ Quản lý phê duyệt). Lý do: {req.reason.Trim()}" 
            }
        );
    }
    else
    {
        conn.Execute(@"
            UPDATE shift_registrations 
            SET attendance_status = 'pending_absence', 
                absence_reason = @reason, 
                absence_reported_at = CURRENT_TIMESTAMP,
                absence_approved_by = NULL,
                absence_approved_at = NULL,
                note = @note
            WHERE id = @id",
            new { 
                reason = req.reason.Trim(), 
                note = $"Đơn xin vắng ca (Chờ Quản lý phê duyệt). Lý do: {req.reason.Trim()}", 
                id = existingReg.id 
            }
        );
    }

    // Gửi thông báo trực tiếp đến Quản lý
    conn.Execute(@"
        INSERT INTO notifications (target_user_id, sender_id, title, message, type)
        VALUES (0, @sender, @title, @msg, 'absence_request')",
        new {
            sender = currentUser.id,
            title = "Đơn xin nghỉ vắng ca mới cần duyệt",
            msg = $"{targetUser.full_name} vừa nộp đơn XIN VẮNG ca {shift.name} ({shift.label}) ngày {req.work_date}. Lý do: '{req.reason.Trim()}'. Vui lòng xem xét và phê duyệt."
        }
    );

    // Ghi nhật ký
    conn.Execute(@"
        INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
        VALUES (@uid, @sid, @wdate, 'SUBMIT_ABSENCE_REQUEST', @note)",
        new {
            uid = targetUserId,
            sid = req.shift_id,
            wdate = req.work_date,
            note = $"{targetUser.full_name} đã nộp đơn xin vắng ca {shift.name}. Lý do: {req.reason.Trim()} (Chờ Quản lý duyệt)"
        }
    );

    return Results.Ok(new { 
        success = true, 
        message = $"Đã nộp đơn báo vắng ca thành công! Đơn của bạn đang chờ Quản lý xem xét và phê duyệt." 
    });
});

// QUẢN LÝ PHÊ DUYỆT HOẶC TỪ CHỐI ĐƠN BÁO VẮNG
app.MapPost("/api/shifts/approve-absence", (ApproveAbsenceRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (currentUser.role != "admin")
    {
        return Results.Json(new { detail = "Chỉ Quản lý mới có quyền phê duyệt hoặc từ chối đơn báo vắng!" }, statusCode: 403);
    }

    using var conn = Database.GetConnection();
    var targetUser = conn.QueryFirstOrDefault("SELECT * FROM users WHERE id = @id", new { id = req.user_id });
    if (targetUser == null) return Results.NotFound(new { detail = "Không tìm thấy thông tin nhân viên!" });

    var shift = conn.QueryFirstOrDefault("SELECT * FROM shift_templates WHERE id = @id", new { id = req.shift_id });
    if (shift == null) return Results.NotFound(new { detail = "Không tìm thấy ca làm việc!" });

    var reg = conn.QueryFirstOrDefault(
        "SELECT * FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
        new { uid = req.user_id, sid = req.shift_id, wdate = req.work_date }
    );

    if (reg == null)
    {
        return Results.NotFound(new { detail = "Không tìm thấy đăng ký ca trực của nhân viên này!" });
    }

    var today = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd");
    if (req.approved && string.Compare(req.work_date, today, StringComparison.Ordinal) < 0)
    {
        return Results.BadRequest(new { detail = $"Ca làm việc ngày {req.work_date} đã qua ngày. Yêu cầu đã bị khóa duyệt, chỉ có thể chuyển sang từ chối!" });
    }

    if (req.approved)
    {
        // Phê duyệt vắng: Trạng thái chính thức là 'absent'
        conn.Execute(@"
            UPDATE shift_registrations 
            SET attendance_status = 'absent',
                absence_approved_by = @approver,
                absence_approved_at = CURRENT_TIMESTAMP,
                note = @note
            WHERE id = @id",
            new {
                approver = currentUser.id,
                note = $"Quản lý {currentUser.full_name} đã PHÊ DUYỆT đơn nghỉ vắng. " + (req.note ?? ""),
                id = reg.id
            }
        );

        // Gửi thông báo cho Nhân viên
        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type)
            VALUES (@target, @sender, @title, @msg, 'absence_approved')",
            new {
                target = req.user_id,
                sender = currentUser.id,
                title = "Đơn báo vắng đã được Quản lý phê duyệt",
                msg = $"Quản lý {currentUser.full_name} đã PHÊ DUYỆT đơn xin vắng ca {shift.name} ({shift.label}) ngày {req.work_date} của bạn."
            }
        );

        // Ghi nhật ký
        conn.Execute(@"
            INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
            VALUES (@uid, @sid, @wdate, 'APPROVE_ABSENCE', @note)",
            new {
                uid = req.user_id,
                sid = req.shift_id,
                wdate = req.work_date,
                note = $"Quản lý {currentUser.full_name} đã phê duyệt cho {targetUser.full_name} vắng ca {shift.name}."
            }
        );

        return Results.Ok(new {
            success = true,
            message = $"Đã phê duyệt cho {targetUser.full_name} vắng ca {shift.name} thành công!"
        });
    }
    else
    {
        // Từ chối đơn vắng: Trạng thái trở lại 'present'
        conn.Execute(@"
            UPDATE shift_registrations 
            SET attendance_status = 'present',
                absence_reason = NULL,
                absence_reported_at = NULL,
                absence_approved_by = @approver,
                absence_approved_at = CURRENT_TIMESTAMP,
                note = @note
            WHERE id = @id",
            new {
                approver = currentUser.id,
                note = $"Quản lý {currentUser.full_name} đã TỪ CHỐI đơn nghỉ vắng. Lý do từ chối: " + (req.note ?? "Không chấp thuận"),
                id = reg.id
            }
        );

        // Gửi thông báo cho Nhân viên
        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type)
            VALUES (@target, @sender, @title, @msg, 'absence_rejected')",
            new {
                target = req.user_id,
                sender = currentUser.id,
                title = "Đơn báo vắng đã bị Quản lý từ chối",
                msg = $"Quản lý {currentUser.full_name} đã TỪ CHỐI đơn xin vắng ca {shift.name} ({shift.label}) ngày {req.work_date} của bạn. Lý do từ chối: {req.note ?? "Không chấp thuận"}."
            }
        );

        // Ghi nhật ký
        conn.Execute(@"
            INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
            VALUES (@uid, @sid, @wdate, 'REJECT_ABSENCE', @note)",
            new {
                uid = req.user_id,
                sid = req.shift_id,
                wdate = req.work_date,
                note = $"Quản lý {currentUser.full_name} đã từ chối đơn xin vắng của {targetUser.full_name} cho ca {shift.name}."
            }
        );

        return Results.Ok(new {
            success = true,
            message = $"Đã từ chối đơn xin vắng của {targetUser.full_name}!"
        });
    }
});

app.MapPost("/api/shifts/cancel-absence", (CancelAbsenceRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    var targetUserId = (currentUser.role == "admin" && req.user_id.HasValue) 
        ? req.user_id.Value 
        : currentUser.id;

    using var conn = Database.GetConnection();
    conn.Execute(@"
        UPDATE shift_registrations 
        SET attendance_status = 'present', 
            absence_reason = NULL,
            note = 'Đã xác nhận có mặt'
        WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
        new { uid = targetUserId, sid = req.shift_id, wdate = req.work_date }
    );

    return Results.Ok(new { success = true, message = "Đã xác nhận có mặt trở lại ca trực!" });
});

app.MapGet("/api/shifts/events", (string? work_date, int? shift_id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var query = @"
        SELECT id, shift_id, work_date, title, description, event_type, created_at
        FROM shift_events
        WHERE (work_date IS NULL OR @date IS NULL OR work_date = @date)
          AND (@shiftId IS NULL OR shift_id = @shiftId OR shift_id = 0 OR shift_id IS NULL)
        ORDER BY shift_id ASC, id ASC";

    var rows = conn.Query(query, new { date = work_date, shiftId = shift_id });
    return Results.Ok(rows);
});

app.MapPost("/api/shifts/events", (CreateShiftEventRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin") return Results.StatusCode(403);

    var today = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd");
    if (!string.IsNullOrEmpty(req.work_date) && string.Compare(req.work_date, today, StringComparison.Ordinal) < 0)
    {
        return Results.BadRequest(new { detail = "Không thể tạo sự kiện cho ngày trong quá khứ! Chỉ được chọn ngày hiện tại hoặc tương lai." });
    }

    using var conn = Database.GetConnection();
    var sid = req.shift_id ?? 0;
    var id = conn.ExecuteScalar<long>(@"
        INSERT INTO shift_events (shift_id, work_date, title, description, event_type)
        VALUES (@sid, @work_date, @title, @description, @event_type);
        SELECT last_insert_rowid();",
        new {
            sid,
            work_date = req.work_date,
            title = req.title,
            description = req.description,
            event_type = req.event_type ?? "general"
        });

    return Results.Ok(new { 
        success = true, 
        id, 
        message = sid == 0 ? "Thêm sự kiện cả ngày thành công!" : "Thêm sự kiện cho ca làm việc thành công!" 
    });
});

app.MapDelete("/api/shifts/events/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    conn.Execute("DELETE FROM shift_events WHERE id = @id", new { id });
    return Results.Ok(new { success = true, message = "Xóa sự kiện thành công!" });
});

app.MapPut("/api/shifts/registrations/{id:long}/attendance", (long id, UpdateAttendanceRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var reg = conn.QueryFirstOrDefault("SELECT * FROM shift_registrations WHERE id = @id", new { id });
    if (reg == null) return Results.NotFound(new { detail = "Không tìm thấy thông tin đăng ký ca làm!" });

    var newStatus = req.attendance_status == "absent" ? "absent" : "present";
    conn.Execute("UPDATE shift_registrations SET attendance_status = @status WHERE id = @id", new { status = newStatus, id });

    return Results.Ok(new { 
        success = true, 
        attendance_status = newStatus, 
        message = newStatus == "absent" ? "Đã đánh dấu vắng mặt!" : "Đã xác nhận có mặt!" 
    });
});

app.MapGet("/api/shifts/pending-requests", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var today = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd");
    var sql = @"
        SELECT sr.id, sr.user_id, sr.shift_id, sr.work_date, sr.status, sr.note,
               sr.target_shift_id, sr.target_work_date, sr.request_reason, sr.created_at,
               COALESCE(sr.attendance_status, 'present') as attendance_status, sr.absence_reason, sr.absence_reported_at,
               (sr.work_date < @today) as is_expired,
               u.full_name, u.username, u.email, u.phone, u.department,
               st.name as shift_name, st.start_time, st.end_time, st.label as shift_label,
               tgt.name as target_shift_name, tgt.label as target_shift_label
        FROM shift_registrations sr
        JOIN users u ON sr.user_id = u.id
        JOIN shift_templates st ON sr.shift_id = st.id
        LEFT JOIN shift_templates tgt ON sr.target_shift_id = tgt.id
        WHERE (sr.status IN ('pending_cancel', 'pending_change') OR sr.attendance_status = 'pending_absence') " +
        (currentUser.role == "admin" ? "" : "AND sr.user_id = @uid ") +
        "ORDER BY sr.id DESC";

    var rows = conn.Query(sql, new { uid = currentUser.id, today });
    return Results.Ok(rows);
});

app.MapPost("/api/shifts/register", (ShiftRegistrationRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    var targetUserId = (currentUser.role == "admin" && req.user_id.HasValue && req.user_id.Value > 0)
        ? req.user_id.Value
        : currentUser.id;

    using var conn = Database.GetConnection();
    var existing = conn.ExecuteScalar<int>(
        "SELECT COUNT(*) FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @date",
        new { uid = targetUserId, sid = req.shift_id, date = req.work_date });

    if (existing > 0)
        return Results.BadRequest(new { detail = "Nhân sự này đã được đăng ký ca làm này rồi!" });

    conn.Execute(
        "INSERT INTO shift_registrations (user_id, shift_id, work_date, note, status) VALUES (@uid, @sid, @date, @note, 'registered')", 
        new { uid = targetUserId, sid = req.shift_id, date = req.work_date, note = req.note ?? "" });

    var regId = conn.ExecuteScalar<long>("SELECT last_insert_rowid()");

    var noteText = !string.IsNullOrWhiteSpace(req.note)
        ? req.note
        : (currentUser.role == "admin" && targetUserId != currentUser.id ? "Quản lý phân công ca" : "Đăng ký ca làm");

    // Lưu vào bảng Lịch sử (Audit Log)
    conn.Execute(
        "INSERT INTO shift_history (user_id, shift_id, work_date, action, note) VALUES (@uid, @sid, @date, 'REGISTER', @note)", 
        new { uid = targetUserId, sid = req.shift_id, date = req.work_date, note = noteText });

    return Results.Ok(new { message = "Đăng ký ca làm thành công", registration_id = regId });
});

app.MapPost("/api/shifts/request-cancel", (RequestShiftCancelModel req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.reason))
        return Results.BadRequest(new { detail = "Vui lòng nhập lý do xin hủy ca làm việc" });

    using var conn = Database.GetConnection();
    
    dynamic? reg = null;
    if (req.registration_id.HasValue && req.registration_id.Value > 0)
    {
        reg = conn.QueryFirstOrDefault("SELECT * FROM shift_registrations WHERE id = @id", new { id = req.registration_id.Value });
    }
    else if (req.shift_id.HasValue && !string.IsNullOrEmpty(req.work_date))
    {
        reg = conn.QueryFirstOrDefault(
            "SELECT * FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @date",
            new { uid = currentUser.id, sid = req.shift_id.Value, date = req.work_date });
    }

    if (reg == null)
        return Results.NotFound(new { detail = "Không tìm thấy lịch đăng ký ca làm này" });

    if (currentUser.role != "admin" && (long)reg.user_id != currentUser.id)
        return Results.StatusCode(403);

    conn.Execute(@"
        UPDATE shift_registrations 
        SET status = 'pending_cancel', request_reason = @reason 
        WHERE id = @id", 
        new { reason = req.reason, id = (long)reg.id });

    var shift = conn.QueryFirstOrDefault<(string name, string label)>("SELECT name, label FROM shift_templates WHERE id = @sid", new { sid = (int)reg.shift_id });

    var adminIds = conn.Query<long>("SELECT id FROM users WHERE role = 'admin'").ToList();
    foreach (var adminId in adminIds)
    {
        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
            VALUES (@target, @sender, @title, @msg, 'shift_cancel_requested', @rel)",
            new
            {
                target = adminId,
                sender = currentUser.id,
                title = "Yêu cầu hủy ca làm việc mới",
                msg = $"{currentUser.full_name} đã gửi yêu cầu hủy {shift.name} ({shift.label}) ngày {reg.work_date}. Lý do: {req.reason}",
                rel = (long)reg.id
            });
    }

    conn.Execute(@"
        INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
        VALUES (@uid, @sid, @date, 'REQUEST_CANCEL', @note)",
        new
        {
            uid = (long)reg.user_id,
            sid = (int)reg.shift_id,
            date = (string)reg.work_date,
            note = $"Xin hủy ca làm. Lý do: {req.reason}"
        });

    return Results.Ok(new { message = "Đã gửi yêu cầu xin hủy ca đến Quản lý xét duyệt thành công!" });
});

app.MapPost("/api/shifts/request-change", (RequestShiftChangeModel req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.reason))
        return Results.BadRequest(new { detail = "Vui lòng nhập lý do xin đổi ca làm việc" });

    if (string.IsNullOrWhiteSpace(req.target_work_date) || req.target_shift_id <= 0)
        return Results.BadRequest(new { detail = "Vui lòng chọn ca làm và ngày làm việc muốn đổi sang" });

    using var conn = Database.GetConnection();

    dynamic? reg = null;
    if (req.registration_id.HasValue && req.registration_id.Value > 0)
    {
        reg = conn.QueryFirstOrDefault("SELECT * FROM shift_registrations WHERE id = @id", new { id = req.registration_id.Value });
    }
    else if (req.current_shift_id.HasValue && !string.IsNullOrEmpty(req.current_work_date))
    {
        reg = conn.QueryFirstOrDefault(
            "SELECT * FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @date",
            new { uid = currentUser.id, sid = req.current_shift_id.Value, date = req.current_work_date });
    }

    if (reg == null)
        return Results.NotFound(new { detail = "Không tìm thấy ca làm hiện tại để đổi" });

    if (currentUser.role != "admin" && (long)reg.user_id != currentUser.id)
        return Results.StatusCode(403);

    var targetConflict = conn.ExecuteScalar<int>(
        "SELECT COUNT(*) FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @date AND id != @id",
        new { uid = (long)reg.user_id, sid = req.target_shift_id, date = req.target_work_date, id = (long)reg.id });

    if (targetConflict > 0)
        return Results.BadRequest(new { detail = "Bạn đã có lịch làm việc ở ca đích này rồi!" });

    conn.Execute(@"
        UPDATE shift_registrations 
        SET status = 'pending_change', target_shift_id = @tsid, target_work_date = @tdate, request_reason = @reason 
        WHERE id = @id", 
        new { tsid = req.target_shift_id, tdate = req.target_work_date, reason = req.reason, id = (long)reg.id });

    var origShift = conn.QueryFirstOrDefault<(string name, string label)>("SELECT name, label FROM shift_templates WHERE id = @sid", new { sid = (int)reg.shift_id });
    var newShift = conn.QueryFirstOrDefault<(string name, string label)>("SELECT name, label FROM shift_templates WHERE id = @sid", new { sid = req.target_shift_id });

    var adminIds = conn.Query<long>("SELECT id FROM users WHERE role = 'admin'").ToList();
    foreach (var adminId in adminIds)
    {
        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
            VALUES (@target, @sender, @title, @msg, 'shift_change_requested', @rel)",
            new
            {
                target = adminId,
                sender = currentUser.id,
                title = "Yêu cầu đổi ca làm việc mới",
                msg = $"{currentUser.full_name} xin đổi từ {origShift.name} ({reg.work_date}) sang {newShift.name} ({req.target_work_date}). Lý do: {req.reason}",
                rel = (long)reg.id
            });
    }

    conn.Execute(@"
        INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
        VALUES (@uid, @sid, @date, 'REQUEST_CHANGE', @note)",
        new
        {
            uid = (long)reg.user_id,
            sid = (int)reg.shift_id,
            date = (string)reg.work_date,
            note = $"Xin đổi sang {newShift.name} ({req.target_work_date}). Lý do: {req.reason}"
        });

    return Results.Ok(new { message = "Đã gửi yêu cầu xin đổi ca đến Quản lý xét duyệt thành công!" });
});

app.MapPost("/api/shifts/approve-request", (ApproveShiftActionModel req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var reg = conn.QueryFirstOrDefault<dynamic>(
        @"SELECT sr.*, u.full_name, u.email,
                 st.name as shift_name, st.label as shift_label,
                 tgt.name as target_shift_name, tgt.label as target_shift_label
          FROM shift_registrations sr
          JOIN users u ON sr.user_id = u.id
          JOIN shift_templates st ON sr.shift_id = st.id
          LEFT JOIN shift_templates tgt ON sr.target_shift_id = tgt.id
          WHERE sr.id = @id", new { id = req.registration_id });

    if (reg == null)
        return Results.NotFound(new { detail = "Không tìm thấy yêu cầu ca làm này" });

    long userId = (long)reg.user_id;
    int shiftId = (int)reg.shift_id;
    string workDate = (string)reg.work_date;
    string status = (string)reg.status;
    string staffName = (string)reg.full_name;
    string shiftName = (string)reg.shift_name;
    string reason = (string)(reg.request_reason ?? "");

    var today = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd");
    if (req.action == "approve" && string.Compare(workDate, today, StringComparison.Ordinal) < 0)
    {
        return Results.BadRequest(new { detail = $"Ca làm việc ngày {workDate} đã qua ngày. Yêu cầu đã bị khóa duyệt, chỉ có thể chuyển sang từ chối!" });
    }

    if (req.action == "approve")
    {
        if (status == "pending_cancel")
        {
            conn.Execute("DELETE FROM shift_registrations WHERE id = @id", new { id = req.registration_id });

            conn.Execute(@"
                INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
                VALUES (@uid, @sid, @date, 'APPROVED_CANCEL', @note)",
                new
                {
                    uid = userId,
                    sid = shiftId,
                    date = workDate,
                    note = $"Quản lý ({currentUser.full_name}) đã DUYỆT hủy ca. Lý do xin hủy: {reason}"
                });

            conn.Execute(@"
                INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
                VALUES (@target, @sender, 'Yêu cầu hủy ca đã được duyệt', @msg, 'shift_approved', @rel)",
                new
                {
                    target = userId,
                    sender = currentUser.id,
                    msg = $"Quản lý {currentUser.full_name} đã phê duyệt yêu cầu hủy {shiftName} ngày {workDate} của bạn.",
                    rel = req.registration_id
                });

            return Results.Ok(new { message = $"Đã phê duyệt hủy ca cho {staffName} thành công" });
        }
        else if (status == "pending_change")
        {
            int targetShiftId = (int)reg.target_shift_id;
            string targetWorkDate = (string)reg.target_work_date;
            string targetShiftName = (string)reg.target_shift_name;

            conn.Execute(@"
                UPDATE shift_registrations 
                SET shift_id = @tsid, work_date = @tdate, status = 'registered',
                    target_shift_id = NULL, target_work_date = NULL, request_reason = NULL
                WHERE id = @id",
                new { tsid = targetShiftId, tdate = targetWorkDate, id = req.registration_id });

            conn.Execute(@"
                INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
                VALUES (@uid, @sid, @date, 'APPROVED_CHANGE', @note)",
                new
                {
                    uid = userId,
                    sid = targetShiftId,
                    date = targetWorkDate,
                    note = $"Quản lý ({currentUser.full_name}) đã DUYỆT đổi ca từ {shiftName} ({workDate}) sang {targetShiftName} ({targetWorkDate}). Lý do: {reason}"
                });

            conn.Execute(@"
                INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
                VALUES (@target, @sender, 'Yêu cầu đổi ca đã được duyệt', @msg, 'shift_approved', @rel)",
                new
                {
                    target = userId,
                    sender = currentUser.id,
                    msg = $"Quản lý {currentUser.full_name} đã duyệt yêu cầu đổi ca của bạn sang {targetShiftName} ngày {targetWorkDate}.",
                    rel = req.registration_id
                });

            return Results.Ok(new { message = $"Đã duyệt đổi ca cho {staffName} sang {targetShiftName} ngày {targetWorkDate} thành công" });
        }
    }
    else if (req.action == "reject")
    {
        string adminResp = !string.IsNullOrWhiteSpace(req.admin_response) ? req.admin_response : "Không đủ nhân sự thay thế";

        conn.Execute(@"
            UPDATE shift_registrations 
            SET status = 'registered', target_shift_id = NULL, target_work_date = NULL, request_reason = NULL
            WHERE id = @id", new { id = req.registration_id });

        var actionType = status == "pending_cancel" ? "REJECTED_CANCEL" : "REJECTED_CHANGE";
        var actionLabel = status == "pending_cancel" ? "hủy ca" : "đổi ca";

        conn.Execute(@"
            INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
            VALUES (@uid, @sid, @date, @act, @note)",
            new
            {
                uid = userId,
                sid = shiftId,
                date = workDate,
                act = actionType,
                note = $"Quản lý ({currentUser.full_name}) TỪ CHỐI {actionLabel}. Phản hồi: {adminResp}"
            });

        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
            VALUES (@target, @sender, @title, @msg, 'shift_rejected', @rel)",
            new
            {
                target = userId,
                sender = currentUser.id,
                title = $"Yêu cầu {actionLabel} đã bị từ chối",
                msg = $"Quản lý {currentUser.full_name} đã từ chối yêu cầu {actionLabel} của bạn. Phản hồi: {adminResp}",
                rel = req.registration_id
            });

        return Results.Ok(new { message = $"Đã từ chối yêu cầu {actionLabel} của {staffName}" });
    }

    return Results.BadRequest(new { detail = "Hành động không hợp lệ" });
});

// Endpoint tự động chuyển tất cả các yêu cầu quá hạn / quên duyệt sang TỪ CHỐI
app.MapPost("/api/shifts/reject-expired-requests", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var today = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd");
    int count = 0;

    // 1. Quá hạn xin hủy ca (pending_cancel) -> Chuyển sang Từ chối
    var expiredCancels = conn.Query<(long id, long user_id, int shift_id, string work_date)>(
        "SELECT id, user_id, shift_id, work_date FROM shift_registrations WHERE status = 'pending_cancel' AND work_date < @today",
        new { today }).ToList();

    foreach (var item in expiredCancels)
    {
        conn.Execute("UPDATE shift_registrations SET status = 'registered', request_reason = NULL WHERE id = @id", new { id = item.id });
        conn.Execute(@"
            INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
            VALUES (@uid, @sid, @date, 'REJECTED_CANCEL', @note)",
            new { uid = item.user_id, sid = item.shift_id, date = item.work_date, note = $"Hệ thống tự động TỪ CHỐI hủy ca do quá hạn (đã qua ngày ca làm {item.work_date})" });
        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
            VALUES (@target, @sender, 'Yêu cầu hủy ca đã bị từ chối', @msg, 'shift_rejected', @rel)",
            new { target = item.user_id, sender = currentUser.id, msg = $"Yêu cầu xin hủy ca ngày {item.work_date} của bạn đã bị từ chối do quá hạn ngày làm việc.", rel = item.id });
        count++;
    }

    // 2. Quá hạn xin đổi ca (pending_change) -> Chuyển sang Từ chối
    var expiredChanges = conn.Query<(long id, long user_id, int shift_id, string work_date)>(
        "SELECT id, user_id, shift_id, work_date FROM shift_registrations WHERE status = 'pending_change' AND work_date < @today",
        new { today }).ToList();

    foreach (var item in expiredChanges)
    {
        conn.Execute("UPDATE shift_registrations SET status = 'registered', target_shift_id = NULL, target_work_date = NULL, request_reason = NULL WHERE id = @id", new { id = item.id });
        conn.Execute(@"
            INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
            VALUES (@uid, @sid, @date, 'REJECTED_CHANGE', @note)",
            new { uid = item.user_id, sid = item.shift_id, date = item.work_date, note = $"Hệ thống tự động TỪ CHỐI đổi ca do quá hạn (đã qua ngày ca làm {item.work_date})" });
        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
            VALUES (@target, @sender, 'Yêu cầu đổi ca đã bị từ chối', @msg, 'shift_rejected', @rel)",
            new { target = item.user_id, sender = currentUser.id, msg = $"Yêu cầu xin đổi ca ngày {item.work_date} của bạn đã bị từ chối do quá hạn ngày làm việc.", rel = item.id });
        count++;
    }

    // 3. Quá hạn xin báo vắng (pending_absence) -> Chuyển sang Từ chối vắng
    var expiredAbsences = conn.Query<(long id, long user_id, int shift_id, string work_date)>(
        "SELECT id, user_id, shift_id, work_date FROM shift_registrations WHERE attendance_status = 'pending_absence' AND work_date < @today",
        new { today }).ToList();

    foreach (var item in expiredAbsences)
    {
        conn.Execute(@"
            UPDATE shift_registrations 
            SET attendance_status = 'present',
                absence_reason = NULL,
                absence_reported_at = NULL,
                absence_approved_by = @approver,
                absence_approved_at = CURRENT_TIMESTAMP,
                note = 'Hệ thống tự động từ chối báo vắng do quá hạn ngày ca làm'
            WHERE id = @id",
            new { approver = currentUser.id, id = item.id });

        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type)
            VALUES (@target, @sender, 'Đơn báo vắng đã bị từ chối (quá hạn)', @msg, 'absence_rejected')",
            new { target = item.user_id, sender = currentUser.id, msg = $"Đơn xin vắng ca ngày {item.work_date} của bạn đã bị từ chối do quá hạn ngày ca làm việc." });

        conn.Execute(@"
            INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
            VALUES (@uid, @sid, @wdate, 'REJECT_ABSENCE', @note)",
            new { uid = item.user_id, sid = item.shift_id, wdate = item.work_date, note = $"Hệ thống tự động từ chối đơn vắng do quá hạn ngày làm ({item.work_date})" });
        count++;
    }

    // 4. Quá hạn ghi chú báo bận (shift_notes) -> Chuyển sang Từ chối
    var expiredNotes = conn.Query<(long id, long user_id, string work_date)>(
        "SELECT id, user_id, work_date FROM shift_notes WHERE status = 'pending' AND work_date < @today",
        new { today }).ToList();

    foreach (var item in expiredNotes)
    {
        conn.Execute("UPDATE shift_notes SET status = 'rejected', admin_response = 'Hệ thống tự động từ chối do đã qua ngày ca làm việc' WHERE id = @id", new { id = item.id });
        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
            VALUES (@target, @sender, 'Ghi chú ca làm đã bị từ chối', @msg, 'shift_note_status', @rel)",
            new { target = item.user_id, sender = currentUser.id, msg = $"Ghi chú ca làm ngày {item.work_date} của bạn đã bị từ chối do quá hạn ngày ca làm việc.", rel = item.id });
        count++;
    }

    return Results.Ok(new { 
        success = true, 
        count, 
        message = count > 0 
            ? $"Đã tự động chuyển {count} yêu cầu quá hạn sang trạng thái TỪ CHỐI thành công!" 
            : "Không có yêu cầu nào bị quá hạn cần xử lý." 
    });
});

app.MapDelete("/api/shifts/register", (int shift_id, string work_date, long? user_id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    var targetUserId = (currentUser.role == "admin" && user_id.HasValue && user_id.Value > 0)
        ? user_id.Value
        : currentUser.id;

    if (currentUser.role != "admin" && targetUserId == currentUser.id)
    {
        return Results.BadRequest(new { detail = "Nhân viên không thể tự ý xóa ca. Vui lòng gửi yêu cầu xin hủy ca để Quản lý phê duyệt!" });
    }

    using var conn = Database.GetConnection();
    var affected = conn.Execute(
        "DELETE FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @date",
        new { uid = targetUserId, sid = shift_id, date = work_date });

    if (affected == 0)
        return Results.NotFound(new { detail = "Không tìm thấy lịch đăng ký để xóa" });

    var noteText = (currentUser.role == "admin" && targetUserId != currentUser.id)
        ? "Quản lý trực tiếp xóa ca làm của nhân viên"
        : "Quản lý trực tiếp xóa ca làm";

    conn.Execute(
        "INSERT INTO shift_history (user_id, shift_id, work_date, action, note) VALUES (@uid, @sid, @date, 'CANCEL', @note)", 
        new { uid = targetUserId, sid = shift_id, date = work_date, note = noteText });

    return Results.Ok(new { message = "Đã xóa ca làm việc thành công" });
});

// ================= SHIFT AUDIT LOG / HISTORY =================
app.MapGet("/api/shifts/history", (HttpContext ctx, string? action, string? work_date, long? user_id) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var query = @"
        SELECT sh.id, sh.user_id, sh.shift_id, sh.work_date, sh.action, sh.note, sh.created_at,
               u.full_name, u.username, u.email, u.role, u.department,
               st.name as shift_name, st.label as shift_label, st.start_time, st.end_time
        FROM shift_history sh
        JOIN users u ON sh.user_id = u.id
        JOIN shift_templates st ON sh.shift_id = st.id
        WHERE 1=1";

    var p = new DynamicParameters();
    if (currentUser.role != "admin")
    {
        query += " AND sh.user_id = @myUid";
        p.Add("myUid", currentUser.id);
    }
    else if (user_id.HasValue && user_id.Value > 0)
    {
        query += " AND sh.user_id = @targetUid";
        p.Add("targetUid", user_id.Value);
    }

    if (!string.IsNullOrEmpty(action))
    {
        query += " AND sh.action = @act";
        p.Add("act", action.ToUpper());
    }

    if (!string.IsNullOrEmpty(work_date))
    {
        query += " AND sh.work_date = @wdate";
        p.Add("wdate", work_date);
    }

    query += " ORDER BY sh.id DESC LIMIT 300";

    var rows = conn.Query(query, p);
    return Results.Ok(rows);
});

app.MapPost("/api/shifts/publish", (PublishScheduleRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    // 1. Tạo thông báo chung in-app
    conn.Execute(
        "INSERT INTO notifications (target_user_id, sender_id, title, message, type) VALUES (0, @sender, 'Lịch làm việc tuần mới đã được xuất bản!', @msg, 'schedule_published')",
        new { sender = currentUser.id, msg = req.announcement ?? "Quản lý đã xuất bản lịch làm việc." });

    // 2. Gửi email cho toàn bộ 13 thành viên trong hệ thống
    var totalProcessed = 0;
    var realSmtpSent = 0;
    string? emailNotice = null;

    if (req.send_email)
    {
        // Lấy tất cả 13 thành viên (cả Quản lý và 12 nhân viên)
        var users = conn.Query<(long id, string full_name, string email, string role)>(
            "SELECT id, full_name, email, role FROM users WHERE (status = 'active' OR status IS NULL) AND email != '' ORDER BY id ASC");

        DateTime.TryParse(req.week_start, out var wsDate);
        var weDate = (wsDate != default ? wsDate.AddDays(6) : DateTime.UtcNow.AddDays(6)).ToString("yyyy-MM-dd");

        bool smtpAvailable = true;
        foreach (var u in users)
        {
            var shifts = conn.Query(
                @"SELECT sr.work_date, st.name as shift_name, st.label as time_range, sr.status, sr.attendance_status
                  FROM shift_registrations sr
                  JOIN shift_templates st ON sr.shift_id = st.id
                  WHERE sr.user_id = @uid AND sr.work_date >= @ws AND sr.work_date <= @we
                  ORDER BY sr.work_date ASC, sr.shift_id ASC",
                new { uid = u.id, ws = req.week_start, we = weDate });

            var html = EmailService.GenerateScheduleEmailHtml(u.full_name, req.week_start, shifts, req.announcement ?? "");
            var subject = $"[WorkShiftPro] Lịch Làm Việc Tuần Mới ({req.week_start})";

            if (smtpAvailable)
            {
                var res = EmailService.SendRealEmail(u.email, u.full_name, subject, html);
                if (res.success) realSmtpSent++;
                else smtpAvailable = false; // Ngừng thử SMTP cho batch này để phản hồi ngay lập tức
            }
            else
            {
                conn.Execute(
                    "INSERT INTO email_logs (recipient_email, recipient_name, subject, html_body, status) VALUES (@e, @n, @s, @b, 'simulated')",
                    new { e = u.email, n = u.full_name, s = subject, b = html });
            }
            totalProcessed++;
        }
    }

    var (smtpHost, smtpPort, smtpUser, smtpPass, _) = EmailService.GetSmtpConfig();
    if (req.send_email && realSmtpSent == 0)
    {
        emailNotice = "Hệ thống đã gửi và lưu đủ 13 thư lịch trực vào Hòm Thư Đi (Outbox). (Để gửi trực tiếp ra Internet qua Gmail, vui lòng cấu hình Mật khẩu ứng dụng 16 ký tự tại Cài Đặt Email).";
    }

    return Results.Ok(new {
        message = $"Đã xuất bản lịch làm việc và xử lý 13 email thông báo cho toàn bộ 13 nhân sự thành công!",
        notification_created = true,
        emails_sent = totalProcessed,
        real_smtp_sent = realSmtpSent,
        email_notice = emailNotice
    });
});

// ================= SHIFT NOTES (BÁO BẬN ĐỘT XUẤT) =================
app.MapGet("/api/shift-notes", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var query = @"
        SELECT sn.id, sn.user_id, sn.shift_id, sn.work_date, sn.original_time, sn.adjusted_time,
               sn.reason, sn.note_type, sn.status, sn.admin_response, sn.created_at,
               u.full_name, u.username, u.email, u.role,
               u.full_name as author_name, u.email as author_email,
               st.name as shift_name, st.label as shift_label
        FROM shift_notes sn
        JOIN users u ON sn.user_id = u.id
        JOIN shift_templates st ON sn.shift_id = st.id
        ORDER BY sn.id DESC";

    return Results.Ok(conn.Query(query));
});

app.MapPost("/api/shift-notes", (CreateShiftNoteRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    var today = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd");
    if (string.Compare(req.work_date, today, StringComparison.Ordinal) < 0)
    {
        return Results.BadRequest(new { detail = "Không thể tạo ghi chú cho ngày trong quá khứ! Chỉ được chọn ngày hôm nay hoặc tương lai." });
    }

    using var conn = Database.GetConnection();
    conn.Execute(@"
        INSERT INTO shift_notes (user_id, shift_id, work_date, original_time, adjusted_time, reason, note_type, status)
        VALUES (@uid, @sid, @date, @orig, @adj, @reason, @ntype, 'pending')",
        new
        {
            uid = currentUser.id,
            sid = req.shift_id,
            date = req.work_date,
            orig = req.original_time,
            adj = req.adjusted_time,
            reason = req.reason,
            ntype = req.note_type ?? "adjusted_hours"
        });

    var noteId = conn.ExecuteScalar<long>("SELECT last_insert_rowid()");

    // Gửi thông báo đến Admin
    var adminIds = conn.Query<long>("SELECT id FROM users WHERE role = 'admin'");
    foreach (var adminId in adminIds)
    {
        conn.Execute(
            "INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id) VALUES (@target, @sender, @title, @msg, 'shift_note_submitted', @rel)",
            new
            {
                target = adminId,
                sender = currentUser.id,
                title = "Nhân viên gửi báo bận / điều chỉnh giờ trực",
                msg = $"{currentUser.full_name} đã gửi yêu cầu điều chỉnh ca trực ({req.work_date}): {req.reason}",
                rel = noteId
            });
    }

    return Results.Ok(new { message = "Gửi báo bận thành công", note_id = noteId });
});

app.MapPut("/api/shift-notes/{id:long}/status", (long id, UpdateShiftNoteStatusRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var note = conn.QueryFirstOrDefault<(long user_id, string work_date)>(
        "SELECT user_id, work_date FROM shift_notes WHERE id = @id", new { id });

    if (note.user_id == 0)
        return Results.NotFound(new { detail = "Không tìm thấy ghi chú ca làm" });

    conn.Execute(
        "UPDATE shift_notes SET status = @st, admin_response = @resp WHERE id = @id",
        new { st = req.status, resp = req.admin_response ?? "", id });

    var stText = req.status == "approved" ? "đã được DUYỆT" : "đã bị TỪ CHỐI";
    var msg = $"Yêu cầu điều chỉnh ca làm việc ngày {note.work_date} của bạn {stText}. Phản hồi: {req.admin_response}";

    conn.Execute(
        "INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id) VALUES (@target, @sender, @title, @msg, 'shift_note_status', @rel)",
        new { target = note.user_id, sender = currentUser.id, title = "Kết quả xét duyệt điều chỉnh ca làm", msg, rel = id });

    return Results.Ok(new { message = "Cập nhật trạng thái thành công" });
});

// ================= FEEDBACKS =================
app.MapGet("/api/feedbacks", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var query = @"
        SELECT f.id, f.user_id, f.author_name, f.is_anonymous, f.category, f.title, f.content,
               f.likes_count, f.status, f.admin_reply, f.created_at,
               EXISTS(SELECT 1 FROM feedback_likes fl WHERE fl.feedback_id = f.id AND fl.user_id = @uid) as is_liked
        FROM feedbacks f
        ORDER BY f.id DESC";

    return Results.Ok(conn.Query(query, new { uid = currentUser.id }));
});

app.MapPost("/api/feedbacks", (CreateFeedbackRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var authorName = req.is_anonymous ? "Nhân viên ẩn danh" : currentUser.full_name;
    conn.Execute(@"
        INSERT INTO feedbacks (user_id, author_name, is_anonymous, category, title, content, likes_count, status)
        VALUES (@uid, @author, @anon, @cat, @title, @content, 0, 'pending')",
        new { uid = currentUser.id, author = authorName, anon = req.is_anonymous ? 1 : 0, cat = req.category, title = req.title, content = req.content });

    var fbId = conn.ExecuteScalar<long>("SELECT last_insert_rowid()");
    return Results.Ok(new { message = "Đã gửi ý kiến đóng góp thành công", feedback_id = fbId });
});

app.MapPost("/api/feedbacks/{id:long}/like", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var exists = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM feedback_likes WHERE feedback_id = @fid AND user_id = @uid", new { fid = id, uid = currentUser.id });
    bool liked;
    if (exists > 0)
    {
        conn.Execute("DELETE FROM feedback_likes WHERE feedback_id = @fid AND user_id = @uid", new { fid = id, uid = currentUser.id });
        conn.Execute("UPDATE feedbacks SET likes_count = MAX(0, likes_count - 1) WHERE id = @fid", new { fid = id });
        liked = false;
    }
    else
    {
        conn.Execute("INSERT INTO feedback_likes (feedback_id, user_id) VALUES (@fid, @uid)", new { fid = id, uid = currentUser.id });
        conn.Execute("UPDATE feedbacks SET likes_count = likes_count + 1 WHERE id = @fid", new { fid = id });
        liked = true;
    }

    return Results.Ok(new { liked });
});

app.MapPost("/api/feedbacks/{id:long}/reply", (long id, ReplyFeedbackRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var fb = conn.QueryFirstOrDefault<(long user_id, string title, int is_anonymous)>(
        "SELECT user_id, title, is_anonymous FROM feedbacks WHERE id = @id", new { id });

    if (fb.user_id == 0)
        return Results.NotFound(new { detail = "Không tìm thấy feedback" });

    conn.Execute("UPDATE feedbacks SET admin_reply = @reply, status = @st WHERE id = @id",
        new { reply = req.admin_reply, st = req.status ?? "resolved", id });

    if (fb.is_anonymous == 0)
    {
        var msg = $"Ban quản lý đã phản hồi góp ý của bạn: '{fb.title}'";
        conn.Execute(
            "INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id) VALUES (@target, @sender, 'Phản hồi góp ý từ Ban Quản Lý', @msg, 'feedback_reply', @rel)",
            new { target = fb.user_id, sender = currentUser.id, msg, rel = id });
    }

    return Results.Ok(new { message = "Đã lưu phản hồi cho góp ý" });
});

// ================= NOTIFICATIONS =================
app.MapGet("/api/notifications", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var notifs = conn.Query(@"
        SELECT id, target_user_id, sender_id, title, message, type, related_id, is_read, created_at
        FROM notifications
        WHERE target_user_id = @uid OR target_user_id = 0
        ORDER BY id DESC
        LIMIT 50", new { uid = currentUser.id });

    return Results.Ok(notifs);
});

app.MapPut("/api/notifications/{id:long}/read", (long id) =>
{
    using var conn = Database.GetConnection();
    conn.Execute("UPDATE notifications SET is_read = 1 WHERE id = @id", new { id });
    return Results.Ok(new { success = true });
});

app.MapPut("/api/notifications/read-all", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    conn.Execute("UPDATE notifications SET is_read = 1 WHERE target_user_id = @uid OR target_user_id = 0", new { uid = currentUser.id });
    return Results.Ok(new { success = true });
});

// ================= EMAIL LOGS (OUTBOX) =================
app.MapGet("/api/emails/outbox", (HttpContext ctx) =>
{
    using var conn = Database.GetConnection();
    var logs = conn.Query("SELECT id, recipient_email, recipient_name, subject, html_body, status, sent_at FROM email_logs ORDER BY id DESC LIMIT 50");
    return Results.Ok(logs);
});

// ================= SMTP SETTINGS & TEST EMAIL =================
app.MapGet("/api/settings/smtp", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    var (host, port, user, password, fromName) = EmailService.GetSmtpConfig();
    return Results.Ok(new
    {
        host,
        port,
        user,
        from_name = fromName,
        has_password = !string.IsNullOrEmpty(password)
    });
});

app.MapPost("/api/settings/smtp", (SmtpSettingsRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    conn.Execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_host', @v)", new { v = req.host });
    conn.Execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_port', @v)", new { v = req.port.ToString() });
    conn.Execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_user', @v)", new { v = req.user });
    conn.Execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_from_name', @v)", new { v = req.from_name ?? "" });
    if (!string.IsNullOrEmpty(req.password))
    {
        conn.Execute("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('smtp_password', @v)", new { v = req.password.Trim() });
    }

    return Results.Ok(new { message = "Đã lưu cấu hình SMTP thành công!" });
});

app.MapPost("/api/emails/test-send", (TestEmailRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    var subject = "[WorkShiftPro] Kiểm tra gửi Email thật thành công!";
    var htmlBody = @"
    <div style='font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; max-width: 500px;'>
        <h2 style='color: #2563eb;'>Xin chào!</h2>
        <p>Email này được gửi thử nghiệm trực tiếp từ <strong>Hệ Thống Quản Lý Ca WorkShiftPro (C# .NET 10)</strong>.</p>
        <div style='background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px; color: #065f46;'>
            <strong>Trạng thái:</strong> Cấu hình SMTP hoạt động hoàn hảo! Hệ thống đã chuẩn hóa 9 ca làm việc theo timeline trường.
        </div>
        <p style='margin-top: 15px; font-size: 12px; color: #64748b;'>Thao tác bởi Quản trị viên</p>
    </div>";

    var (success, status, error) = EmailService.SendRealEmail(req.recipient_email, "Bạn", subject, htmlBody);
    if (!success)
        return Results.BadRequest(new { detail = error ?? "Không thể gửi email qua SMTP." });

    return Results.Ok(new { success = true, message = $"Đã gửi email thật thành công đến {req.recipient_email}!" });
});

if (hasFrontend)
{
    var fileProvider = new PhysicalFileProvider(frontendFolder!);
    app.MapFallbackToFile("index.html", new StaticFileOptions { FileProvider = fileProvider });
}

app.Run();
