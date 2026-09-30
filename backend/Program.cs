using System.Text.Json.Serialization;
using Dapper;
using Microsoft.Extensions.FileProviders;
using WorkManagement.Api;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://0.0.0.0:8000");

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

// ================= TASKS & CHECKLIST WORKFLOW =================
app.MapGet("/api/tasks", (
    string? status,
    string? task_type,
    long? leader_id,
    string? filter,
    string? search,
    HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var sql = @"
        SELECT 
            t.id, t.title, t.description, t.task_type, t.planned_date, t.deadline,
            t.location, t.customer_info, t.leader_id, t.created_by, t.status,
            t.postponed_reason, t.finished_at, t.created_at, t.updated_at,
            u1.full_name AS leader_name,
            u2.full_name AS creator_name,
            (SELECT COUNT(1) FROM subtasks s WHERE s.task_id = t.id) AS subtasks_count,
            (SELECT COUNT(1) FROM subtasks s WHERE s.task_id = t.id AND s.status = 'FINISHED') AS finished_subtasks_count,
            (SELECT COUNT(1) FROM subtasks s WHERE s.task_id = t.id AND s.status = 'REVIEW') AS review_subtasks_count,
            (SELECT COUNT(1) FROM subtasks s JOIN subtask_assignees sa ON s.id = sa.subtask_id WHERE s.task_id = t.id AND sa.user_id = @userId) AS my_subtasks_count
        FROM tasks t
        LEFT JOIN users u1 ON t.leader_id = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE 1=1";

    var p = new DynamicParameters();
    p.Add("userId", currentUser.id);

    if (!string.IsNullOrWhiteSpace(status))
    {
        sql += " AND t.status = @status";
        p.Add("status", status);
    }
    if (!string.IsNullOrWhiteSpace(task_type))
    {
        sql += " AND t.task_type = @task_type";
        p.Add("task_type", task_type);
    }
    if (leader_id.HasValue && leader_id.Value > 0)
    {
        sql += " AND t.leader_id = @leader_id";
        p.Add("leader_id", leader_id.Value);
    }
    if (!string.IsNullOrWhiteSpace(search))
    {
        sql += " AND (LOWER(t.title) LIKE @search OR LOWER(t.description) LIKE @search OR LOWER(t.location) LIKE @search)";
        p.Add("search", $"%{search.Trim().ToLower()}%");
    }

    if (filter == "my_tasks")
    {
        sql += " AND (t.leader_id = @userId OR (SELECT COUNT(1) FROM subtasks s JOIN subtask_assignees sa ON s.id = sa.subtask_id WHERE s.task_id = t.id AND sa.user_id = @userId) > 0)";
    }
    else if (filter == "my_led")
    {
        sql += " AND t.leader_id = @userId";
    }
    else if (filter == "needs_review")
    {
        sql += " AND (SELECT COUNT(1) FROM subtasks s WHERE s.task_id = t.id AND s.status = 'REVIEW') > 0";
    }

    sql += " ORDER BY CASE t.status WHEN 'IN_PROGRESS' THEN 1 WHEN 'OPEN' THEN 2 WHEN 'POSTPONED' THEN 4 ELSE 5 END, t.deadline ASC";

    var tasks = conn.Query(sql, p).ToList();
    return Results.Ok(tasks);
});

app.MapGet("/api/tasks/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var task = conn.QueryFirstOrDefault(@"
        SELECT 
            t.id, t.title, t.description, t.task_type, t.planned_date, t.deadline,
            t.location, t.customer_info, t.leader_id, t.created_by, t.status,
            t.postponed_reason, t.finished_at, t.created_at, t.updated_at,
            u1.full_name AS leader_name,
            u2.full_name AS creator_name,
            (SELECT COUNT(1) FROM subtasks s WHERE s.task_id = t.id) AS subtasks_count,
            (SELECT COUNT(1) FROM subtasks s WHERE s.task_id = t.id AND s.status = 'FINISHED') AS finished_subtasks_count,
            (SELECT COUNT(1) FROM subtasks s WHERE s.task_id = t.id AND s.status = 'REVIEW') AS review_subtasks_count,
            (SELECT COUNT(1) FROM subtasks s JOIN subtask_assignees sa ON s.id = sa.subtask_id WHERE s.task_id = t.id AND sa.user_id = @userId) AS my_subtasks_count
        FROM tasks t
        LEFT JOIN users u1 ON t.leader_id = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.id = @id", new { id, userId = currentUser.id });

    if (task == null) return Results.NotFound(new { detail = "Không tìm thấy nhiệm vụ yêu cầu!" });

    var subtasksRaw = conn.Query(@"
        SELECT 
            s.id, s.task_id, s.title, s.description, s.position, s.status,
            s.due_at, s.review_comment, s.submitted_for_review_at, s.finished_at,
            s.created_by, u.full_name AS creator_name, s.created_at, s.updated_at
        FROM subtasks s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.task_id = @id
        ORDER BY s.position ASC, s.created_at ASC", new { id }).ToList();

    var subtaskIds = subtasksRaw.Select(s => (long)s.id).ToList();
    var assigneesDict = new Dictionary<long, List<dynamic>>();
    if (subtaskIds.Any())
    {
        var assignees = conn.Query(@"
            SELECT sa.subtask_id, u.id AS user_id, u.full_name, u.username, u.role
            FROM subtask_assignees sa
            JOIN users u ON sa.user_id = u.id
            WHERE sa.subtask_id IN @subtaskIds", new { subtaskIds }).ToList();

        foreach (var a in assignees)
        {
            long sId = (long)a.subtask_id;
            if (!assigneesDict.ContainsKey(sId)) assigneesDict[sId] = new List<dynamic>();
            assigneesDict[sId].Add(new { user_id = (long)a.user_id, full_name = (string)a.full_name, username = (string)a.username, role = (string)a.role });
        }
    }

    var subtasks = subtasksRaw.Select(s => new
    {
        id = (long)s.id,
        task_id = (long)s.task_id,
        title = (string)s.title,
        description = (string?)s.description,
        position = (int)s.position,
        status = (string)s.status,
        due_at = (string?)s.due_at,
        review_comment = (string?)s.review_comment,
        submitted_for_review_at = (string?)s.submitted_for_review_at,
        finished_at = (string?)s.finished_at,
        created_by = (long)s.created_by,
        creator_name = (string?)s.creator_name,
        created_at = (string?)s.created_at?.ToString(),
        updated_at = (string?)s.updated_at?.ToString(),
        assignees = assigneesDict.ContainsKey((long)s.id) ? assigneesDict[(long)s.id] : new List<dynamic>()
    }).ToList();

    return Results.Ok(new
    {
        task = task,
        subtasks = subtasks
    });
});

app.MapPost("/api/tasks", (CreateTaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin") return Results.StatusCode(403);

    if (string.IsNullOrWhiteSpace(req.title))
        return Results.BadRequest(new { detail = "Tiêu đề nhiệm vụ không được để trống!" });
    if (string.IsNullOrWhiteSpace(req.deadline))
        return Results.BadRequest(new { detail = "Hạn chót (Deadline) không được để trống!" });
    if (req.leader_id <= 0)
        return Results.BadRequest(new { detail = "Vui lòng chỉ định Trưởng nhóm (Leader) phụ trách!" });

    using var conn = Database.GetConnection();
    var taskId = conn.ExecuteScalar<long>(@"
        INSERT INTO tasks (title, description, task_type, planned_date, deadline, location, customer_info, leader_id, created_by, status, created_at, updated_at)
        VALUES (@title, @description, @task_type, @planned_date, @deadline, @location, @customer_info, @leader_id, @created_by, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        SELECT last_insert_rowid();",
        new
        {
            title = req.title.Trim(),
            description = req.description?.Trim(),
            task_type = string.IsNullOrWhiteSpace(req.task_type) ? "LAB_MAINTENANCE" : req.task_type.Trim(),
            planned_date = string.IsNullOrWhiteSpace(req.planned_date) ? DateTime.UtcNow.ToString("yyyy-MM-dd") : req.planned_date.Trim(),
            deadline = req.deadline.Trim(),
            location = req.location?.Trim(),
            customer_info = req.customer_info?.Trim(),
            leader_id = req.leader_id,
            created_by = currentUser.id
        });

    return Results.Ok(new { message = "Đã khởi tạo nhiệm vụ thành công!", task_id = taskId });
});

app.MapPut("/api/tasks/{id:long}", (long id, UpdateTaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var existing = conn.QueryFirstOrDefault<dynamic>("SELECT id, leader_id, status FROM tasks WHERE id = @id", new { id });
    if (existing == null) return Results.NotFound(new { detail = "Nhiệm vụ không tồn tại!" });

    if (currentUser.role != "admin" && (long)existing.leader_id != currentUser.id)
        return Results.StatusCode(403);

    conn.Execute(@"
        UPDATE tasks SET 
            title = @title, description = @description, task_type = @task_type,
            planned_date = @planned_date, deadline = @deadline, location = @location,
            customer_info = @customer_info, leader_id = @leader_id, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id",
        new
        {
            id,
            title = req.title.Trim(),
            description = req.description?.Trim(),
            task_type = string.IsNullOrWhiteSpace(req.task_type) ? "LAB_MAINTENANCE" : req.task_type.Trim(),
            planned_date = string.IsNullOrWhiteSpace(req.planned_date) ? DateTime.UtcNow.ToString("yyyy-MM-dd") : req.planned_date.Trim(),
            deadline = req.deadline.Trim(),
            location = req.location?.Trim(),
            customer_info = req.customer_info?.Trim(),
            leader_id = req.leader_id
        });

    return Results.Ok(new { message = "Đã cập nhật thông tin nhiệm vụ thành công!" });
});

app.MapPost("/api/tasks/{id:long}/postpone", (long id, PostponeTaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin") return Results.StatusCode(403);

    if (string.IsNullOrWhiteSpace(req.reason))
        return Results.BadRequest(new { detail = "Vui lòng nhập lý do tạm hoãn nhiệm vụ!" });

    using var conn = Database.GetConnection();
    var rows = conn.Execute(@"
        UPDATE tasks SET status = 'POSTPONED', postponed_reason = @reason, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id", new { id, reason = req.reason.Trim() });

    if (rows == 0) return Results.NotFound(new { detail = "Nhiệm vụ không tồn tại!" });
    return Results.Ok(new { message = "Đã chuyển trạng thái nhiệm vụ sang Tạm hoãn!" });
});

app.MapPost("/api/tasks/{id:long}/finish", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var task = conn.QueryFirstOrDefault<dynamic>("SELECT id, leader_id, status FROM tasks WHERE id = @id", new { id });
    if (task == null) return Results.NotFound(new { detail = "Nhiệm vụ không tồn tại!" });

    if (currentUser.role != "admin" && (long)task.leader_id != currentUser.id)
        return Results.StatusCode(403);

    var subtaskStats = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT 
            COUNT(1) AS total,
            SUM(CASE WHEN status = 'FINISHED' THEN 1 ELSE 0 END) AS finished
        FROM subtasks WHERE task_id = @id", new { id });

    int total = (int)(subtaskStats?.total ?? 0);
    int finished = (int)(subtaskStats?.finished ?? 0);

    if (total == 0)
        return Results.BadRequest(new { detail = "Nhiệm vụ chưa có mục checklist nào. Cần tạo và hoàn thành các mục checklist trước khi kết thúc nhiệm vụ!" });

    if (total != finished)
        return Results.BadRequest(new { detail = $"Còn {total - finished} mục checklist chưa hoàn thành. Cần hoàn thành toàn bộ checklist để kết thúc nhiệm vụ!" });

    conn.Execute(@"
        UPDATE tasks SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id", new { id });

    return Results.Ok(new { message = "Chúc mừng! Nhiệm vụ đã hoàn thành xuất sắc toàn bộ mục checklist!" });
});

app.MapDelete("/api/tasks/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    conn.Execute("DELETE FROM subtask_assignees WHERE subtask_id IN (SELECT id FROM subtasks WHERE task_id = @id)", new { id });
    conn.Execute("DELETE FROM subtasks WHERE task_id = @id", new { id });
    int rows = conn.Execute("DELETE FROM tasks WHERE id = @id", new { id });

    if (rows == 0) return Results.NotFound(new { detail = "Nhiệm vụ không tồn tại!" });
    return Results.Ok(new { message = "Đã xóa nhiệm vụ và toàn bộ checklist liên quan thành công!" });
});

// ================= SUBTASKS (CHECKLIST) =================
app.MapPost("/api/tasks/{taskId:long}/subtasks", (long taskId, CreateSubtaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var task = conn.QueryFirstOrDefault<dynamic>("SELECT id, leader_id, status FROM tasks WHERE id = @taskId", new { taskId });
    if (task == null) return Results.NotFound(new { detail = "Nhiệm vụ cha không tồn tại!" });

    if (currentUser.role != "admin" && (long)task.leader_id != currentUser.id)
        return Results.StatusCode(403);

    if (string.IsNullOrWhiteSpace(req.title))
        return Results.BadRequest(new { detail = "Tiêu đề mục việc checklist không được để trống!" });

    int pos = conn.ExecuteScalar<int>("SELECT COALESCE(MAX(position), 0) + 1 FROM subtasks WHERE task_id = @taskId", new { taskId });

    long subtaskId = conn.ExecuteScalar<long>(@"
        INSERT INTO subtasks (task_id, title, description, position, status, due_at, created_by, created_at, updated_at)
        VALUES (@taskId, @title, @description, @pos, 'PROCESSING', @due_at, @createdBy, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        SELECT last_insert_rowid();",
        new
        {
            taskId,
            title = req.title.Trim(),
            description = req.description?.Trim(),
            pos,
            due_at = req.due_at?.Trim(),
            createdBy = currentUser.id
        });

    if (req.assignee_ids != null && req.assignee_ids.Any())
    {
        foreach (var uid in req.assignee_ids)
        {
            conn.Execute("INSERT OR IGNORE INTO subtask_assignees (subtask_id, user_id) VALUES (@subtaskId, @uid)", new { subtaskId, uid });
        }
    }

    // Auto transition parent task from OPEN to IN_PROGRESS
    if ((string)task.status == "OPEN")
    {
        conn.Execute("UPDATE tasks SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = @taskId", new { taskId });
    }

    return Results.Ok(new { message = "Đã thêm mục checklist mới vào nhiệm vụ!", subtask_id = subtaskId });
});

app.MapPut("/api/subtasks/{id:long}", (long id, UpdateSubtaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, s.task_id, t.leader_id 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục checklist không tồn tại!" });
    if (currentUser.role != "admin" && (long)subtask.leader_id != currentUser.id)
        return Results.StatusCode(403);

    if (string.IsNullOrWhiteSpace(req.title))
        return Results.BadRequest(new { detail = "Tiêu đề không được để trống!" });

    conn.Execute(@"
        UPDATE subtasks SET 
            title = @title, description = @description, due_at = @due_at, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id",
        new
        {
            id,
            title = req.title.Trim(),
            description = req.description?.Trim(),
            due_at = req.due_at?.Trim()
        });

    if (req.assignee_ids != null)
    {
        conn.Execute("DELETE FROM subtask_assignees WHERE subtask_id = @id", new { id });
        foreach (var uid in req.assignee_ids)
        {
            conn.Execute("INSERT OR IGNORE INTO subtask_assignees (subtask_id, user_id) VALUES (@id, @uid)", new { id, uid });
        }
    }

    return Results.Ok(new { message = "Đã cập nhật mục checklist thành công!" });
});

app.MapPost("/api/subtasks/{id:long}/submit", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, s.status, s.task_id, t.leader_id 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục checklist không tồn tại!" });

    bool isAssigned = conn.ExecuteScalar<int>("SELECT COUNT(1) FROM subtask_assignees WHERE subtask_id = @id AND user_id = @uid", new { id, uid = currentUser.id }) > 0;
    bool isLeaderOrAdmin = currentUser.role == "admin" || (long)subtask.leader_id == currentUser.id;

    if (!isAssigned && !isLeaderOrAdmin)
        return Results.StatusCode(403);

    if ((string)subtask.status != "PROCESSING")
        return Results.BadRequest(new { detail = $"Chỉ có thể nộp duyệt khi trạng thái đang là Đang thực hiện. Hiện tại: {subtask.status}" });

    conn.Execute(@"
        UPDATE subtasks SET 
            status = 'REVIEW', submitted_for_review_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id", new { id });

    return Results.Ok(new { message = "Đã nộp duyệt mục checklist! Vui lòng chờ Trưởng nhóm nghiệm thu." });
});

app.MapPost("/api/subtasks/{id:long}/review", (long id, ReviewSubtaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, s.status, s.task_id, t.leader_id 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục checklist không tồn tại!" });

    if (currentUser.role != "admin" && (long)subtask.leader_id != currentUser.id)
        return Results.StatusCode(403);

    if ((string)subtask.status != "REVIEW")
        return Results.BadRequest(new { detail = $"Chỉ có thể duyệt khi mục việc đang ở trạng thái Chờ duyệt (REVIEW). Hiện tại: {subtask.status}" });

    if (req.approve)
    {
        conn.Execute(@"
            UPDATE subtasks SET 
                status = 'FINISHED', review_comment = @comment, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = @id",
            new
            {
                id,
                comment = string.IsNullOrWhiteSpace(req.comment) ? "Đã nghiệm thu đạt chuẩn" : req.comment.Trim()
            });

        return Results.Ok(new { message = "Đã duyệt ĐẠT mục checklist thành công!" });
    }
    else
    {
        if (string.IsNullOrWhiteSpace(req.comment))
            return Results.BadRequest(new { detail = "Vui lòng nhập nhận xét/lý do yêu cầu làm lại!" });

        conn.Execute(@"
            UPDATE subtasks SET 
                status = 'PROCESSING', review_comment = @comment, updated_at = CURRENT_TIMESTAMP
            WHERE id = @id",
            new
            {
                id,
                comment = req.comment.Trim()
            });

        return Results.Ok(new { message = "Đã yêu cầu thành viên chỉnh sửa lại theo nhận xét!" });
    }
});

app.MapDelete("/api/subtasks/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, t.leader_id 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục checklist không tồn tại!" });

    if (currentUser.role != "admin" && (long)subtask.leader_id != currentUser.id)
        return Results.StatusCode(403);

    conn.Execute("DELETE FROM subtask_assignees WHERE subtask_id = @id", new { id });
    conn.Execute("DELETE FROM subtasks WHERE id = @id", new { id });

    return Results.Ok(new { message = "Đã xóa mục checklist thành công!" });
});

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

// ================= TV DISPLAY (KIOSK MODE) =================
app.MapGet("/api/tv/today", (string? date) =>
{
    var targetDate = string.IsNullOrWhiteSpace(date) ? DateTime.Now.ToString("yyyy-MM-dd") : date;
    using var conn = Database.GetConnection();

    var regQuery = @"
        SELECT sr.id, sr.user_id, sr.shift_id, sr.work_date, sr.status, sr.note,
               COALESCE(sr.attendance_status, 'present') as attendance_status,
               sr.actual_hours, sr.time_note,
               sr.absence_reason,
               u.full_name, u.username, u.email, u.phone,
               st.name as shift_name, st.start_time, st.end_time, st.label as shift_label
        FROM shift_registrations sr
        JOIN users u ON sr.user_id = u.id
        JOIN shift_templates st ON sr.shift_id = st.id
        WHERE sr.work_date = @date
        ORDER BY sr.shift_id ASC, u.full_name ASC";
    var regs = conn.Query(regQuery, new { date = targetDate });

    var eventQuery = @"
        SELECT se.id, se.shift_id, se.work_date, se.title, se.description, se.event_type, se.created_at,
               st.name as shift_name, st.label as shift_label
        FROM shift_events se
        LEFT JOIN shift_templates st ON se.shift_id = st.id
        WHERE se.work_date IS NULL OR se.work_date = @date
        ORDER BY se.shift_id ASC, se.id ASC";
    var events = conn.Query(eventQuery, new { date = targetDate });

    var templates = conn.Query("SELECT id, name, start_time, end_time, label, description FROM shift_templates WHERE id > 0 ORDER BY id ASC");

    return Results.Ok(new
    {
        date = targetDate,
        server_time = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss"),
        shifts = templates,
        registrations = regs,
        events = events
    });
});

// ================= AUTH =================
app.MapPost("/api/auth/forgot-password", (ForgotPasswordRequest req) =>
{
    if (string.IsNullOrWhiteSpace(req.identifier))
    {
        return Results.BadRequest(new { detail = "Vui lòng nhập tên đăng nhập hoặc email đã đăng ký!" });
    }

    using var conn = Database.GetConnection();
    var user = conn.QueryFirstOrDefault<UserEntity>(
        "SELECT id, username, full_name, email, phone, role FROM users WHERE LOWER(username) = LOWER(@id) OR LOWER(email) = LOWER(@id)",
        new { id = req.identifier.Trim() });

    if (user == null)
    {
        return Results.NotFound(new { detail = "Không tìm thấy tài khoản tương ứng với thông tin bạn cung cấp!" });
    }

    if (string.IsNullOrWhiteSpace(user.email))
    {
        return Results.BadRequest(new { detail = "Tài khoản này chưa được cấu hình địa chỉ email nhận thư!" });
    }

    // Tạo mật khẩu mới ngẫu nhiên 8 ký tự
    var tempPassword = "WM" + Random.Shared.Next(100000, 999999).ToString();
    var pwHash = Database.HashPassword(tempPassword);

    conn.Execute("UPDATE users SET password_hash = @hash WHERE id = @id", new { hash = pwHash, id = user.id });

    // Soạn email gửi thông báo
    var emailHtml = $@"
    <div style=""font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;"">
        <div style=""text-align: center; margin-bottom: 20px;"">
            <h2 style=""color: #2563eb; margin: 0;"">Khôi Phục Mật Khẩu - WorkShiftPro</h2>
            <p style=""font-size: 13px; color: #64748b; margin: 4px 0 0 0;"">Cổng Thông Tin & Quản Lý Phân Ca</p>
        </div>
        <p>Xin chào <strong>{user.full_name}</strong> (Tên đăng nhập: <code>{user.username}</code>),</p>
        <p>Hệ thống nhận được yêu cầu cấp lại mật khẩu đăng nhập cho tài khoản của bạn. Mật khẩu mới đã được khởi tạo và gửi riêng tới email này:</p>
        <div style=""background: #eff6ff; padding: 18px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1.5px dashed #3b82f6;"">
            <p style=""margin: 0 0 6px 0; font-size: 13px; color: #475569;"">Mật khẩu đăng nhập mới của bạn là:</p>
            <span style=""font-size: 26px; font-weight: bold; letter-spacing: 2px; color: #1d4ed8; font-family: monospace;"">{tempPassword}</span>
        </div>
        <div style=""background: #f8fafc; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 4px; font-size: 12px; color: #78350f; margin-bottom: 16px;"">
            <strong>Lưu ý bảo mật:</strong> Vui lòng dùng mật khẩu trên để đăng nhập. Sau khi vào hệ thống, bạn nên bấm vào nút <strong>🔑 Đổi mật khẩu</strong> ở thanh điều hướng để đổi sang mật khẩu riêng.
        </div>
        <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;"" />
        <p style=""font-size: 11px; color: #94a3b8; margin: 0; text-align: center;"">WorkShiftPro - Email tự động từ hệ thống quản lý ca trực.</p>
    </div>";

    // Gửi email thật qua SMTP
    try
    {
        EmailService.SendRealEmail(user.email, user.full_name, "Mật khẩu mới đăng nhập hệ thống WorkShiftPro", emailHtml);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Email Error] Lỗi gửi email: {ex.Message}");
    }

    return Results.Ok(new
    {
        success = true,
        message = $"Mật khẩu mới đã được gửi thẳng tới email: {user.email}. Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam) để nhận mật khẩu.",
        email = user.email,
        full_name = user.full_name,
        username = user.username
    });
});

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

app.MapPost("/api/auth/change-password", (ChangePasswordRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.new_password) || req.new_password.Length < 6)
    {
        return Results.BadRequest(new { detail = "Mật khẩu mới phải có tối thiểu 6 ký tự!" });
    }

    using var conn = Database.GetConnection();
    var user = conn.QueryFirstOrDefault<UserEntity>(
        "SELECT id, password_hash FROM users WHERE id = @id", new { id = currentUser.id });

    if (user == null || !Database.VerifyPassword(req.old_password, user.password_hash))
    {
        return Results.BadRequest(new { detail = "Mật khẩu hiện tại không chính xác!" });
    }

    var newHash = Database.HashPassword(req.new_password);
    conn.Execute("UPDATE users SET password_hash = @hash WHERE id = @id", new { hash = newHash, id = currentUser.id });

    return Results.Ok(new { message = "Đổi mật khẩu thành công!" });
});

app.MapPut("/api/auth/profile", (UpdateProfileRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.full_name) || string.IsNullOrWhiteSpace(req.email))
    {
        return Results.BadRequest(new { detail = "Họ và tên, Email không được để trống!" });
    }

    using var conn = Database.GetConnection();
    conn.Execute(@"
        UPDATE users 
        SET full_name = @fn, email = @e, phone = @ph 
        WHERE id = @id",
        new { fn = req.full_name, e = req.email, ph = req.phone ?? "", id = currentUser.id });

    var updated = conn.QueryFirstOrDefault<UserEntity>(
        "SELECT id, username, full_name, email, phone, role, department, status FROM users WHERE id = @id",
        new { id = currentUser.id });

    return Results.Ok(new { message = "Cập nhật thông tin thành công!", user = updated });
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
    var newId = conn.ExecuteScalar<long>(@"
        INSERT INTO users (username, password_hash, full_name, email, phone, role, department)
        VALUES (@u, @p, @fn, @e, @ph, @r, @d) RETURNING id;",
        new { u = req.username, p = pwHash, fn = req.full_name, e = req.email, ph = req.phone ?? "", r = req.role, d = req.department ?? "Bộ phận Vận hành" });
    return Results.Ok(new { message = "Tạo tài khoản thành công", user_id = newId });
});

app.MapPost("/api/users/{id:long}/reset-password", (long id, ResetPasswordRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    if (string.IsNullOrWhiteSpace(req.new_password) || req.new_password.Length < 6)
    {
        return Results.BadRequest(new { detail = "Mật khẩu mới phải có tối thiểu 6 ký tự!" });
    }

    using var conn = Database.GetConnection();
    var exists = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM users WHERE id = @id", new { id });
    if (exists == 0) return Results.NotFound(new { detail = "Không tìm thấy người dùng!" });

    var newHash = Database.HashPassword(req.new_password);
    conn.Execute("UPDATE users SET password_hash = @hash WHERE id = @id", new { hash = newHash, id });

    return Results.Ok(new { message = "Đã đặt lại mật khẩu mới cho tài khoản thành công!" });
});

app.MapPut("/api/users/{id:long}", (long id, UpdateUserRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var exists = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM users WHERE id = @id", new { id });
    if (exists == 0) return Results.NotFound(new { detail = "Không tìm thấy người dùng!" });

    conn.Execute(@"
        UPDATE users 
        SET full_name = @fn, email = @e, phone = @ph, department = @d, role = @r, status = @s
        WHERE id = @id",
        new { fn = req.full_name, e = req.email, ph = req.phone ?? "", d = req.department ?? "Bộ phận Vận hành", r = req.role, s = req.status ?? "active", id });

    return Results.Ok(new { message = "Cập nhật thông tin nhân sự thành công!" });
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
// Shift Roster & Absence Reporting
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
            sr.actual_hours,
            sr.time_note,
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

app.MapPost("/api/shifts/report-absence-bulk", (BulkReportAbsenceRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(req.reason))
    {
        return Results.BadRequest(new { detail = "Vui lòng nhập lý do báo vắng!" });
    }

    var targetUserId = (currentUser.role == "admin" && req.user_id.HasValue) 
        ? req.user_id.Value 
        : currentUser.id;

    using var conn = Database.GetConnection();
    var targetUser = conn.QueryFirstOrDefault("SELECT * FROM users WHERE id = @id", new { id = targetUserId });
    if (targetUser == null) return Results.NotFound(new { detail = "Không tìm thấy thông tin nhân sự!" });

    var todayStr = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd");

    // Gather dates
    var targetDates = new HashSet<string>();
    if (req.dates != null && req.dates.Count > 0)
    {
        foreach (var d in req.dates)
        {
            if (!string.IsNullOrWhiteSpace(d)) targetDates.Add(d.Trim());
        }
    }
    else if (!string.IsNullOrWhiteSpace(req.start_date) && !string.IsNullOrWhiteSpace(req.end_date))
    {
        if (DateTime.TryParse(req.start_date, out var start) && DateTime.TryParse(req.end_date, out var end))
        {
            for (var d = start; d <= end; d = d.AddDays(1))
            {
                targetDates.Add(d.ToString("yyyy-MM-dd"));
            }
        }
    }

    if (targetDates.Count == 0)
    {
        return Results.BadRequest(new { detail = "Vui lòng chọn ngày hoặc khoảng ngày xin nghỉ!" });
    }

    // Target shift IDs (1-9)
    var targetShifts = (req.shift_ids != null && req.shift_ids.Count > 0)
        ? req.shift_ids.Where(s => s >= 1 && s <= 9).Distinct().ToList()
        : Enumerable.Range(1, 9).ToList();

    int affectedCount = 0;

    foreach (var date in targetDates.OrderBy(x => x))
    {
        // Don't allow reporting absence for past dates
        if (string.Compare(date, todayStr, StringComparison.Ordinal) < 0) continue;

        foreach (var sid in targetShifts)
        {
            var existingReg = conn.QueryFirstOrDefault(
                "SELECT id, attendance_status FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
                new { uid = targetUserId, sid = sid, wdate = date }
            );

            if (existingReg == null)
            {
                conn.Execute(@"
                    INSERT INTO shift_registrations 
                        (user_id, shift_id, work_date, attendance_status, absence_reason, absence_reported_at, status, note)
                    VALUES 
                        (@uid, @sid, @wdate, 'pending_absence', @reason, CURRENT_TIMESTAMP, 'registered', @note)",
                    new { 
                        uid = targetUserId, 
                        sid = sid, 
                        wdate = date, 
                        reason = req.reason.Trim(), 
                        note = $"Đơn xin vắng ca nhiều ngày/tuần (Chờ duyệt). Lý do: {req.reason.Trim()}" 
                    }
                );
                affectedCount++;
            }
            else
            {
                if (existingReg.attendance_status != "absent")
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
                            note = $"Đơn xin vắng ca nhiều ngày/tuần (Chờ duyệt). Lý do: {req.reason.Trim()}", 
                            id = existingReg.id 
                        }
                    );
                    affectedCount++;
                }
            }
        }
    }

    if (affectedCount == 0)
    {
        return Results.BadRequest(new { detail = "Không có ca trực hợp lệ trong tương lai để nộp đơn báo vắng (các ca trong quá khứ không thể báo vắng)." });
    }

    // Send single consolidated notification to managers
    conn.Execute(@"
        INSERT INTO notifications (target_user_id, sender_id, title, message, type)
        VALUES (0, @sender, @title, @msg, 'absence_request')",
        new {
            sender = currentUser.id,
            title = $"Đơn xin vắng hàng loạt ({affectedCount} ca) cần duyệt",
            msg = $"{targetUser.full_name} vừa nộp đơn XIN VẮNG {affectedCount} ca làm việc ({targetDates.Min()} đến {targetDates.Max()}). Lý do: '{req.reason.Trim()}'. Vui lòng xem xét và phê duyệt."
        }
    );

    return Results.Ok(new {
        success = true,
        affected_count = affectedCount,
        dates_count = targetDates.Count,
        message = $"Đã gửi đơn xin nghỉ thành công cho {affectedCount} ca làm việc!"
    });
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
        VALUES (@sid, @work_date, @title, @description, @event_type) RETURNING id;",
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

app.MapPost("/api/shifts/attendance/hours", (UpdateActualHoursRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var reg = conn.QueryFirstOrDefault(
        "SELECT id, attendance_status, actual_hours FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
        new { uid = req.user_id, sid = req.shift_id, wdate = req.work_date }
    );

    if (reg == null)
    {
        conn.Execute(@"
            INSERT INTO shift_registrations (user_id, shift_id, work_date, attendance_status, status, actual_hours, time_note, note)
            VALUES (@uid, @sid, @wdate, 'present', 'confirmed', @hours, @time_note, @note)",
            new { 
                uid = req.user_id, 
                sid = req.shift_id, 
                wdate = req.work_date, 
                hours = req.actual_hours,
                time_note = req.time_note,
                note = $"Ghi nhận giờ thực tế: {req.actual_hours}h" 
            });
    }
    else
    {
        conn.Execute(@"
            UPDATE shift_registrations 
            SET actual_hours = @hours, time_note = @time_note 
            WHERE id = @id", 
            new { hours = req.actual_hours, time_note = req.time_note, id = (long)reg.id });
    }

    return Results.Ok(new { 
        success = true, 
        actual_hours = req.actual_hours,
        time_note = req.time_note,
        message = req.actual_hours.HasValue ? $"Đã cập nhật số giờ thực tế: {req.actual_hours.Value}h!" : "Đã đặt lại giờ chuẩn của ca!" 
    });
});

app.MapPost("/api/shifts/attendance/toggle", (ToggleAttendanceRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var reg = conn.QueryFirstOrDefault(
        "SELECT id, attendance_status FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
        new { uid = req.user_id, sid = req.shift_id, wdate = req.work_date }
    );

    var newStatus = req.attendance_status == "absent" ? "absent" : "present";
    if (reg == null)
    {
        conn.Execute(@"
            INSERT INTO shift_registrations (user_id, shift_id, work_date, attendance_status, status, note)
            VALUES (@uid, @sid, @wdate, @status, 'confirmed', @note)",
            new { 
                uid = req.user_id, 
                sid = req.shift_id, 
                wdate = req.work_date, 
                status = newStatus, 
                note = $"Xác nhận điểm danh: {newStatus}" 
            });
    }
    else
    {
        conn.Execute("UPDATE shift_registrations SET attendance_status = @status WHERE id = @id", new { status = newStatus, id = (long)reg.id });
    }

    return Results.Ok(new { 
        success = true, 
        attendance_status = newStatus, 
        message = newStatus == "absent" ? "Đã đánh dấu vắng mặt / thiếu ca!" : "Đã xác nhận có mặt thành công!" 
    });
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

    var regId = conn.ExecuteScalar<long>(
        "INSERT INTO shift_registrations (user_id, shift_id, work_date, note, status) VALUES (@uid, @sid, @date, @note, 'registered') RETURNING id;", 
        new { uid = targetUserId, sid = req.shift_id, date = req.work_date, note = req.note ?? "" });

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

    // 2. Gửi email cho toàn bộ thành viên trong hệ thống
    var totalProcessed = 0;
    var realSmtpSent = 0;
    string? emailNotice = null;

    if (req.send_email)
    {
        // Lấy tất cả thành viên trong hệ thống
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
        emailNotice = $"Hệ thống đã gửi và lưu đủ {totalProcessed} thư lịch trực vào Hòm Thư Đi (Outbox). (Để gửi trực tiếp ra Internet qua Gmail, vui lòng cấu hình Mật khẩu ứng dụng 16 ký tự tại Cài Đặt Email).";
    }

    return Results.Ok(new {
        message = $"Đã xuất bản lịch làm việc và xử lý {totalProcessed} email thông báo cho toàn bộ {totalProcessed} nhân sự thành công!",
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
               sn.reason, sn.note_type, sn.status, sn.admin_response, sn.actual_hours, sn.created_at,
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
    var noteId = conn.ExecuteScalar<long>(@"
        INSERT INTO shift_notes (user_id, shift_id, work_date, original_time, adjusted_time, reason, note_type, actual_hours, status)
        VALUES (@uid, @sid, @date, @orig, @adj, @reason, @ntype, @actHours, 'pending') RETURNING id;",
        new
        {
            uid = currentUser.id,
            sid = req.shift_id,
            date = req.work_date,
            orig = req.original_time,
            adj = req.adjusted_time,
            reason = req.reason,
            ntype = req.note_type ?? "adjusted_hours",
            actHours = req.actual_hours
        });

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
    var note = conn.QueryFirstOrDefault<dynamic>(
        "SELECT id, user_id, shift_id, work_date, note_type, adjusted_time, actual_hours, reason FROM shift_notes WHERE id = @id", new { id });

    if (note == null || note.user_id == 0)
        return Results.NotFound(new { detail = "Không tìm thấy ghi chú ca làm" });

    long userId = (long)note.user_id;
    int shiftId = (int)note.shift_id;
    string workDate = (string)note.work_date;
    string noteType = (string)(note.note_type ?? "adjusted_hours");
    string adjustedTime = (string)(note.adjusted_time ?? "");
    string reason = (string)(note.reason ?? "");

    double? effectiveHours = req.actual_hours;
    if (!effectiveHours.HasValue)
    {
        if (note.actual_hours != null)
        {
            effectiveHours = Convert.ToDouble(note.actual_hours);
        }
        else if (noteType == "emergency")
        {
            effectiveHours = 0.0;
        }
        else
        {
            effectiveHours = shiftId == 8 ? 0.5 : 1.5;
        }
    }

    conn.Execute(
        "UPDATE shift_notes SET status = @st, admin_response = @resp, actual_hours = @actHours WHERE id = @id",
        new { st = req.status, resp = req.admin_response ?? "", actHours = effectiveHours, id });

    // Tự động đồng bộ sang bảng lịch trực (shift_registrations) và KPI khi duyệt
    if (req.status == "approved" && req.sync_to_schedule)
    {
        var existingReg = conn.QueryFirstOrDefault<dynamic>(
            "SELECT id, attendance_status, actual_hours FROM shift_registrations WHERE user_id = @userId AND shift_id = @shiftId AND work_date = @workDate",
            new { userId, shiftId, workDate });

        if (noteType == "emergency")
        {
            // Nghỉ khẩn cấp: Đánh dấu vắng mặt (absent) và 0 giờ
            var absenceReason = $"Nghỉ đột xuất (duyệt ghi chú): {reason}";
            var timeNote = "Ghi chú ca: Nghỉ khẩn cấp";
            if (existingReg != null)
            {
                conn.Execute(@"
                    UPDATE shift_registrations 
                    SET attendance_status = 'absent',
                        actual_hours = 0.0,
                        absence_reason = @absenceReason,
                        absence_approved_by = @adminId,
                        absence_approved_at = CURRENT_TIMESTAMP,
                        time_note = @timeNote
                    WHERE id = @regId",
                    new { absenceReason, adminId = currentUser.id, timeNote, regId = (long)existingReg.id });
            }
            else
            {
                conn.Execute(@"
                    INSERT INTO shift_registrations (shift_id, user_id, work_date, status, attendance_status, actual_hours, absence_reason, absence_approved_by, absence_approved_at, time_note)
                    VALUES (@shiftId, @userId, @workDate, 'approved', 'absent', 0.0, @absenceReason, @adminId, CURRENT_TIMESTAMP, @timeNote)",
                    new { shiftId, userId, workDate, absenceReason, adminId = currentUser.id, timeNote });
            }
        }
        else
        {
            // Rút ngắn giờ trực / đi muộn / điều chỉnh giờ: Cập nhật actual_hours
            var timeNote = $"Đã duyệt điều chỉnh ({adjustedTime}): {reason}";
            if (existingReg != null)
            {
                conn.Execute(@"
                    UPDATE shift_registrations 
                    SET attendance_status = 'present',
                        actual_hours = @actHours,
                        time_note = @timeNote
                    WHERE id = @regId",
                    new { actHours = effectiveHours.Value, timeNote, regId = (long)existingReg.id });
            }
            else
            {
                conn.Execute(@"
                    INSERT INTO shift_registrations (shift_id, user_id, work_date, status, attendance_status, actual_hours, time_note)
                    VALUES (@shiftId, @userId, @workDate, 'approved', 'present', @actHours, @timeNote)",
                    new { shiftId, userId, workDate, actHours = effectiveHours.Value, timeNote });
            }
        }
    }

    var stText = req.status == "approved" ? "đã được DUYỆT" : "đã bị TỪ CHỐI";
    var hourInfo = (req.status == "approved" && effectiveHours.HasValue) ? $" (Giờ KPI được tính: {effectiveHours.Value:0.#}h)" : "";
    var msg = $"Yêu cầu điều chỉnh ca làm việc ngày {workDate} của bạn {stText}{hourInfo}. Phản hồi: {req.admin_response}";

    conn.Execute(
        "INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id) VALUES (@target, @sender, @title, @msg, 'shift_note_status', @rel)",
        new { target = userId, sender = currentUser.id, title = "Kết quả xét duyệt điều chỉnh ca làm", msg, rel = id });

    return Results.Ok(new { message = "Cập nhật trạng thái thành công", actual_hours = effectiveHours });
});

app.MapDelete("/api/shift-notes/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var note = conn.QueryFirstOrDefault<(long id, long user_id)>("SELECT id, user_id FROM shift_notes WHERE id = @id", new { id });
    if (note.id == 0)
        return Results.NotFound(new { detail = "Không tìm thấy ghi chú ca làm" });

    if (currentUser.role != "admin" && currentUser.id != note.user_id)
        return Results.StatusCode(403);

    conn.Execute("DELETE FROM shift_notes WHERE id = @id", new { id });
    conn.Execute("DELETE FROM notifications WHERE type = 'shift_note_status' AND related_id = @id", new { id });

    return Results.Ok(new { message = "Đã xóa ghi chú ca làm thành công" });
});

app.MapDelete("/api/shift-notes/clear-all", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || currentUser.role != "admin") return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var count = conn.Execute("DELETE FROM shift_notes");
    conn.Execute("DELETE FROM notifications WHERE type = 'shift_note_status'");

    return Results.Ok(new { message = $"Đã xóa sạch {count} ghi chú ca làm việc thành công" });
});

// ================= CLASS SCHEDULES (THỜI KHÓA BIỂU HỌC TẬP) =================
app.MapGet("/api/class-schedules", (long? user_id, string? start_date, string? end_date, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (currentUser.role != "admin" && user_id.HasValue && user_id.Value != currentUser.id)
    {
        return Results.StatusCode(403);
    }

    long? targetUserId = (currentUser.role == "admin" && !user_id.HasValue) ? null : (user_id ?? currentUser.id);

    using var conn = Database.GetConnection();
    var query = @"
        SELECT cs.id, cs.user_id, cs.course_code, cs.class_name, cs.work_date,
               cs.start_time, cs.end_time, cs.room, cs.source_batch_id, cs.created_at,
               u.full_name as user_name, u.username, u.email
        FROM class_schedules cs
        JOIN users u ON cs.user_id = u.id
        WHERE (@targetUserId IS NULL OR cs.user_id = @targetUserId)
          AND (@startDate IS NULL OR cs.work_date >= @startDate)
          AND (@endDate IS NULL OR cs.work_date <= @endDate)
        ORDER BY cs.work_date ASC, cs.start_time ASC";

    var list = conn.Query(query, new { targetUserId, startDate = start_date, endDate = end_date });
    return Results.Ok(list);
});

app.MapPost("/api/class-schedules/import", (ImportClassScheduleRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (req.entries == null || req.entries.Count == 0)
    {
        return Results.BadRequest(new { detail = "Danh sách buổi học nhập vào trống." });
    }

    long effectiveUserId = (currentUser.role == "admin" && req.target_user_id.HasValue)
        ? req.target_user_id.Value
        : currentUser.id;

    var batchId = DateTime.UtcNow.Ticks.ToString();

    using var conn = Database.GetConnection();
    int count = 0;
    foreach (var e in req.entries)
    {
        if (string.IsNullOrWhiteSpace(e.class_name) || string.IsNullOrWhiteSpace(e.work_date) ||
            string.IsNullOrWhiteSpace(e.start_time) || string.IsNullOrWhiteSpace(e.end_time))
        {
            continue;
        }

        conn.Execute(@"
            INSERT INTO class_schedules (user_id, course_code, class_name, work_date, start_time, end_time, room, source_batch_id)
            VALUES (@uid, @code, @name, @date, @stime, @etime, @room, @batchId)",
            new
            {
                uid = effectiveUserId,
                code = e.course_code?.Trim(),
                name = e.class_name.Trim(),
                date = e.work_date.Trim(),
                stime = e.start_time.Trim(),
                etime = e.end_time.Trim(),
                room = e.room?.Trim(),
                batchId
            });
        count++;
    }

    return Results.Ok(new { message = $"Đã nhập thành công {count} buổi học vào Thời Khóa Biểu!", count, batch_id = batchId });
});

app.MapDelete("/api/class-schedules/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var item = conn.QueryFirstOrDefault<(long id, long user_id)>("SELECT id, user_id FROM class_schedules WHERE id = @id", new { id });
    if (item.id == 0) return Results.NotFound(new { detail = "Không tìm thấy buổi học này" });

    if (currentUser.role != "admin" && currentUser.id != item.user_id)
    {
        return Results.StatusCode(403);
    }

    conn.Execute("DELETE FROM class_schedules WHERE id = @id", new { id });
    return Results.Ok(new { message = "Đã xóa buổi học thành công" });
});

app.MapDelete("/api/class-schedules/clear", (long? user_id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    int deleted = 0;
    if (currentUser.role == "admin")
    {
        if (user_id.HasValue)
        {
            deleted = conn.Execute("DELETE FROM class_schedules WHERE user_id = @uid", new { uid = user_id.Value });
        }
        else
        {
            deleted = conn.Execute("DELETE FROM class_schedules");
        }
    }
    else
    {
        deleted = conn.Execute("DELETE FROM class_schedules WHERE user_id = @uid", new { uid = currentUser.id });
    }

    return Results.Ok(new { message = $"Đã xóa sạch {deleted} buổi học trong thời khóa biểu thành công!", count = deleted });
});

app.MapGet("/api/class-schedules/conflicts", (string start_date, string end_date, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var assignmentsQuery = @"
        SELECT sr.id as reg_id, sr.shift_id, sr.user_id, sr.work_date, sr.status, sr.attendance_status,
               u.full_name as user_name,
               st.name as shift_name, st.start_time as shift_start_time, st.end_time as shift_end_time
        FROM shift_registrations sr
        JOIN users u ON sr.user_id = u.id
        JOIN shift_templates st ON sr.shift_id = st.id
        WHERE sr.work_date >= @start_date AND sr.work_date <= @end_date
          AND sr.attendance_status != 'absent'";

    var assignments = conn.Query<dynamic>(assignmentsQuery, new { start_date, end_date }).ToList();

    var classesQuery = @"
        SELECT cs.id, cs.user_id, cs.course_code, cs.class_name, cs.work_date, cs.start_time, cs.end_time, cs.room
        FROM class_schedules cs
        WHERE cs.work_date >= @start_date AND cs.work_date <= @end_date";

    var classes = conn.Query<dynamic>(classesQuery, new { start_date, end_date }).ToList();

    var conflicts = new List<dynamic>();

    foreach (var a in assignments)
    {
        long uid = (long)a.user_id;
        string date = (string)a.work_date;
        string sStart = (string)a.shift_start_time;
        string sEnd = (string)a.shift_end_time;

        var userClassesOnDate = classes.Where(c => (long)c.user_id == uid && (string)c.work_date == date);
        foreach (var c in userClassesOnDate)
        {
            string cStart = (string)c.start_time;
            string cEnd = (string)c.end_time;

            string maxStart = string.Compare(sStart, cStart, StringComparison.Ordinal) > 0 ? sStart : cStart;
            string minEnd = string.Compare(sEnd, cEnd, StringComparison.Ordinal) < 0 ? sEnd : cEnd;

            if (string.Compare(maxStart, minEnd, StringComparison.Ordinal) < 0)
            {
                conflicts.Add(new
                {
                    reg_id = (long)a.reg_id,
                    user_id = uid,
                    user_name = (string)a.user_name,
                    shift_id = (int)a.shift_id,
                    shift_name = (string)a.shift_name,
                    shift_time = $"{sStart} - {sEnd}",
                    work_date = date,
                    course_code = (string)(c.course_code ?? ""),
                    class_name = (string)c.class_name,
                    class_time = $"{cStart} - {cEnd}",
                    room = (string)(c.room ?? "")
                });
            }
        }
    }

    return Results.Ok(conflicts);
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
    var fbId = conn.ExecuteScalar<long>(@"
        INSERT INTO feedbacks (user_id, author_name, is_anonymous, category, title, content, likes_count, status)
        VALUES (@uid, @author, @anon, @cat, @title, @content, 0, 'pending') RETURNING id;",
        new { uid = currentUser.id, author = authorName, anon = req.is_anonymous ? 1 : 0, cat = req.category, title = req.title, content = req.content });
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

