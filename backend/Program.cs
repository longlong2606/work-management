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

// Swagger & OpenAPI configuration
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseCors("AllowAll");

// Enable Swagger UI
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "WorkManagement API v1");
    c.RoutePrefix = "swagger";
    c.DocumentTitle = "WorkManagement API - Swagger UI";
});

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
            t.location, t.customer_info, t.leader_id, t.created_by,
            COALESCE(t.total_cp, 0) AS total_cp,
            (SELECT COALESCE(SUM(s.cp_points), 0) FROM subtasks s WHERE s.task_id = t.id) AS allocated_cp,
            t.status,
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
        if (status.Equals("active", StringComparison.OrdinalIgnoreCase))
        {
            sql += " AND t.status IN ('OPEN', 'IN_PROGRESS', 'POSTPONED')";
        }
        else
        {
            sql += " AND t.status = @status";
            p.Add("status", status);
        }
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

app.MapGet("/api/tasks/stats", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var stats = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT 
            COUNT(1) AS total,
            SUM(CASE WHEN t.status IN ('OPEN', 'IN_PROGRESS', 'POSTPONED') THEN 1 ELSE 0 END) AS active,
            SUM(CASE WHEN t.status = 'FINISHED' THEN 1 ELSE 0 END) AS finished,
            (SELECT COUNT(DISTINCT s.task_id) FROM subtasks s WHERE s.status = 'REVIEW') AS needs_review_tasks
        FROM tasks t");

    return Results.Ok(new
    {
        total = Convert.ToInt32(stats?.total ?? 0),
        active = Convert.ToInt32(stats?.active ?? 0),
        finished = Convert.ToInt32(stats?.finished ?? 0),
        needs_review_tasks = Convert.ToInt32(stats?.needs_review_tasks ?? 0)
    });
});

app.MapGet("/api/tasks/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var task = conn.QueryFirstOrDefault(@"
        SELECT 
            t.id, t.title, t.description, t.task_type, t.planned_date, t.deadline,
            t.location, t.customer_info, t.leader_id, t.created_by,
            COALESCE(t.total_cp, 0) AS total_cp,
            (SELECT COALESCE(SUM(s.cp_points), 0) FROM subtasks s WHERE s.task_id = t.id) AS allocated_cp,
            t.status,
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
            s.due_at, s.review_comment, s.reject_reason, s.submitted_for_review_at, s.finished_at,
            s.created_by, u.full_name AS creator_name, s.created_at, s.updated_at,
            COALESCE(s.cp_points, 0) AS cp_points,
            COALESCE(s.quality_multiplier, 1.0) AS quality_multiplier
        FROM subtasks s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.task_id = @id
        ORDER BY s.position ASC, s.created_at ASC", new { id }).ToList();

    var subtaskIds = subtasksRaw.Select(s => Convert.ToInt64(s.id)).ToList();
    var assigneesDict = new Dictionary<long, List<dynamic>>();
    if (subtaskIds.Any())
    {
        string ids = string.Join(",", subtaskIds);
        var assignees = conn.Query($@"
            SELECT sa.subtask_id, u.id AS user_id, u.full_name, u.username, u.role,
                   COALESCE(sa.contribution_pct, 100) AS contribution_pct
            FROM subtask_assignees sa
            JOIN users u ON sa.user_id = u.id
            WHERE sa.subtask_id IN ({ids})").ToList();

        foreach (var a in assignees)
        {
            long sId = Convert.ToInt64(a.subtask_id);
            if (!assigneesDict.ContainsKey(sId)) assigneesDict[sId] = new List<dynamic>();
            int pct = Convert.ToInt32(a.contribution_pct);
            assigneesDict[sId].Add(new { 
                user_id = Convert.ToInt64(a.user_id), 
                full_name = (string)a.full_name, 
                username = (string)a.username, 
                role = (string)a.role,
                contribution_pct = pct
            });
        }
    }

    var subtasks = subtasksRaw.Select(s => new
    {
        id = Convert.ToInt64(s.id),
        task_id = Convert.ToInt64(s.task_id),
        title = (string)s.title,
        description = (string?)s.description,
        position = Convert.ToInt32(s.position),
        status = (string)s.status,
        due_at = (string?)s.due_at,
        review_comment = (string?)s.review_comment,
        reject_reason = (string?)s.reject_reason,
        submitted_for_review_at = (string?)s.submitted_for_review_at,
        finished_at = (string?)s.finished_at,
        created_by = Convert.ToInt64(s.created_by),
        creator_name = (string?)s.creator_name,
        created_at = (string?)s.created_at?.ToString(),
        updated_at = (string?)s.updated_at?.ToString(),
        cp_points = Convert.ToInt32(s.cp_points),
        quality_multiplier = Convert.ToDouble(s.quality_multiplier),
        assignees = assigneesDict.ContainsKey(Convert.ToInt64(s.id)) ? assigneesDict[Convert.ToInt64(s.id)] : new List<dynamic>()
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
    if (currentUser.role != "admin" && !currentUser.can_manage_tasks) 
        return Results.Json(new { detail = "Chỉ Quản trị viên (Admin) mới có quyền tạo nhiệm vụ lớn! Leader có quyền điều phối và giao subtask chi tiết." }, statusCode: 403);

    if (string.IsNullOrWhiteSpace(req.title))
        return Results.BadRequest(new { detail = "Tiêu đề nhiệm vụ không được để trống!" });
    if (string.IsNullOrWhiteSpace(req.deadline))
        return Results.BadRequest(new { detail = "Hạn chót (Deadline) không được để trống!" });
    if (req.leader_id <= 0)
        return Results.BadRequest(new { detail = "Vui lòng chỉ định Trưởng nhóm (Leader) phụ trách!" });

    int totalCp = Math.Max(0, req.total_cp);
    using var conn = Database.GetConnection();

    var leader = conn.QueryFirstOrDefault<dynamic>("SELECT id, role FROM users WHERE id = @leader_id", new { leader_id = req.leader_id });
    if (leader == null)
        return Results.BadRequest(new { detail = "Trưởng nhóm (Leader) được chỉ định không tồn tại trong hệ thống!" });

    try
    {
        string insertTaskSql = Database.IsPostgres
            ? @"INSERT INTO tasks (title, description, task_type, planned_date, deadline, location, customer_info, leader_id, created_by, total_cp, status, created_at, updated_at)
                VALUES (@title, @description, @task_type, @planned_date, @deadline, @location, @customer_info, @leader_id, @created_by, @totalCp, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id;"
            : @"INSERT INTO tasks (title, description, task_type, planned_date, deadline, location, customer_info, leader_id, created_by, total_cp, status, created_at, updated_at)
                VALUES (@title, @description, @task_type, @planned_date, @deadline, @location, @customer_info, @leader_id, @created_by, @totalCp, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                SELECT last_insert_rowid();";

        long taskId = Convert.ToInt64(conn.ExecuteScalar(insertTaskSql,
            new
            {
                title = req.title.Trim(),
                description = req.description?.Trim(),
                task_type = string.IsNullOrWhiteSpace(req.task_type) ? "RESEARCH" : req.task_type.Trim(),
                planned_date = string.IsNullOrWhiteSpace(req.planned_date) ? DateTime.UtcNow.ToString("yyyy-MM-dd") : req.planned_date.Trim(),
                deadline = req.deadline.Trim(),
                location = req.location?.Trim(),
                customer_info = req.customer_info?.Trim(),
                leader_id = req.leader_id,
                created_by = currentUser.id,
                totalCp
            }));

        return Results.Ok(new { message = "Đã khởi tạo nhiệm vụ thành công!", task_id = taskId });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: "Lỗi khi khởi tạo nhiệm vụ: " + ex.Message, statusCode: 500);
    }
});

app.MapPut("/api/tasks/{id:long}", (long id, UpdateTaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var existing = conn.QueryFirstOrDefault<dynamic>("SELECT id, leader_id, status FROM tasks WHERE id = @id", new { id });
    if (existing == null) return Results.NotFound(new { detail = "Nhiệm vụ không tồn tại!" });

    if ((string)existing.status == "FINISHED")
        return Results.BadRequest(new { detail = "Nhiệm vụ đã hoàn thành và lưu trữ, chỉ có thể xem chi tiết chứ không thể chỉnh sửa!" });

    long? existingLeaderId = existing.leader_id != null ? Convert.ToInt64(existing.leader_id) : (long?)null;
    if (currentUser.role != "admin" && !currentUser.can_manage_tasks && (!existingLeaderId.HasValue || existingLeaderId.Value != currentUser.id))
        return Results.StatusCode(403);

    if (string.IsNullOrWhiteSpace(req.title))
        return Results.BadRequest(new { detail = "Tiêu đề nhiệm vụ không được để trống!" });

    long targetLeaderId = req.leader_id > 0 ? req.leader_id : (existingLeaderId ?? currentUser.id);
    int totalCp = Math.Max(0, req.total_cp);

    try
    {
        conn.Execute(@"
            UPDATE tasks SET 
                title = @title, 
                description = @description, 
                task_type = @task_type,
                planned_date = @planned_date, 
                deadline = @deadline, 
                location = @location,
                customer_info = @customer_info, 
                leader_id = @leader_id, 
                total_cp = @totalCp, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id",
            new
            {
                id,
                title = req.title.Trim(),
                description = req.description?.Trim(),
                task_type = string.IsNullOrWhiteSpace(req.task_type) ? "RESEARCH" : req.task_type.Trim(),
                planned_date = string.IsNullOrWhiteSpace(req.planned_date) ? DateTime.UtcNow.ToString("yyyy-MM-dd") : req.planned_date.Trim(),
                deadline = string.IsNullOrWhiteSpace(req.deadline) ? DateTime.UtcNow.AddDays(7).ToString("yyyy-MM-dd HH:mm") : req.deadline.Trim(),
                location = req.location?.Trim(),
                customer_info = req.customer_info?.Trim(),
                leader_id = targetLeaderId,
                totalCp
            });

        return Results.Ok(new { message = "Đã cập nhật thông tin nhiệm vụ thành công!" });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: "Lỗi cập nhật thông tin nhiệm vụ: " + ex.Message, statusCode: 500);
    }
});

app.MapPost("/api/tasks/{id:long}/postpone", (long id, PostponeTaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var task = conn.QueryFirstOrDefault<dynamic>("SELECT id, leader_id, status FROM tasks WHERE id = @id", new { id });
    if (task == null) return Results.NotFound(new { detail = "Nhiệm vụ không tồn tại!" });

    long? leaderId = task.leader_id != null ? Convert.ToInt64(task.leader_id) : (long?)null;
    bool isTaskLeader = leaderId.HasValue && leaderId.Value == currentUser.id;
    if (currentUser.role != "admin" && !isTaskLeader && !currentUser.can_manage_tasks) return Results.StatusCode(403);

    if ((string)task.status == "FINISHED")
        return Results.BadRequest(new { detail = "Nhiệm vụ đã hoàn thành, không thể tạm hoãn!" });

    if (string.IsNullOrWhiteSpace(req.reason))
        return Results.BadRequest(new { detail = "Vui lòng nhập lý do tạm hoãn nhiệm vụ!" });

    conn.Execute(@"
        UPDATE tasks SET status = 'POSTPONED', postponed_reason = @reason, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id", new { id, reason = req.reason.Trim() });

    return Results.Ok(new { message = "Đã chuyển trạng thái nhiệm vụ sang Tạm hoãn!" });
});

app.MapPost("/api/tasks/{id:long}/resume", (long id, ResumeTaskRequest? req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var task = conn.QueryFirstOrDefault<dynamic>("SELECT id, leader_id, status FROM tasks WHERE id = @id", new { id });
    if (task == null) return Results.NotFound(new { detail = "Nhiệm vụ không tồn tại!" });

    long? leaderId = task.leader_id != null ? Convert.ToInt64(task.leader_id) : (long?)null;
    bool isTaskLeader = leaderId.HasValue && leaderId.Value == currentUser.id;
    if (currentUser.role != "admin" && !isTaskLeader && !currentUser.can_manage_tasks) return Results.StatusCode(403);

    if ((string)task.status != "POSTPONED")
        return Results.BadRequest(new { detail = "Nhiệm vụ không ở trạng thái Tạm hoãn!" });

    conn.Execute(@"
        UPDATE tasks SET 
            status = CASE WHEN (SELECT COUNT(1) FROM subtasks WHERE task_id = @id) > 0 THEN 'IN_PROGRESS' ELSE 'OPEN' END,
            postponed_reason = NULL,
            planned_date = COALESCE(@plannedDate, planned_date),
            deadline = COALESCE(@deadline, deadline),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = @id", new
    {
        id,
        plannedDate = string.IsNullOrWhiteSpace(req?.planned_date) ? null : req.planned_date.Trim(),
        deadline = string.IsNullOrWhiteSpace(req?.deadline) ? null : req.deadline.Trim()
    });

    return Results.Ok(new { message = "Đã dừng tạm hoãn và khôi phục hoạt động cho nhiệm vụ!" });
});

app.MapPost("/api/tasks/{id:long}/finish", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var task = conn.QueryFirstOrDefault<dynamic>("SELECT id, leader_id, status FROM tasks WHERE id = @id", new { id });
    if (task == null) return Results.NotFound(new { detail = "Nhiệm vụ không tồn tại!" });

    if ((string)task.status == "POSTPONED")
        return Results.BadRequest(new { detail = "Nhiệm vụ đang ở trạng thái Tạm hoãn, không thể nghiệm thu hoàn thành! Vui lòng dừng tạm hoãn trước khi hoàn thành." });

    long? leaderId = task.leader_id != null ? Convert.ToInt64(task.leader_id) : (long?)null;
    bool isTaskLeader = leaderId.HasValue && leaderId.Value == currentUser.id;
    bool canFinishTask = currentUser.role == "admin" 
        || isTaskLeader 
        || currentUser.can_manage_tasks;

    if (!canFinishTask)
        return Results.Json(new { detail = "Chỉ người phụ trách nhiệm vụ này hoặc Quản trị viên mới có quyền nghiệm thu hoàn thành toàn bộ nhiệm vụ!" }, statusCode: 403);

    var subtaskStats = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT 
            COUNT(1) AS total,
            SUM(CASE WHEN status IN ('FINISHED', 'FAILED') THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN status = 'FINISHED' THEN 1 ELSE 0 END) AS finished,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed
        FROM subtasks WHERE task_id = @id", new { id });

    int total = Convert.ToInt32(subtaskStats?.total ?? 0);
    int resolved = Convert.ToInt32(subtaskStats?.resolved ?? 0);
    int finished = Convert.ToInt32(subtaskStats?.finished ?? 0);
    int failed = Convert.ToInt32(subtaskStats?.failed ?? 0);

    if (total == 0)
        return Results.BadRequest(new { detail = "Nhiệm vụ chưa có mục checklist nào. Cần tạo và xử lý các mục checklist trước khi kết thúc nhiệm vụ!" });

    if (total != resolved)
        return Results.BadRequest(new { detail = $"Còn {total - resolved} mục checklist chưa được nghiệm thu hoặc đánh giá. Cần xử lý toàn bộ checklist trước khi kết thúc nhiệm vụ!" });

    conn.Execute(@"
        UPDATE tasks SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id", new { id });

    string finishMsg = failed > 0
        ? $"Nhiệm vụ đã kết thúc! ({finished} mục đạt, {failed} mục không đạt bị trừ điểm CP)."
        : "Chúc mừng! Nhiệm vụ đã hoàn thành xuất sắc toàn bộ mục checklist!";
    return Results.Ok(new { message = finishMsg });
});

app.MapDelete("/api/tasks/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var task = conn.QueryFirstOrDefault<dynamic>("SELECT id, leader_id, created_by FROM tasks WHERE id = @id", new { id });
    if (task == null) return Results.NotFound(new { detail = "Nhiệm vụ không tồn tại!" });

    long? leaderId = task.leader_id != null ? Convert.ToInt64(task.leader_id) : (long?)null;
    long? createdBy = task.created_by != null ? Convert.ToInt64(task.created_by) : (long?)null;

    bool isAuthorized = currentUser.role == "admin" 
        || currentUser.can_manage_tasks 
        || (leaderId.HasValue && leaderId.Value == currentUser.id)
        || (createdBy.HasValue && createdBy.Value == currentUser.id);

    if (!isAuthorized) return Results.StatusCode(403);

    using var tx = conn.BeginTransaction();
    try
    {
        // 1. Xóa các thông báo liên quan đến nhiệm vụ
        conn.Execute("DELETE FROM notifications WHERE type = 'task' AND related_id = @id", new { id }, tx);

        // 2. Xóa các giao dịch CP liên quan đến các checklist của nhiệm vụ
        conn.Execute("DELETE FROM cp_transactions WHERE subtask_id IN (SELECT id FROM subtasks WHERE task_id = @id)", new { id }, tx);

        // 3. Xóa người phụ trách các checklist
        conn.Execute("DELETE FROM subtask_assignees WHERE subtask_id IN (SELECT id FROM subtasks WHERE task_id = @id)", new { id }, tx);

        // 4. Xóa các checklist
        conn.Execute("DELETE FROM subtasks WHERE task_id = @id", new { id }, tx);

        // 5. Xóa nhiệm vụ chính
        int rows = conn.Execute("DELETE FROM tasks WHERE id = @id", new { id }, tx);

        tx.Commit();
        return Results.Ok(new { message = "Đã xóa nhiệm vụ và toàn bộ checklist liên quan thành công!" });
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return Results.Problem(detail: "Lỗi khi xóa nhiệm vụ: " + ex.Message, statusCode: 500);
    }
});

// ================= SUBTASKS (CHECKLIST) =================
app.MapPost("/api/tasks/{taskId:long}/subtasks", (long taskId, CreateSubtaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var task = conn.QueryFirstOrDefault<dynamic>("SELECT id, leader_id, status FROM tasks WHERE id = @taskId", new { taskId });
    if (task == null) return Results.NotFound(new { detail = "Nhiệm vụ cha không tồn tại!" });

    if ((string)task.status == "FINISHED")
        return Results.BadRequest(new { detail = "Nhiệm vụ đã hoàn thành, không thể thêm mục việc mới!" });

    long? leaderId = task.leader_id != null ? Convert.ToInt64(task.leader_id) : (long?)null;
    bool canCreateSubtask = currentUser.role == "admin" 
        || currentUser.role == "leader" 
        || (leaderId.HasValue && leaderId.Value == currentUser.id)
        || currentUser.can_manage_tasks;

    if (!canCreateSubtask)
        return Results.Json(new { detail = "Bạn không có quyền giao subtask cho nhiệm vụ này!" }, statusCode: 403);

    if (string.IsNullOrWhiteSpace(req.title))
        return Results.BadRequest(new { detail = "Tiêu đề mục việc checklist không được để trống!" });

    if (string.IsNullOrWhiteSpace(req.due_at))
        return Results.BadRequest(new { detail = "Hạn chót mục việc (ngày và giờ) không được để trống!" });

    try
    {
        int pos = conn.ExecuteScalar<int>("SELECT COALESCE(MAX(position), 0) + 1 FROM subtasks WHERE task_id = @taskId", new { taskId });
        int cpPoints = Math.Max(0, req.cp_points);

        string insertSubtaskSql = Database.IsPostgres
            ? @"INSERT INTO subtasks (task_id, title, description, position, status, due_at, created_by, cp_points, quality_multiplier, created_at, updated_at)
                VALUES (@taskId, @title, @description, @pos, 'PENDING', @due_at, @createdBy, @cpPoints, 1.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                RETURNING id;"
            : @"INSERT INTO subtasks (task_id, title, description, position, status, due_at, created_by, cp_points, quality_multiplier, created_at, updated_at)
                VALUES (@taskId, @title, @description, @pos, 'PENDING', @due_at, @createdBy, @cpPoints, 1.0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                SELECT last_insert_rowid();";

        long subtaskId = Convert.ToInt64(conn.ExecuteScalar(insertSubtaskSql,
            new
            {
                taskId,
                title = req.title.Trim(),
                description = req.description?.Trim(),
                pos,
                due_at = req.due_at?.Trim(),
                createdBy = currentUser.id,
                cpPoints
            }));

        List<long> validAssigneeIds = new List<long>();
        if (req.assignee_ids != null && req.assignee_ids.Any())
        {
            string ids = string.Join(",", req.assignee_ids.Distinct());
            // Trong phần giao người làm subtask không giao cho admin và leader
            validAssigneeIds = conn.Query<long>($"SELECT id FROM users WHERE id IN ({ids}) AND role NOT IN ('admin', 'leader')").ToList();
        }

        if (!validAssigneeIds.Any())
            return Results.BadRequest(new { detail = "Vui lòng chọn ít nhất 1 thành viên hợp lệ (không phải Admin hoặc Leader) để giao mục việc!" });

        if (req.assignee_contributions != null && req.assignee_contributions.Any())
        {
            var validContributions = req.assignee_contributions.Where(ac => validAssigneeIds.Contains(ac.user_id)).ToList();
            foreach (var ac in validContributions)
            {
                conn.Execute("INSERT INTO subtask_assignees (subtask_id, user_id, contribution_pct) VALUES (@subtaskId, @uid, @pct) ON CONFLICT (subtask_id, user_id) DO UPDATE SET contribution_pct = EXCLUDED.contribution_pct",
                    new { subtaskId, uid = ac.user_id, pct = ac.contribution_pct });

                if (ac.user_id != currentUser.id)
                {
                    conn.Execute("INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id) VALUES (@uid, @senderId, @title, @msg, 'task', @taskId)",
                        new { uid = ac.user_id, senderId = currentUser.id, title = "Mục việc mới cần tiếp nhận", msg = $"Bạn vừa được giao mục việc \"{req.title.Trim()}\" ({cpPoints} CP). Vui lòng xác nhận tiếp nhận hoặc từ chối.", taskId });
                }
            }
        }
        else
        {
            int defaultPct = validAssigneeIds.Count > 1 ? (100 / validAssigneeIds.Count) : 100;
            foreach (var uid in validAssigneeIds)
            {
                conn.Execute("INSERT INTO subtask_assignees (subtask_id, user_id, contribution_pct) VALUES (@subtaskId, @uid, @defaultPct) ON CONFLICT (subtask_id, user_id) DO NOTHING",
                    new { subtaskId, uid, defaultPct });

                if (uid != currentUser.id)
                {
                    conn.Execute("INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id) VALUES (@uid, @senderId, @title, @msg, 'task', @taskId)",
                        new { uid, senderId = currentUser.id, title = "Mục việc mới cần tiếp nhận", msg = $"Bạn vừa được giao mục việc \"{req.title.Trim()}\" ({cpPoints} CP). Vui lòng xác nhận tiếp nhận hoặc từ chối.", taskId });
                }
            }
        }

        // Auto transition parent task from OPEN to IN_PROGRESS
        if ((string)task.status == "OPEN")
        {
            conn.Execute("UPDATE tasks SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = @taskId", new { taskId });
        }

        return Results.Ok(new { message = "Đã thêm mục checklist mới vào nhiệm vụ!", subtask_id = subtaskId });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: "Lỗi khi thêm mục checklist: " + ex.Message, statusCode: 500);
    }
});

app.MapPut("/api/subtasks/{id:long}", (long id, UpdateSubtaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, s.task_id, t.leader_id, t.status AS task_status 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục checklist không tồn tại!" });

    if ((string)subtask.task_status == "FINISHED")
        return Results.BadRequest(new { detail = "Nhiệm vụ đã hoàn thành, chỉ có thể xem chứ không thể chỉnh sửa mục việc!" });
    long? subtaskLeaderId = subtask.leader_id != null ? Convert.ToInt64(subtask.leader_id) : (long?)null;
    if (currentUser.role != "admin" && !currentUser.can_manage_tasks && !currentUser.can_manage_cp && (!subtaskLeaderId.HasValue || subtaskLeaderId.Value != currentUser.id))
        return Results.StatusCode(403);

    if (string.IsNullOrWhiteSpace(req.title))
        return Results.BadRequest(new { detail = "Tiêu đề không được để trống!" });

    if (string.IsNullOrWhiteSpace(req.due_at))
        return Results.BadRequest(new { detail = "Hạn chót mục việc (ngày và giờ) không được để trống!" });

    int cpPoints = Math.Max(0, req.cp_points);

    try
    {
        conn.Execute(@"
            UPDATE subtasks SET 
                title = @title, description = @description, due_at = @due_at, cp_points = @cpPoints,
                status = CASE WHEN status = 'REJECTED' THEN 'PENDING' ELSE status END,
                reject_reason = CASE WHEN status = 'REJECTED' THEN NULL ELSE reject_reason END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id",
            new
            {
                id,
                title = req.title.Trim(),
                description = req.description?.Trim(),
                due_at = req.due_at?.Trim(),
                cpPoints
            });

        if (req.assignee_contributions != null && req.assignee_contributions.Any())
        {
            var uids = req.assignee_contributions.Select(ac => ac.user_id).Distinct().ToList();
            string ids = string.Join(",", uids);
            // Trong phần giao người làm subtask không giao cho admin và leader
            var validUids = conn.Query<long>($"SELECT id FROM users WHERE id IN ({ids}) AND role NOT IN ('admin', 'leader')").ToList();

            if (!validUids.Any())
                return Results.BadRequest(new { detail = "Vui lòng chọn ít nhất 1 thành viên hợp lệ (không phải Admin hoặc Leader) để giao mục việc!" });

            conn.Execute("DELETE FROM subtask_assignees WHERE subtask_id = @id", new { id });
            foreach (var ac in req.assignee_contributions.Where(ac => validUids.Contains(ac.user_id)))
            {
                conn.Execute("INSERT INTO subtask_assignees (subtask_id, user_id, contribution_pct) VALUES (@id, @uid, @pct) ON CONFLICT (subtask_id, user_id) DO UPDATE SET contribution_pct = EXCLUDED.contribution_pct",
                    new { id, uid = ac.user_id, pct = ac.contribution_pct });
            }
        }
        else if (req.assignee_ids != null && req.assignee_ids.Any())
        {
            string ids = string.Join(",", req.assignee_ids.Distinct());
            // Trong phần giao người làm subtask không giao cho admin và leader
            var validUids = conn.Query<long>($"SELECT id FROM users WHERE id IN ({ids}) AND role NOT IN ('admin', 'leader')").ToList();

            if (!validUids.Any())
                return Results.BadRequest(new { detail = "Vui lòng chọn ít nhất 1 thành viên hợp lệ (không phải Admin hoặc Leader) để giao mục việc!" });

            conn.Execute("DELETE FROM subtask_assignees WHERE subtask_id = @id", new { id });
            int defaultPct = validUids.Count > 1 ? (100 / validUids.Count) : 100;
            foreach (var uid in validUids)
            {
                conn.Execute("INSERT INTO subtask_assignees (subtask_id, user_id, contribution_pct) VALUES (@id, @uid, @defaultPct) ON CONFLICT (subtask_id, user_id) DO NOTHING",
                    new { id, uid, defaultPct });
            }
        }

        return Results.Ok(new { message = "Đã cập nhật mục checklist thành công!" });
    }
    catch (Exception ex)
    {
        return Results.Problem(detail: "Lỗi khi cập nhật mục checklist: " + ex.Message, statusCode: 500);
    }
});

app.MapPost("/api/subtasks/{id:long}/accept", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, s.title, s.status, s.task_id, t.leader_id 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục việc không tồn tại!" });

    long? subtaskLeaderId = subtask.leader_id != null ? Convert.ToInt64(subtask.leader_id) : (long?)null;
    long subtaskTaskId = Convert.ToInt64(subtask.task_id);
    bool isAssigned = conn.ExecuteScalar<int>("SELECT COUNT(1) FROM subtask_assignees WHERE subtask_id = @id AND user_id = @uid", new { id, uid = currentUser.id }) > 0;

    if (!isAssigned)
        return Results.Json(new { detail = "Chỉ người được giao mục việc mới có quyền tiếp nhận mục việc này!" }, statusCode: 403);

    if ((string)subtask.status != "PENDING")
        return Results.BadRequest(new { detail = $"Chỉ có thể tiếp nhận khi mục việc ở trạng thái Chờ tiếp nhận. Hiện tại: {subtask.status}" });

    conn.Execute(@"
        UPDATE subtasks SET 
            status = 'PROCESSING', reject_reason = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id", new { id });

    if (subtaskLeaderId.HasValue && subtaskLeaderId.Value != currentUser.id)
    {
        conn.Execute("INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id) VALUES (@leaderId, @senderId, @title, @msg, 'task', @taskId)",
            new { leaderId = subtaskLeaderId.Value, senderId = currentUser.id, title = "Thành viên đã tiếp nhận mục việc", msg = $"{currentUser.full_name} đã xác nhận tiếp nhận mục việc: \"{subtask.title}\".", taskId = subtaskTaskId });
    }

    return Results.Ok(new { message = "Đã tiếp nhận mục việc thành công! Trạng thái chuyển sang Đang thực hiện." });
});

app.MapPost("/api/subtasks/{id:long}/reject", (long id, RejectSubtaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, s.title, s.status, s.task_id, t.leader_id 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục việc không tồn tại!" });

    long? subtaskLeaderId = subtask.leader_id != null ? Convert.ToInt64(subtask.leader_id) : (long?)null;
    long subtaskTaskId = Convert.ToInt64(subtask.task_id);
    bool isAssigned = conn.ExecuteScalar<int>("SELECT COUNT(1) FROM subtask_assignees WHERE subtask_id = @id AND user_id = @uid", new { id, uid = currentUser.id }) > 0;

    if (!isAssigned)
        return Results.Json(new { detail = "Chỉ người được giao mục việc mới có quyền từ chối nhận mục việc này!" }, statusCode: 403);

    if ((string)subtask.status != "PENDING")
        return Results.BadRequest(new { detail = $"Chỉ có thể từ chối khi mục việc ở trạng thái Chờ tiếp nhận. Hiện tại: {subtask.status}" });

    string reason = string.IsNullOrWhiteSpace(req.reason) ? "Thành viên từ chối tiếp nhận mục việc" : req.reason.Trim();

    conn.Execute(@"
        UPDATE subtasks SET 
            status = 'REJECTED', reject_reason = @reason, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id", new { id, reason });

    if (subtaskLeaderId.HasValue && subtaskLeaderId.Value != currentUser.id)
    {
        conn.Execute("INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id) VALUES (@leaderId, @senderId, @title, @msg, 'task', @taskId)",
            new { leaderId = subtaskLeaderId.Value, senderId = currentUser.id, title = "Thành viên từ chối nhận mục việc", msg = $"{currentUser.full_name} đã từ chối nhận mục việc \"{subtask.title}\" với lý do: {reason}", taskId = subtaskTaskId });
    }

    return Results.Ok(new { message = "Đã từ chối nhận mục việc và gửi thông báo phản hồi cho Trưởng nhóm!" });
});

app.MapPost("/api/subtasks/{id:long}/submit", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, s.title, s.status, s.task_id, t.leader_id 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục checklist không tồn tại!" });

    bool isAssigned = conn.ExecuteScalar<int>("SELECT COUNT(1) FROM subtask_assignees WHERE subtask_id = @id AND user_id = @uid", new { id, uid = currentUser.id }) > 0;
    bool isAdmin = currentUser.role == "admin";

    // Khi người nào làm xong thì nộp lên -> Chỉ thành viên được phân công làm mục việc này (hoặc Admin) mới có quyền nộp duyệt!
    if (!isAssigned && !isAdmin)
        return Results.Json(new { detail = "Chỉ thành viên được phân công thực hiện mục việc này mới có quyền nộp duyệt!" }, statusCode: 403);

    if ((string)subtask.status != "PROCESSING")
        return Results.BadRequest(new { detail = $"Chỉ có thể nộp duyệt khi trạng thái đang là Đang thực hiện. Hiện tại: {subtask.status}" });

    conn.Execute(@"
        UPDATE subtasks SET 
            status = 'REVIEW', submitted_for_review_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id", new { id });

    // Gửi thông báo trực tiếp đến Người phụ trách nhiệm vụ (Trưởng nhóm)
    long? subtaskLeaderId = subtask.leader_id != null ? Convert.ToInt64(subtask.leader_id) : (long?)null;
    if (subtaskLeaderId.HasValue && subtaskLeaderId.Value != currentUser.id)
    {
        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
            VALUES (@targetId, @senderId, @title, @msg, 'task', @taskId)",
            new
            {
                targetId = subtaskLeaderId.Value,
                senderId = currentUser.id,
                title = "Mục việc mới cần nghiệm thu",
                msg = $"{currentUser.full_name} (@{currentUser.username}) đã hoàn thành và nộp duyệt mục việc \"{subtask.title}\". Vui lòng kiểm tra và nghiệm thu.",
                taskId = (long)subtask.task_id
            });
    }

    return Results.Ok(new { message = "Đã nộp duyệt mục checklist! Vui lòng chờ Người phụ trách nghiệm thu." });
});

app.MapPost("/api/subtasks/{id:long}/review", (long id, ReviewSubtaskRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, s.title, s.description, s.due_at, s.status, s.task_id, s.cp_points, t.leader_id 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục checklist không tồn tại!" });

    long? subtaskLeaderId = subtask.leader_id != null ? Convert.ToInt64(subtask.leader_id) : (long?)null;
    bool isTaskLeader = subtaskLeaderId.HasValue && subtaskLeaderId.Value == currentUser.id;
    bool isAdmin = currentUser.role == "admin";

    // Người phụ trách cho việc đó mới là người duyệt và nghiệm thu!
    if (!isTaskLeader && !isAdmin)
        return Results.Json(new { detail = "Chỉ người phụ trách nhiệm vụ này (Trưởng nhóm) hoặc Quản trị viên mới có quyền duyệt và nghiệm thu!" }, statusCode: 403);

    // TRƯỜNG HỢP 1: Phạt trừ điểm CP do không hoàn thành / vi phạm
    if (req.is_penalty)
    {
        if ((string)subtask.status != "REVIEW")
            return Results.BadRequest(new { detail = "Chỉ có thể đánh giá không đạt / phạt trừ điểm khi mục việc đã được nộp duyệt (REVIEW)!" });

        if (string.IsNullOrWhiteSpace(req.comment))
            return Results.BadRequest(new { detail = "Vui lòng nhập lý do đánh giá không đạt / phạt trừ điểm!" });

        int baseCp = Convert.ToInt32(subtask.cp_points ?? 0);
        int penalty = req.penalty_points > 0 ? req.penalty_points : Math.Max(1, baseCp);

        conn.Execute(@"
            UPDATE subtasks SET 
                status = 'FAILED', review_comment = @comment, updated_at = CURRENT_TIMESTAMP
            WHERE id = @id",
            new
            {
                id,
                comment = req.comment.Trim()
            });

        // Xóa các giao dịch thưởng dương nếu có khi bị đánh giá Không Đạt
        conn.Execute("DELETE FROM cp_transactions WHERE subtask_id = @id AND cp_earned > 0", new { id });
        // Gỡ liên kết subtask_id của các giao dịch phạt cũ để lưu vết vĩnh viễn không bị xóa đè
        conn.Execute("UPDATE cp_transactions SET subtask_id = NULL WHERE subtask_id = @id AND cp_earned < 0", new { id });

        var assignees = conn.Query<dynamic>(@"
            SELECT sa.user_id, COALESCE(sa.contribution_pct, 100) AS contribution_pct, u.role
            FROM subtask_assignees sa
            JOIN users u ON sa.user_id = u.id
            WHERE sa.subtask_id = @id", new { id }).ToList();

        foreach (var a in assignees)
        {
            if ((string)a.role == "admin") continue; // Không phạt trừ Admin

            long uId = Convert.ToInt64(a.user_id);
            int pct = Convert.ToInt32(a.contribution_pct);
            double cpDeducted = -Math.Round(penalty * (pct / 100.0), 1);
            conn.Execute(@"
                INSERT INTO cp_transactions (user_id, subtask_id, cp_earned, contribution_pct, cp_points_base, quality_multiplier, awarded_at)
                VALUES (@uId, @id, @cpDeducted, @pct, @penalty, 1.0, CURRENT_TIMESTAMP)",
                new { uId, id, cpDeducted, pct, penalty });
            if (uId != currentUser.id)
            {
                conn.Execute(@"
                    INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
                    VALUES (@uId, @senderId, @title, @msg, 'task', @taskId)",
                    new
                    {
                        uId,
                        senderId = currentUser.id,
                        title = "Mục việc bị đánh giá Không Đạt",
                        msg = $"Mục việc \"{subtask.title}\" bị đánh giá không đạt và trừ CP. Lý do: {req.comment.Trim()}",
                        taskId = (long)subtask.task_id
                    });
            }
        }

        return Results.Ok(new { message = $"Đã đánh giá KHÔNG ĐẠT và phạt trừ {penalty} điểm CP của thành viên phụ trách!" });
    }

    // TRƯỜNG HỢP 2: Duyệt ĐẠT & Hoàn thành (cộng điểm CP)
    if (req.approve)
    {
        if ((string)subtask.status != "REVIEW")
            return Results.BadRequest(new { detail = $"Chỉ có thể nghiệm thu đạt khi mục việc đang ở trạng thái Chờ duyệt (REVIEW). Hiện tại: {subtask.status}" });

        double qMultiplier = req.quality_multiplier > 0 ? req.quality_multiplier : 1.0;
        conn.Execute(@"
            UPDATE subtasks SET 
                status = 'FINISHED', review_comment = @comment, quality_multiplier = @qMultiplier, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = @id",
            new
            {
                id,
                comment = string.IsNullOrWhiteSpace(req.comment) ? "Đã nghiệm thu đạt chuẩn" : req.comment.Trim(),
                qMultiplier
            });

        // Award CP to each assignee based on contribution percentage and multiplier (Quản trị viên không nhận điểm CP)
        int cpPoints = Convert.ToInt32(subtask.cp_points ?? 0);
        if (cpPoints > 0)
        {
            var assignees = conn.Query<dynamic>(@"
                SELECT sa.user_id, COALESCE(sa.contribution_pct, 100) AS contribution_pct, u.role
                FROM subtask_assignees sa
                JOIN users u ON sa.user_id = u.id
                WHERE sa.subtask_id = @id", new { id }).ToList();
            
            // Clean up any existing POSITIVE transaction for this subtask (giữ nguyên điểm phạt cp_earned < 0 nếu có)
            conn.Execute("DELETE FROM cp_transactions WHERE subtask_id = @id AND cp_earned > 0", new { id });

            foreach (var a in assignees)
            {
                if ((string)a.role == "admin") continue; // Không tích lũy điểm CP cho Quản trị viên (Admin)

                long uId = Convert.ToInt64(a.user_id);
                int pct = Convert.ToInt32(a.contribution_pct);
                double cpEarned = Math.Round(cpPoints * (pct / 100.0) * qMultiplier, 1);
                conn.Execute(@"
                    INSERT INTO cp_transactions (user_id, subtask_id, cp_earned, contribution_pct, cp_points_base, quality_multiplier, awarded_at)
                    VALUES (@uId, @id, @cpEarned, @pct, @cpPoints, @qMultiplier, CURRENT_TIMESTAMP)",
                    new { uId, id, cpEarned, pct, cpPoints, qMultiplier });

                if (uId != currentUser.id)
                {
                    conn.Execute(@"
                        INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
                        VALUES (@uId, @senderId, @title, @msg, 'task', @taskId)",
                        new
                        {
                            uId,
                            senderId = currentUser.id,
                            title = "Mục việc đã được nghiệm thu Đạt",
                            msg = $"Mục việc \"{subtask.title}\" đã được Người phụ trách nghiệm thu ĐẠT chuẩn và ghi nhận +{cpEarned} CP!",
                            taskId = (long)subtask.task_id
                        });
                }
            }
        }

        long taskId = Convert.ToInt64(subtask.task_id);
        var subtaskStats = conn.QueryFirstOrDefault<dynamic>(@"
            SELECT 
                COUNT(1) AS total,
                SUM(CASE WHEN status IN ('FINISHED', 'FAILED') THEN 1 ELSE 0 END) AS resolved,
                SUM(CASE WHEN status = 'FINISHED' THEN 1 ELSE 0 END) AS finished
            FROM subtasks WHERE task_id = @taskId", new { taskId });

        int totalSubtasks = Convert.ToInt32(subtaskStats?.total ?? 0);
        int resolvedSubtasks = Convert.ToInt32(subtaskStats?.resolved ?? 0);
        bool allResolved = totalSubtasks > 0 && totalSubtasks == resolvedSubtasks;

        if (allResolved)
        {
            conn.Execute(@"
                UPDATE tasks SET status = 'FINISHED', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = @taskId AND status != 'FINISHED'", new { taskId });
        }

        string msg = allResolved
            ? "Đã duyệt ĐẠT mục checklist và tự động nghiệm thu hoàn thành toàn bộ nhiệm vụ lớn!"
            : "Đã duyệt ĐẠT mục checklist và ghi nhận điểm CP đóng góp thành công!";

        return Results.Ok(new { message = msg, task_finished = allResolved });
    }
    // TRƯỜNG HỢP 3: Yêu cầu sửa lại (từ REVIEW) HOẶC Cho làm lại (từ FAILED)
    else
    {
        bool wasFailed = (string)subtask.status == "FAILED";
        long taskId = Convert.ToInt64(subtask.task_id);

        conn.Execute(@"
            UPDATE subtasks SET 
                status = 'PROCESSING', 
                review_comment = @comment, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = @id",
            new
            {
                id,
                comment = wasFailed ? null : req.comment?.Trim()
            });

        // Nếu nhiệm vụ cha đã FINISHED, đưa về IN_PROGRESS vì có việc cần làm lại
        conn.Execute("UPDATE tasks SET status = 'IN_PROGRESS', finished_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = @taskId", new { taskId });

        // Gửi thông báo cho các thành viên phụ trách
        var reworkAssignees = conn.Query<long>("SELECT user_id FROM subtask_assignees WHERE subtask_id = @id", new { id }).ToList();
        foreach (var uId in reworkAssignees)
        {
            if (uId != currentUser.id)
            {
                conn.Execute(@"
                    INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
                    VALUES (@uId, @senderId, @title, @msg, 'task', @taskId)",
                    new
                    {
                        uId,
                        senderId = currentUser.id,
                        title = wasFailed ? "Được cho làm lại mục việc" : "Yêu cầu làm lại mục việc",
                        msg = wasFailed 
                            ? $"Trưởng nhóm đã cho phép bạn làm lại mục việc \"{subtask.title}\" (điểm phạt trừ vẫn bảo lưu). Vui lòng tiếp tục thực hiện và nộp duyệt khi hoàn tất."
                            : $"Mục việc \"{subtask.title}\" được yêu cầu hoàn thiện lại. Nhận xét: {req.comment?.Trim()}",
                        taskId
                    });
            }
        }

        return Results.Ok(new { 
            message = wasFailed 
                ? "Đã cho làm lại mục việc. Mục việc đã chuyển về trạng thái Đang làm và điểm trừ vẫn được bảo lưu!" 
                : "Đã chuyển mục việc về trạng thái Đang làm để thành viên tiếp tục hoàn thiện!" 
        });
    }
});

app.MapDelete("/api/subtasks/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var subtask = conn.QueryFirstOrDefault<dynamic>(@"
        SELECT s.id, s.status AS subtask_status, t.leader_id, t.created_by, t.status AS task_status 
        FROM subtasks s JOIN tasks t ON s.task_id = t.id 
        WHERE s.id = @id", new { id });

    if (subtask == null) return Results.NotFound(new { detail = "Mục checklist không tồn tại!" });

    if ((string)subtask.task_status == "FINISHED")
        return Results.BadRequest(new { detail = "Nhiệm vụ đã hoàn thành, không thể xóa mục việc!" });

    if ((string)subtask.subtask_status == "FINISHED")
        return Results.BadRequest(new { detail = "Mục việc đã hoàn thành và nghiệm thu, không thể xóa!" });

    long? leaderId = subtask.leader_id != null ? Convert.ToInt64(subtask.leader_id) : (long?)null;
    long? createdBy = subtask.created_by != null ? Convert.ToInt64(subtask.created_by) : (long?)null;

    bool isAuthorized = currentUser.role == "admin" 
        || currentUser.can_manage_tasks 
        || (leaderId.HasValue && leaderId.Value == currentUser.id)
        || (createdBy.HasValue && createdBy.Value == currentUser.id);

    if (!isAuthorized)
        return Results.StatusCode(403);

    using var tx = conn.BeginTransaction();
    try
    {
        // QUAN TRỌNG: Giữ nguyên điểm phạt trừ (cp_earned < 0) trong cp_transactions, chỉ gỡ liên kết subtask_id để không mất điểm phạt của thành viên!
        conn.Execute("UPDATE cp_transactions SET subtask_id = NULL WHERE subtask_id = @id AND cp_earned < 0", new { id }, tx);
        // Chỉ xóa điểm thưởng dương nếu có
        conn.Execute("DELETE FROM cp_transactions WHERE subtask_id = @id AND cp_earned > 0", new { id }, tx);
        conn.Execute("DELETE FROM subtask_assignees WHERE subtask_id = @id", new { id }, tx);
        conn.Execute("DELETE FROM subtasks WHERE id = @id", new { id }, tx);
        tx.Commit();
        return Results.Ok(new { message = "Đã xóa mục checklist thành công!" });
    }
    catch (Exception ex)
    {
        tx.Rollback();
        return Results.Problem(detail: "Lỗi khi xóa mục checklist: " + ex.Message, statusCode: 500);
    }
});

// ===== CP LEADERBOARD & STATS ENDPOINTS =====
app.MapGet("/api/cp/leaderboard", (HttpContext ctx) =>
{
    ctx.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
    ctx.Response.Headers.Pragma = "no-cache";
    ctx.Response.Headers.Expires = "0";

    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var list = conn.Query<dynamic>(@"
        SELECT 
            u.id AS user_id, 
            u.username, 
            u.full_name, 
            u.role,
            u.department,
            COALESCE(SUM(cpt.cp_earned), 0) AS total_cp,
            COUNT(DISTINCT cpt.subtask_id) AS subtasks_finished
        FROM users u
        LEFT JOIN cp_transactions cpt ON u.id = cpt.user_id
        WHERE u.role NOT IN ('guest', 'admin')
        GROUP BY u.id, u.username, u.full_name, u.role, u.department
        ORDER BY total_cp DESC, subtasks_finished DESC, u.full_name ASC").ToList();

    var result = list.Select(u =>
    {
        double cp = Convert.ToDouble(u.total_cp);
        string tier;
        double nextTierCp;
        if (cp < 50)
        {
            tier = "Học việc (Junior)";
            nextTierCp = 50;
        }
        else if (cp < 150)
        {
            tier = "Thành viên cốt cán (Active Member)";
            nextTierCp = 150;
        }
        else if (cp < 300)
        {
            tier = "Chuyên gia kỹ thuật (Specialist)";
            nextTierCp = 300;
        }
        else
        {
            tier = "Trụ cột xuất sắc (Master Contributor)";
            nextTierCp = 500;
        }
        double progress = nextTierCp > 0 ? Math.Min(100, Math.Round((cp / nextTierCp) * 100, 1)) : 100;

        return new CpUserSummary
        {
            user_id = Convert.ToInt64(u.user_id),
            username = (string)u.username,
            full_name = (string)u.full_name,
            role = (string)u.role,
            department = (string?)u.department,
            total_cp = Math.Round(cp, 1),
            subtasks_finished = Convert.ToInt32(u.subtasks_finished),
            tier = tier,
            next_tier_cp = nextTierCp,
            progress_pct = progress
        };
    }).ToList();

    return Results.Ok(result);
});

app.MapGet("/api/cp/history/{userId:long}", (long userId, HttpContext ctx) =>
{
    ctx.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
    ctx.Response.Headers.Pragma = "no-cache";
    ctx.Response.Headers.Expires = "0";

    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var history = conn.Query<dynamic>(@"
        SELECT 
            cpt.id,
            cpt.user_id,
            u.full_name AS user_name,
            cpt.subtask_id,
            COALESCE(s.title, 'Mục việc đã phạt/làm lại') AS subtask_title,
            COALESCE(t.title, 'Nhiệm vụ') AS task_title,
            cpt.cp_earned,
            cpt.contribution_pct,
            cpt.quality_multiplier,
            cpt.awarded_at
        FROM cp_transactions cpt
        JOIN users u ON cpt.user_id = u.id
        LEFT JOIN subtasks s ON cpt.subtask_id = s.id
        LEFT JOIN tasks t ON s.task_id = t.id
        WHERE cpt.user_id = @userId
        ORDER BY cpt.awarded_at DESC", new { userId }).ToList();

    return Results.Ok(history);
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
               st.name as shift_name, st.label as shift_label, st.start_time, st.end_time
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
    var user = conn.QueryFirstOrDefault<UserDto>(@"
        SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role, u.department, u.status,
               COALESCE(r.can_manage_schedule, 0) AS can_manage_schedule,
               COALESCE(r.can_manage_tasks, 0) AS can_manage_tasks,
               COALESCE(r.can_manage_staff, CASE WHEN u.role = 'admin' THEN 1 ELSE 0 END) AS can_manage_staff,
               COALESCE(r.can_evaluate, 0) AS can_evaluate,
               COALESCE(r.can_manage_cp, 0) AS can_manage_cp
        FROM users u
        LEFT JOIN roles r ON r.id = u.role
        WHERE u.username = @u AND u.status = 'active'",
        new { u = req.username });

    var userEntity = conn.QueryFirstOrDefault<UserEntity>(
        "SELECT id, password_hash FROM users WHERE username = @u AND status = 'active'",
        new { u = req.username });

    if (user == null || userEntity == null || !Database.VerifyPassword(req.password, userEntity.password_hash))
    {
        return Results.BadRequest(new { detail = "Tên đăng nhập hoặc mật khẩu không chính xác" });
    }

    if (user.role == "admin")
    {
        user.can_manage_staff = true;
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
            status = user.status,
            can_manage_schedule = user.can_manage_schedule,
            can_manage_tasks = user.can_manage_tasks,
            can_manage_staff = user.can_manage_staff,
            can_evaluate = user.can_evaluate,
            can_manage_cp = user.can_manage_cp
        }
    });
});

app.MapGet("/api/auth/me", (HttpContext ctx) =>
{
    ctx.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
    ctx.Response.Headers.Pragma = "no-cache";
    ctx.Response.Headers.Expires = "0";

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
    if (currentUser == null || (currentUser.role != "admin" && !currentUser.can_manage_staff)) return Results.StatusCode(403);

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
    if (currentUser == null || (currentUser.role != "admin" && currentUser.role != "manager")) return Results.StatusCode(403);

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
    if (currentUser == null || (currentUser.role != "admin" && !currentUser.can_manage_staff)) return Results.StatusCode(403);

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


// ================= COMPETENCY EVALUATIONS =================
app.MapGet("/api/competencies", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var list = conn.Query<CompetencyEvaluationDto>(@"
        SELECT u.id, u.username, u.full_name, u.role, u.department, u.status,
               COALESCE(r.display_name, u.role) as role_display_name,
               COALESCE(ce.scores_json, '{}') as scores_json,
               COALESCE(ce.desired_direction, '') as desired_direction,
               COALESCE(ce.commitment_level, '') as commitment_level,
               COALESCE(ce.evidence_notes, '') as evidence_notes,
               ce.updated_at
        FROM users u
        LEFT JOIN roles r ON r.id = u.role
        LEFT JOIN competency_evaluations ce ON ce.user_id = u.id
        WHERE u.status = 'active' AND u.role != 'admin'
        ORDER BY CASE WHEN u.role IN ('core', 'leader') THEN 0 ELSE 1 END, u.id ASC");
    return Results.Ok(list);
});

app.MapPut("/api/competencies/{userId:long}", (long userId, UpdateCompetencyRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    if (!currentUser.can_evaluate)
        return Results.Json(new { detail = "Bạn không có quyền đánh giá hoặc chỉnh sửa điểm năng lực!" }, statusCode: 403);

    using var conn = Database.GetConnection();
    var targetUser = conn.QueryFirstOrDefault<dynamic>("SELECT id, role FROM users WHERE id = @userId", new { userId });
    if (targetUser == null) return Results.NotFound(new { detail = "Không tìm thấy nhân sự!" });
    if ((string)targetUser.role == "admin")
        return Results.BadRequest(new { detail = "Không áp dụng đánh giá năng lực hay tính điểm cho tài khoản Quản trị viên (Admin)!" });

    conn.Execute(@"
        INSERT INTO competency_evaluations (user_id, scores_json, desired_direction, commitment_level, evidence_notes, updated_at)
        VALUES (@userId, @scores, @dir, @commit, @notes, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            scores_json = EXCLUDED.scores_json,
            desired_direction = EXCLUDED.desired_direction,
            commitment_level = EXCLUDED.commitment_level,
            evidence_notes = EXCLUDED.evidence_notes,
            updated_at = CURRENT_TIMESTAMP",
        new {
            userId,
            scores = req.scores_json ?? "{}",
            dir = req.desired_direction ?? "",
            commit = req.commitment_level ?? "",
            notes = req.evidence_notes ?? ""
        });

    return Results.Ok(new { message = "Lưu đánh giá năng lực thành công!" });
});

// ================= ROLES MANAGEMENT =================
app.MapGet("/api/roles", (HttpContext ctx) =>
{
    ctx.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
    ctx.Response.Headers.Pragma = "no-cache";
    ctx.Response.Headers.Expires = "0";

    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var roles = conn.Query<RoleEntity>(@"
        SELECT r.id, r.display_name, r.description, r.color, 
               CASE WHEN r.is_system = 1 THEN 1 ELSE 0 END as is_system,
               CASE WHEN r.can_manage_schedule = 1 THEN 1 ELSE 0 END as can_manage_schedule,
               CASE WHEN r.can_manage_tasks = 1 THEN 1 ELSE 0 END as can_manage_tasks,
               CASE WHEN r.can_manage_staff = 1 THEN 1 ELSE 0 END as can_manage_staff,
               CASE WHEN r.can_evaluate = 1 THEN 1 ELSE 0 END as can_evaluate,
               CASE WHEN r.can_manage_cp = 1 THEN 1 ELSE 0 END as can_manage_cp,
               COUNT(u.id) as user_count,
               r.created_at
        FROM roles r
        LEFT JOIN users u ON u.role = r.id
        GROUP BY r.id, r.display_name, r.description, r.color, r.is_system, r.can_manage_schedule, r.can_manage_tasks, r.can_manage_staff, r.can_evaluate, r.can_manage_cp, r.created_at
        ORDER BY r.is_system DESC, r.id ASC");
    return Results.Ok(roles);
});

app.MapPost("/api/roles", (CreateRoleRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null)
        return Results.Json(new { detail = "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!" }, statusCode: 401);
    if (currentUser.role != "admin" && !currentUser.can_manage_staff) 
        return Results.Json(new { detail = "Chỉ Quản trị viên hoặc người có quyền Quản lý nhân sự mới được tạo vai trò!" }, statusCode: 403);

    if (string.IsNullOrWhiteSpace(req.id) || string.IsNullOrWhiteSpace(req.display_name))
        return Results.BadRequest(new { detail = "Mã vai trò và tên hiển thị không được để trống!" });

    var cleanId = req.id.Trim().ToLower().Replace(" ", "_");

    using var conn = Database.GetConnection();
    var exists = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM roles WHERE id = @id", new { id = cleanId });
    if (exists > 0)
        return Results.BadRequest(new { detail = "Mã vai trò này đã tồn tại trong hệ thống!" });

    conn.Execute(@"
        INSERT INTO roles (id, display_name, description, color, is_system, can_manage_schedule, can_manage_tasks, can_manage_staff, can_evaluate, can_manage_cp)
        VALUES (@id, @name, @desc, @color, 0, @cms, @cmt, @cmu, @cev, @ccp)",
        new { 
            id = cleanId, 
            name = req.display_name.Trim(),
            desc = req.description ?? "", 
            color = string.IsNullOrWhiteSpace(req.color) ? "#3b82f6" : req.color,
            cms = req.can_manage_schedule ? 1 : 0,
            cmt = req.can_manage_tasks ? 1 : 0,
            cmu = req.can_manage_staff ? 1 : 0,
            cev = req.can_evaluate ? 1 : 0,
            ccp = req.can_manage_cp ? 1 : 0
        });

    return Results.Ok(new { message = "Thêm vai trò mới thành công!", role_id = cleanId });
});

app.MapPut("/api/roles/{id}", (string id, UpdateRoleRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null)
        return Results.Json(new { detail = "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!" }, statusCode: 401);
    if (currentUser.role != "admin" && !currentUser.can_manage_staff) 
        return Results.Json(new { detail = "Chỉ Quản trị viên hoặc người có quyền Quản lý nhân sự mới được cập nhật vai trò!" }, statusCode: 403);

    using var conn = Database.GetConnection();
    var role = conn.QueryFirstOrDefault<RoleEntity>("SELECT * FROM roles WHERE id = @id", new { id });
    if (role == null) return Results.NotFound(new { detail = "Không tìm thấy vai trò!" });

    conn.Execute(@"
        UPDATE roles
        SET display_name = @name, description = @desc, color = @color,
            can_manage_schedule = @cms, can_manage_tasks = @cmt, can_manage_staff = @cmu,
            can_evaluate = @cev,
            can_manage_cp = @ccp
        WHERE id = @id",
        new { 
            name = string.IsNullOrWhiteSpace(req.display_name) ? role.display_name : req.display_name.Trim(), 
            desc = req.description ?? "", 
            color = string.IsNullOrWhiteSpace(req.color) ? "#3b82f6" : req.color,
            cms = req.can_manage_schedule ? 1 : 0,
            cmt = req.can_manage_tasks ? 1 : 0,
            cmu = req.can_manage_staff ? 1 : 0,
            cev = req.can_evaluate ? 1 : 0,
            ccp = req.can_manage_cp ? 1 : 0,
            id 
        });

    return Results.Ok(new { message = "Cập nhật vai trò thành công!" });
});

app.MapDelete("/api/roles/{id}", (string id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null)
        return Results.Json(new { detail = "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại!" }, statusCode: 401);
    if (currentUser.role != "admin") 
        return Results.Json(new { detail = "Chỉ Quản trị viên cấp cao nhất mới có quyền xóa vai trò hệ thống!" }, statusCode: 403);

    using var conn = Database.GetConnection();
    var role = conn.QueryFirstOrDefault<RoleEntity>("SELECT * FROM roles WHERE id = @id", new { id });
    if (role == null) return Results.NotFound(new { detail = "Không tìm thấy vai trò!" });

    if (role.is_system)
        return Results.BadRequest(new { detail = "Không thể xóa vai trò mặc định của hệ thống!" });

    var userCount = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM users WHERE role = @id", new { id });
    if (userCount > 0)
        return Results.BadRequest(new { detail = $"Đang có {userCount} nhân sự giữ vai trò này. Vui lòng chuyển vai trò của họ trước khi xóa!" });

    conn.Execute("DELETE FROM roles WHERE id = @id", new { id });
    return Results.Ok(new { message = "Đã xóa vai trò thành công!" });
});

// ================= DEPARTMENTS MANAGEMENT =================
app.MapGet("/api/departments", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var depts = conn.Query<DepartmentEntity>(@"
        SELECT d.id, d.name, d.code, d.description, d.manager_name, d.color, d.created_at,
               COUNT(u.id) as member_count
        FROM departments d
        LEFT JOIN users u ON u.department = d.name
        GROUP BY d.id, d.name, d.code, d.description, d.manager_name, d.color, d.created_at
        ORDER BY d.id ASC");
    return Results.Ok(depts);
});

app.MapPost("/api/departments", (CreateDepartmentRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || (currentUser.role != "admin" && !currentUser.can_manage_staff)) 
        return Results.StatusCode(403);

    if (string.IsNullOrWhiteSpace(req.name))
        return Results.BadRequest(new { detail = "Tên phòng ban / tổ trực không được để trống!" });

    using var conn = Database.GetConnection();
    var exists = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM departments WHERE name = @name", new { name = req.name.Trim() });
    if (exists > 0)
        return Results.BadRequest(new { detail = "Phòng ban / Tổ trực này đã tồn tại!" });

    string pkReturn = Database.IsPostgres ? "RETURNING id" : "; SELECT last_insert_rowid();";
    var newId = conn.ExecuteScalar<long>($@"
        INSERT INTO departments (name, code, description, manager_name, color)
        VALUES (@name, @code, @desc, @mgr, @color) {pkReturn}",
        new { 
            name = req.name.Trim(), 
            code = req.code?.Trim() ?? "", 
            desc = req.description ?? "", 
            mgr = req.manager_name ?? "", 
            color = string.IsNullOrWhiteSpace(req.color) ? "#3b82f6" : req.color 
        });

    return Results.Ok(new { message = "Thêm phòng ban / tổ trực thành công!", department_id = newId });
});

app.MapPut("/api/departments/{id:long}", (long id, UpdateDepartmentRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || (currentUser.role != "admin" && !currentUser.can_manage_staff)) 
        return Results.StatusCode(403);

    if (string.IsNullOrWhiteSpace(req.name))
        return Results.BadRequest(new { detail = "Tên phòng ban không được để trống!" });

    using var conn = Database.GetConnection();
    var dept = conn.QueryFirstOrDefault<DepartmentEntity>("SELECT * FROM departments WHERE id = @id", new { id });
    if (dept == null) return Results.NotFound(new { detail = "Không tìm thấy phòng ban!" });

    var oldName = dept.name;
    var newName = req.name.Trim();

    conn.Execute(@"
        UPDATE departments
        SET name = @name, code = @code, description = @desc, manager_name = @mgr, color = @color
        WHERE id = @id",
        new { name = newName, code = req.code?.Trim() ?? "", desc = req.description ?? "", mgr = req.manager_name ?? "", color = string.IsNullOrWhiteSpace(req.color) ? dept.color : req.color, id });

    // Sync department name in users table if name changed
    if (oldName != newName)
    {
        conn.Execute("UPDATE users SET department = @newName WHERE department = @oldName", new { newName, oldName });
    }

    return Results.Ok(new { message = "Cập nhật phòng ban thành công!" });
});

app.MapDelete("/api/departments/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || (currentUser.role != "admin" && !currentUser.can_manage_staff)) 
        return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var dept = conn.QueryFirstOrDefault<DepartmentEntity>("SELECT * FROM departments WHERE id = @id", new { id });
    if (dept == null) return Results.NotFound(new { detail = "Không tìm thấy phòng ban!" });

    var memberCount = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM users WHERE department = @name", new { name = dept.name });
    if (memberCount > 0)
        return Results.BadRequest(new { detail = $"Đang có {memberCount} nhân viên thuộc phòng ban này. Vui lòng chuyển phòng ban cho họ trước khi xóa!" });

    conn.Execute("DELETE FROM departments WHERE id = @id", new { id });
    return Results.Ok(new { message = "Đã xóa phòng ban thành công!" });
});


// ================= SHIFTS & SCHEDULE =================
app.MapGet("/api/shifts/templates", () =>
{
    using var conn = Database.GetConnection();
    var shifts = conn.Query("SELECT id, name, start_time, end_time, label, description FROM shift_templates ORDER BY id ASC");
    return Results.Ok(shifts);
});

int SyncClassScheduleKpiDeductions(System.Data.Common.DbConnection conn, long? targetUserId = null, string? startDate = null, string? endDate = null)
{
    try
    {
        var shifts = conn.Query<dynamic>("SELECT id, name, start_time, end_time, label FROM shift_templates WHERE id > 0 ORDER BY id ASC").ToList();
        if (shifts.Count == 0) return 0;

        string csQuery = @"
            SELECT cs.id, cs.user_id, cs.course_code, cs.class_name, cs.work_date, cs.start_time, cs.end_time, cs.room
            FROM class_schedules cs
            WHERE (@targetUserId IS NULL OR cs.user_id = @targetUserId)
              AND (@startDate IS NULL OR cs.work_date >= @startDate)
              AND (@endDate IS NULL OR cs.work_date <= @endDate)";

        var classes = conn.Query<dynamic>(csQuery, new { targetUserId, startDate, endDate }).ToList();

        int deductedCount = 0;
        var conflictsMap = new Dictionary<(long userId, string workDate, int shiftId), dynamic>();

        foreach (var c in classes)
        {
            long uid = (long)c.user_id;
            string wdate = (string)c.work_date;
            string cStart = (string)c.start_time;
            string cEnd = (string)c.end_time;

            foreach (var s in shifts)
            {
                int sid = (int)s.id;
                string sStart = (string)s.start_time;
                string sEnd = (string)s.end_time;

                string maxStart = string.Compare(sStart, cStart, StringComparison.Ordinal) > 0 ? sStart : cStart;
                string minEnd = string.Compare(sEnd, cEnd, StringComparison.Ordinal) < 0 ? sEnd : cEnd;

                if (string.Compare(maxStart, minEnd, StringComparison.Ordinal) < 0)
                {
                    var key = (uid, wdate, sid);
                    if (!conflictsMap.ContainsKey(key))
                    {
                        conflictsMap[key] = c;
                    }
                }
            }
        }

        foreach (var kvp in conflictsMap)
        {
            long uid = kvp.Key.userId;
            string wdate = kvp.Key.workDate;
            int sid = kvp.Key.shiftId;
            var c = kvp.Value;

            string code = (string)(c.course_code ?? "");
            string cname = (string)c.class_name;
            string ctime = $"{(string)c.start_time} - {(string)c.end_time}";
            string croom = (string)(c.room ?? "");

            string absenceReason = $"Trùng lịch học: {(string.IsNullOrEmpty(code) ? "" : code + " - ")}{cname} ({ctime}){(string.IsNullOrEmpty(croom) ? "" : " tại " + croom)}";
            string timeNote = $"Trùng TKB {(string.IsNullOrEmpty(code) ? cname : code)} (Trừ KPI)";
            string note = $"Hệ thống tự động trừ KPI do nộp lịch học trùng ca trực: {cname} ({ctime})";

            var reg = conn.QueryFirstOrDefault<dynamic>(
                "SELECT id, attendance_status, absence_reason FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
                new { uid, sid, wdate });

            if (reg == null)
            {
                conn.Execute(@"
                    INSERT INTO shift_registrations (user_id, shift_id, work_date, status, attendance_status, absence_reason, time_note, note, absence_approved_at)
                    VALUES (@uid, @sid, @wdate, 'registered', 'absent', @absenceReason, @timeNote, @note, CURRENT_TIMESTAMP)",
                    new { uid, sid, wdate, absenceReason, timeNote, note });
                deductedCount++;
            }
            else
            {
                string curAtt = (string)(reg.attendance_status ?? "");
                string curReason = (string)(reg.absence_reason ?? "");

                if (curAtt != "absent" || !curReason.StartsWith("Trùng lịch học"))
                {
                    conn.Execute(@"
                        UPDATE shift_registrations
                        SET attendance_status = 'absent',
                            absence_reason = @absenceReason,
                            time_note = @timeNote,
                            note = @note,
                            absence_approved_at = CURRENT_TIMESTAMP
                        WHERE id = @id",
                        new { absenceReason, timeNote, note, id = (long)reg.id });
                    deductedCount++;
                }
            }
        }

        // Khôi phục ca trực nếu TKB bị xóa
        string checkAbsentsQuery = @"
            SELECT sr.id, sr.user_id, sr.shift_id, sr.work_date
            FROM shift_registrations sr
            WHERE sr.attendance_status = 'absent'
              AND sr.absence_reason LIKE 'Trùng lịch học%'
              AND (@targetUserId IS NULL OR sr.user_id = @targetUserId)
              AND (@startDate IS NULL OR sr.work_date >= @startDate)
              AND (@endDate IS NULL OR sr.work_date <= @endDate)";

        var autoAbsents = conn.Query<dynamic>(checkAbsentsQuery, new { targetUserId, startDate, endDate }).ToList();
        foreach (var ab in autoAbsents)
        {
            long uid = (long)ab.user_id;
            string wdate = (string)ab.work_date;
            int sid = (int)ab.shift_id;
            var key = (uid, wdate, sid);

            if (!conflictsMap.ContainsKey(key))
            {
                conn.Execute(@"
                    UPDATE shift_registrations
                    SET attendance_status = 'present',
                        absence_reason = NULL,
                        time_note = NULL,
                        note = 'Lịch trực định kỳ (Khôi phục sau khi xóa TKB)'
                    WHERE id = @id",
                    new { id = (long)ab.id });
            }
        }

        return conflictsMap.Count;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[SyncClassScheduleKpiDeductions Error]: {ex.Message}");
        return 0;
    }
}

void EnsureWeeklySchedule(System.Data.Common.DbConnection conn, string startDateStr, string endDateStr)
{
    if (!DateTime.TryParse(startDateStr, out var startDate) || !DateTime.TryParse(endDateStr, out var endDate))
    {
        return;
    }

    int startDiff = ((int)startDate.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
    var currentMonday = startDate.Date.AddDays(-startDiff);

    var activeUsers = conn.Query<long>("SELECT id FROM users WHERE status = 'active' OR status IS NULL").ToList();
    if (activeUsers.Count == 0)
    {
        return;
    }

    int requiredSlotsPerWeek = activeUsers.Count * 54;

    while (currentMonday <= endDate.Date)
    {
        var weekEnd = currentMonday.AddDays(6);
        string wStartStr = currentMonday.ToString("yyyy-MM-dd");
        string wEndStr = weekEnd.ToString("yyyy-MM-dd");

        var totalCount = conn.ExecuteScalar<int>(@"
            SELECT COUNT(1) FROM shift_registrations 
            WHERE work_date >= @wStart AND work_date <= @wEnd",
            new { wStart = wStartStr, wEnd = wEndStr }
        );

        if (totalCount < requiredSlotsPerWeek)
        {
            using var tx = conn.BeginTransaction();
            for (int d = 0; d < 6; d++)
            {
                var targetWorkDate = currentMonday.AddDays(d).ToString("yyyy-MM-dd");
                for (int sid = 1; sid <= 9; sid++)
                {
                    foreach (var uid in activeUsers)
                    {
                        conn.Execute(@"
                            INSERT INTO shift_registrations (user_id, shift_id, work_date, status, note, attendance_status)
                            VALUES (@uid, @sid, @wdate, 'registered', 'Lịch trực định kỳ', 'present')
                            ON CONFLICT (user_id, shift_id, work_date) DO NOTHING",
                            new { uid, sid, wdate = targetWorkDate },
                            transaction: tx
                        );
                    }
                }
            }
            tx.Commit();
        }

        currentMonday = currentMonday.AddDays(7);
    }

    SyncClassScheduleKpiDeductions(conn, null, startDateStr, endDateStr);
}

app.MapGet("/api/shifts/schedule", (string start_date, string end_date, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    EnsureWeeklySchedule(conn, start_date, end_date);

    var query = @"
        SELECT sr.id, sr.user_id, sr.shift_id, sr.work_date, sr.status, sr.note,
               sr.target_shift_id, sr.target_work_date, sr.request_reason,
               COALESCE(sr.attendance_status, 'present') as attendance_status,
               sr.actual_hours, sr.time_note,
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
    EnsureWeeklySchedule(conn, work_date, work_date);
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

    var canManage = currentUser.role == "admin" || currentUser.can_manage_schedule;
    var targetUserId = (canManage && req.user_id.HasValue) 
        ? req.user_id.Value 
        : currentUser.id;

    using var conn = Database.GetConnection();
    var targetUser = conn.QueryFirstOrDefault("SELECT * FROM users WHERE id = @id", new { id = targetUserId });
    if (targetUser == null) return Results.NotFound(new { detail = "Không tìm thấy nhân sự!" });

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

    var validDates = targetDates.Where(d => string.Compare(d, todayStr, StringComparison.Ordinal) >= 0).ToList();
    if (validDates.Count == 0)
    {
        return Results.BadRequest(new { detail = "Không thể nộp đơn báo vắng cho các ngày trong quá khứ! Vui lòng chỉ chọn ngày hôm nay hoặc tương lai. Nếu nhân viên bỏ ca trong quá khứ, Quản lý vui lòng dùng chức năng Đánh dấu vắng trong bảng điểm danh." });
    }

    // Target shift IDs (1-9)
    var targetShifts = (req.shift_ids != null && req.shift_ids.Count > 0)
        ? req.shift_ids.Where(s => s >= 1 && s <= 9).Distinct().ToList()
        : Enumerable.Range(1, 9).ToList();

    int affectedCount = 0;
    int skippedDuplicates = 0;

    foreach (var date in validDates)
    {
        EnsureWeeklySchedule(conn, date, date);
    }

    foreach (var date in validDates.OrderBy(x => x))
    {

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
                string attStatus = existingReg.attendance_status ?? "present";
                if (attStatus == "pending_absence" || attStatus == "absent")
                {
                    skippedDuplicates++;
                    continue;
                }

                conn.Execute(@"
                    UPDATE shift_registrations 
                    SET status = 'registered',
                        attendance_status = 'pending_absence', 
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

    if (affectedCount == 0)
    {
        if (skippedDuplicates > 0)
        {
            return Results.BadRequest(new { detail = $"Tất cả {skippedDuplicates} ca làm việc được chọn đều đã nộp đơn báo vắng (đang chờ duyệt) hoặc đã được phê duyệt nghỉ. Không thể gửi trùng lặp!" });
        }
        return Results.BadRequest(new { detail = "Nhân sự không có ca trực nào được phân công trong phạm vi ngày/ca đã chọn để nộp đơn báo vắng!" });
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

    // Ghi nhật ký lịch sử
    conn.Execute(@"
        INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
        VALUES (@uid, 0, @wdate, 'SUBMIT_BULK_ABSENCE', @note)",
        new {
            uid = targetUserId,
            wdate = targetDates.Min(),
            note = $"{targetUser.full_name} đã nộp đơn xin vắng hàng loạt {affectedCount} ca ({targetDates.Min()} đến {targetDates.Max()}). Lý do: {req.reason.Trim()} (Chờ duyệt)"
        }
    );

    var successMessage = $"Đã gửi đơn xin nghỉ thành công cho {affectedCount} ca làm việc!";
    if (skippedDuplicates > 0)
    {
        successMessage += $" (Đã tự động bỏ qua {skippedDuplicates} ca đã nộp đơn trước đó để tránh trùng lặp)";
    }

    return Results.Ok(new {
        success = true,
        affected_count = affectedCount,
        skipped_duplicates = skippedDuplicates,
        dates_count = targetDates.Count,
        message = successMessage
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

    var todayStr = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd");
    if (string.Compare(req.work_date, todayStr, StringComparison.Ordinal) < 0)
    {
        return Results.BadRequest(new { detail = "Không thể nộp đơn báo vắng cho ca trực trong quá khứ! Vui lòng chỉ báo vắng cho ca hôm nay hoặc tương lai. Nếu nhân viên bỏ ca trong quá khứ, Quản lý vui lòng dùng chức năng Đánh dấu vắng trong bảng điểm danh." });
    }

    var canManage = currentUser.role == "admin" || currentUser.can_manage_schedule;
    var targetUserId = (canManage && req.user_id.HasValue) 
        ? req.user_id.Value 
        : currentUser.id;

    using var conn = Database.GetConnection();
    EnsureWeeklySchedule(conn, req.work_date, req.work_date);
    var targetUser = conn.QueryFirstOrDefault("SELECT * FROM users WHERE id = @id", new { id = targetUserId });
    if (targetUser == null) return Results.NotFound(new { detail = "Không tìm thấy nhân sự!" });

    var shift = conn.QueryFirstOrDefault("SELECT * FROM shift_templates WHERE id = @id", new { id = req.shift_id });
    var existingReg = conn.QueryFirstOrDefault(
        "SELECT id, attendance_status FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
        new { uid = targetUserId, sid = req.shift_id, wdate = req.work_date }
    );

    // Khi nhân sự báo vắng: Trạng thái là pending_absence (chờ Quản lý phê duyệt)
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
        // Không cho phép báo vắng trùng lặp nếu ca này đã có đơn chờ duyệt hoặc đã được duyệt nghỉ
        string attStatus = existingReg.attendance_status ?? "present";
        if (attStatus == "pending_absence")
        {
            return Results.BadRequest(new { detail = "Bạn đã nộp đơn báo vắng cho ca trực này rồi và đang chờ Quản lý phê duyệt. Không thể gửi trùng lặp!" });
        }
        if (attStatus == "absent")
        {
            return Results.BadRequest(new { detail = "Ca trực này đã được Quản lý phê duyệt vắng mặt rồi, không cần gửi lại đơn!" });
        }

        conn.Execute(@"
            UPDATE shift_registrations 
            SET status = 'registered',
                attendance_status = 'pending_absence', 
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

    var canApproveAbsence = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || currentUser.can_manage_schedule || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));
    if (!canApproveAbsence)
    {
        return Results.Json(new { detail = "Chỉ Quản trị viên (Admin) hoặc Trưởng nhóm (Leader) mới có quyền phê duyệt hoặc từ chối đơn báo vắng!" }, statusCode: 403);
    }

    using var conn = Database.GetConnection();
    var targetUser = conn.QueryFirstOrDefault("SELECT * FROM users WHERE id = @id", new { id = req.user_id });
    if (targetUser == null) return Results.NotFound(new { detail = "Không tìm thấy nhân sự!" });

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

    var canManage = currentUser.role == "admin" || currentUser.can_manage_schedule;
    var targetUserId = (canManage && req.user_id.HasValue && req.user_id.Value > 0) 
        ? req.user_id.Value 
        : currentUser.id;

    using var conn = Database.GetConnection();
    conn.Execute(@"
        UPDATE shift_registrations 
        SET attendance_status = 'present', 
            absence_reason = NULL,
            absence_approved_by = NULL,
            absence_approved_at = NULL,
            actual_hours = NULL,
            note = 'Đã xác nhận có mặt'
        WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
        new { uid = targetUserId, sid = req.shift_id, wdate = req.work_date }
    );

    return Results.Ok(new { success = true, message = "Đã xác nhận có mặt trở lại ca trực!" });
});

app.MapPost("/api/shifts/cancel-absence-bulk", (BulkCancelAbsenceRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    var canManage = currentUser.role == "admin" || currentUser.can_manage_schedule;
    
    using var conn = Database.GetConnection();
    long? targetUserId = null;
    string targetName = "tất cả nhân sự";

    if (canManage)
    {
        if (req.user_id.HasValue && req.user_id.Value > 0)
        {
            targetUserId = req.user_id.Value;
            var targetUser = conn.QueryFirstOrDefault("SELECT full_name FROM users WHERE id = @id", new { id = targetUserId.Value });
            if (targetUser == null) return Results.NotFound(new { detail = "Không tìm thấy nhân sự!" });
            targetName = (string)targetUser.full_name;
        }
    }
    else
    {
        targetUserId = currentUser.id;
        targetName = currentUser.full_name;
    }

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
        return Results.BadRequest(new { detail = "Vui lòng chọn ngày hoặc khoảng ngày cần khôi phục có mặt!" });
    }

    // Only allow restoring for today or future dates for regular members; managers/admins can restore any dates
    var validDates = canManage 
        ? targetDates.ToList() 
        : targetDates.Where(d => string.Compare(d, todayStr, StringComparison.Ordinal) >= 0).ToList();

    if (validDates.Count == 0)
    {
        return Results.BadRequest(new { detail = "Không thể khôi phục có mặt cho các ngày trong quá khứ đối với nhân viên!" });
    }

    // Target shift IDs (1-9)
    var targetShifts = (req.shift_ids != null && req.shift_ids.Count > 0)
        ? req.shift_ids.Where(s => s >= 1 && s <= 9).Distinct().ToList()
        : new List<int> { 1, 2, 3, 4, 5, 6, 7, 8, 9 };

    int affectedCount = 0;
    if (targetUserId.HasValue)
    {
        affectedCount = conn.Execute(@"
            UPDATE shift_registrations 
            SET attendance_status = 'present', 
                absence_reason = NULL,
                absence_approved_by = NULL,
                absence_approved_at = NULL,
                actual_hours = NULL,
                note = 'Đã khôi phục có mặt'
            WHERE user_id = @uid 
              AND shift_id IN @shifts 
              AND work_date IN @dates 
              AND (attendance_status = 'absent' OR attendance_status = 'pending_absence')",
            new { uid = targetUserId.Value, shifts = targetShifts, dates = validDates }
        );
    }
    else
    {
        affectedCount = conn.Execute(@"
            UPDATE shift_registrations 
            SET attendance_status = 'present', 
                absence_reason = NULL,
                absence_approved_by = NULL,
                absence_approved_at = NULL,
                actual_hours = NULL,
                note = 'Đã khôi phục có mặt'
            WHERE shift_id IN @shifts 
              AND work_date IN @dates 
              AND (attendance_status = 'absent' OR attendance_status = 'pending_absence')",
            new { shifts = targetShifts, dates = validDates }
        );
    }

    return Results.Ok(new 
    { 
        success = true, 
        message = $"Đã khôi phục có mặt thành công cho {affectedCount} ca trực của {targetName}!",
        affected_count = affectedCount
    });
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
    if (currentUser.role != "admin" && !currentUser.can_manage_schedule && currentUser.role != "leader" && currentUser.role != "manager")
    {
        return Results.StatusCode(403);
    }

    if (string.IsNullOrWhiteSpace(req.title))
    {
        return Results.BadRequest(new { detail = "Vui lòng nhập tên sự kiện!" });
    }

    try
    {
        using var conn = Database.GetConnection();
        var targetShifts = req.shift_ids != null && req.shift_ids.Count > 0
            ? req.shift_ids
            : new List<int> { req.shift_id ?? 0 };

        if (targetShifts.Contains(0))
        {
            conn.Execute(@"
                INSERT INTO shift_events (shift_id, work_date, title, description, event_type)
                VALUES (0, @work_date, @title, @description, @event_type);",
                new {
                    work_date = req.work_date,
                    title = req.title.Trim(),
                    description = req.description?.Trim(),
                    event_type = req.event_type ?? "general"
                });
        }
        else
        {
            foreach (var sid in targetShifts)
            {
                conn.Execute(@"
                    INSERT INTO shift_events (shift_id, work_date, title, description, event_type)
                    VALUES (@sid, @work_date, @title, @description, @event_type);",
                    new {
                        sid,
                        work_date = req.work_date,
                        title = req.title.Trim(),
                        description = req.description?.Trim(),
                        event_type = req.event_type ?? "general"
                    });
            }
        }

        return Results.Ok(new { 
            success = true, 
            message = targetShifts.Contains(0) ? "Thêm sự kiện cả ngày thành công!" : "Thêm sự kiện cho ca làm việc thành công!" 
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[ERROR] create shift event: {ex}");
        return Results.BadRequest(new { detail = "Lỗi khi lưu sự kiện: " + ex.Message });
    }
});

app.MapDelete("/api/shifts/events/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin" && !currentUser.can_manage_schedule && currentUser.role != "leader" && currentUser.role != "manager")
    {
        return Results.StatusCode(403);
    }

    using var conn = Database.GetConnection();
    conn.Execute("DELETE FROM shift_events WHERE id = @id", new { id });
    return Results.Ok(new { success = true, message = "Xóa sự kiện thành công!" });
});

app.MapPost("/api/shifts/attendance/hours", (UpdateActualHoursRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    var canManage = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || currentUser.can_manage_schedule || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));
    if (!canManage) return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var reg = conn.QueryFirstOrDefault(
        "SELECT id, attendance_status, actual_hours FROM shift_registrations WHERE user_id = @uid AND shift_id = @sid AND work_date = @wdate",
        new { uid = req.user_id, sid = req.shift_id, wdate = req.work_date }
    );

    var newStatus = (req.actual_hours.HasValue && req.actual_hours.Value <= 0) ? "absent" : "present";

    if (reg == null)
    {
        conn.Execute(@"
            INSERT INTO shift_registrations (user_id, shift_id, work_date, attendance_status, status, actual_hours, time_note, note)
            VALUES (@uid, @sid, @wdate, @newStatus, 'confirmed', @hours, @time_note, @note)",
            new { 
                uid = req.user_id, 
                sid = req.shift_id, 
                wdate = req.work_date, 
                newStatus,
                hours = req.actual_hours,
                time_note = req.time_note,
                note = $"Ghi nhận giờ thực tế: {req.actual_hours}h" 
            });
    }
    else
    {
        conn.Execute(@"
            UPDATE shift_registrations 
            SET actual_hours = @hours, time_note = @time_note, attendance_status = @newStatus
            WHERE id = @id", 
            new { hours = req.actual_hours, time_note = req.time_note, newStatus, id = (long)reg.id });
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

    var canManage = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || currentUser.can_manage_schedule || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));
    if (req.attendance_status == "absent" && !canManage)
    {
        return Results.Json(new { detail = "Chỉ Quản trị viên (Admin) hoặc Trưởng nhóm (Leader) mới có quyền đánh dấu hoặc duyệt vắng ca trực!" }, statusCode: 403);
    }

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

    var canManage = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || currentUser.can_manage_schedule || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));
    if (req.attendance_status == "absent" && !canManage)
    {
        return Results.Json(new { detail = "Chỉ Quản trị viên (Admin) hoặc Trưởng nhóm (Leader) mới có quyền đánh dấu hoặc duyệt vắng ca trực!" }, statusCode: 403);
    }

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

    var canManage = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || currentUser.can_manage_schedule || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));

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
        (canManage ? "" : "AND sr.user_id = @uid ") +
        "ORDER BY sr.id DESC";

    var rows = conn.Query(sql, new { uid = currentUser.id, today });
    return Results.Ok(rows);
});

app.MapPost("/api/shifts/register", (ShiftRegistrationRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    var canManage = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || currentUser.can_manage_schedule || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));
    var targetUserId = (canManage && req.user_id.HasValue && req.user_id.Value > 0)
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
    var canManage = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || currentUser.can_manage_schedule || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));
    if (!canManage) return Results.StatusCode(403);

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

// Endpoint phê duyệt tất cả (hoặc hàng loạt) các yêu cầu chưa quá hạn (báo vắng, hủy ca, đổi ca)
app.MapPost("/api/shifts/requests/approve-all", (BulkApproveShiftRequests? req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    var canApprove = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || currentUser.can_manage_schedule || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));
    if (!canApprove) return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    var today = DateTime.UtcNow.AddHours(7).ToString("yyyy-MM-dd");

    string query = @"
        SELECT sr.id, sr.user_id, sr.shift_id, sr.work_date, sr.status, sr.request_reason,
               sr.attendance_status, sr.absence_reason, sr.target_shift_id, sr.target_work_date,
               u.full_name, u.email,
               st.name as shift_name, st.label as shift_label,
               tgt.name as target_shift_name, tgt.label as target_shift_label
        FROM shift_registrations sr
        JOIN users u ON sr.user_id = u.id
        JOIN shift_templates st ON sr.shift_id = st.id
        LEFT JOIN shift_templates tgt ON sr.target_shift_id = tgt.id
        WHERE (sr.status IN ('pending_cancel', 'pending_change') OR sr.attendance_status = 'pending_absence')";

    List<dynamic> items;
    if (req?.registration_ids != null && req.registration_ids.Count > 0)
    {
        string ids = string.Join(",", req.registration_ids.Select(x => x.ToString()));
        query += $" AND sr.id IN ({ids})";
        items = conn.Query<dynamic>(query).ToList();
    }
    else
    {
        items = conn.Query<dynamic>(query).ToList();
    }

    int approvedCount = 0;
    foreach (var item in items)
    {
        long regId = (long)item.id;
        long userId = (long)item.user_id;
        int shiftId = (int)item.shift_id;
        string workDate = (string)item.work_date;
        string status = (string)item.status;
        string attStatus = (string)(item.attendance_status ?? "");
        string staffName = (string)item.full_name;
        string shiftName = (string)item.shift_name;
        string shiftLabel = (string)(item.shift_label ?? "");

        if (attStatus == "pending_absence")
        {
            if (!canApprove)
            {
                continue;
            }
            conn.Execute(@"
                UPDATE shift_registrations
                SET attendance_status = 'absent',
                    absence_approved_by = @approver,
                    absence_approved_at = CURRENT_TIMESTAMP,
                    note = @note
                WHERE id = @id",
                new {
                    approver = currentUser.id,
                    note = $"Quản lý {currentUser.full_name} đã PHÊ DUYỆT đơn nghỉ vắng.",
                    id = regId
                });

            conn.Execute(@"
                INSERT INTO notifications (target_user_id, sender_id, title, message, type)
                VALUES (@target, @sender, @title, @msg, 'absence_approved')",
                new {
                    target = userId,
                    sender = currentUser.id,
                    title = "Đơn báo vắng đã được Quản lý phê duyệt",
                    msg = $"Quản lý {currentUser.full_name} đã PHÊ DUYỆT đơn xin vắng ca {shiftName} ({shiftLabel}) ngày {workDate} của bạn."
                });

            conn.Execute(@"
                INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
                VALUES (@uid, @sid, @wdate, 'APPROVE_ABSENCE', @note)",
                new {
                    uid = userId,
                    sid = shiftId,
                    wdate = workDate,
                    note = $"Quản lý {currentUser.full_name} đã phê duyệt cho {staffName} vắng ca {shiftName}."
                });
            approvedCount++;
        }
        else if (status == "pending_cancel")
        {
            conn.Execute("DELETE FROM shift_registrations WHERE id = @id", new { id = regId });

            conn.Execute(@"
                INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
                VALUES (@uid, @sid, @date, 'APPROVED_CANCEL', @note)",
                new {
                    uid = userId,
                    sid = shiftId,
                    date = workDate,
                    note = $"Quản lý ({currentUser.full_name}) đã DUYỆT hủy ca {shiftName} ({workDate})."
                });

            conn.Execute(@"
                INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
                VALUES (@target, @sender, 'Yêu cầu hủy ca đã được duyệt', @msg, 'shift_approved', @rel)",
                new {
                    target = userId,
                    sender = currentUser.id,
                    msg = $"Quản lý {currentUser.full_name} đã phê duyệt yêu cầu hủy {shiftName} ngày {workDate} của bạn.",
                    rel = regId
                });
            approvedCount++;
        }
        else if (status == "pending_change")
        {
            int targetShiftId = (int)item.target_shift_id;
            string targetWorkDate = (string)item.target_work_date;
            string targetShiftName = (string)item.target_shift_name;

            conn.Execute(@"
                UPDATE shift_registrations
                SET shift_id = @tsid, work_date = @tdate, status = 'registered',
                    target_shift_id = NULL, target_work_date = NULL, request_reason = NULL
                WHERE id = @id",
                new { tsid = targetShiftId, tdate = targetWorkDate, id = regId });

            conn.Execute(@"
                INSERT INTO shift_history (user_id, shift_id, work_date, action, note)
                VALUES (@uid, @sid, @date, 'APPROVED_CHANGE', @note)",
                new {
                    uid = userId,
                    sid = targetShiftId,
                    date = targetWorkDate,
                    note = $"Quản lý ({currentUser.full_name}) đã DUYỆT đổi ca từ {shiftName} ({workDate}) sang {targetShiftName} ({targetWorkDate})."
                });

            conn.Execute(@"
                INSERT INTO notifications (target_user_id, sender_id, title, message, type, related_id)
                VALUES (@target, @sender, 'Yêu cầu đổi ca đã được duyệt', @msg, 'shift_approved', @rel)",
                new {
                    target = userId,
                    sender = currentUser.id,
                    msg = $"Quản lý {currentUser.full_name} đã duyệt yêu cầu đổi ca của bạn sang {targetShiftName} ngày {targetWorkDate}.",
                    rel = regId
                });
            approvedCount++;
        }
    }

    return Results.Ok(new {
        success = true,
        count = approvedCount,
        message = approvedCount > 0
            ? $"Đã phê duyệt thành công {approvedCount} yêu cầu!"
            : "Không có yêu cầu hợp lệ nào cần phê duyệt."
    });
});

// Endpoint tự động chuyển tất cả các yêu cầu quá hạn / quên duyệt sang TỪ CHỐI
app.MapPost("/api/shifts/reject-expired-requests", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();
    if (currentUser.role != "admin" && !currentUser.can_manage_schedule) return Results.StatusCode(403);

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

    var isScheduleManager = currentUser.role == "admin" || currentUser.can_manage_schedule;
    var targetUserId = (isScheduleManager && user_id.HasValue && user_id.Value > 0)
        ? user_id.Value
        : currentUser.id;

    if (!isScheduleManager && targetUserId == currentUser.id)
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
    if (currentUser == null || (currentUser.role != "admin" && !currentUser.can_manage_schedule)) return Results.StatusCode(403);

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
        // Xác định appUrl cho email (URL công khai hệ thống)
        var appUrl = req.app_url;
        if (string.IsNullOrWhiteSpace(appUrl) || appUrl.Contains("localhost:5173"))
        {
            var savedAppUrl = conn.QueryFirstOrDefault<string>("SELECT value FROM system_settings WHERE key = 'app_url' AND value != ''");
            if (!string.IsNullOrWhiteSpace(savedAppUrl))
            {
                appUrl = savedAppUrl;
            }
            else
            {
                try
                {
                    if (File.Exists("C:/Projects/tunnel_url.txt"))
                    {
                        var tUrl = File.ReadAllText("C:/Projects/tunnel_url.txt").Trim();
                        if (!string.IsNullOrWhiteSpace(tUrl) && tUrl.StartsWith("http")) appUrl = tUrl;
                    }
                }
                catch { }
            }
        }

        if (string.IsNullOrWhiteSpace(appUrl) || appUrl.Contains("localhost:5173"))
        {
            var origin = ctx.Request.Headers["Origin"].FirstOrDefault();
            var referer = ctx.Request.Headers["Referer"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(origin) && origin.StartsWith("http") && !origin.Contains("localhost:5173"))
            {
                appUrl = origin;
            }
            else if (!string.IsNullOrWhiteSpace(referer) && referer.StartsWith("http") && !referer.Contains("localhost:5173") && Uri.TryCreate(referer, UriKind.Absolute, out var rUri))
            {
                appUrl = rUri.GetLeftPart(UriPartial.Authority);
            }
            else
            {
                var proto = ctx.Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? ctx.Request.Scheme;
                var host = ctx.Request.Headers["X-Forwarded-Host"].FirstOrDefault() ?? ctx.Request.Host.Value;
                if (!string.IsNullOrWhiteSpace(host) && !host.Contains("localhost"))
                {
                    appUrl = $"{proto}://{host}";
                }
            }
        }

        if (string.IsNullOrWhiteSpace(appUrl))
        {
            appUrl = req.app_url ?? "http://localhost:5173";
        }

        foreach (var u in users)
        {
            var shifts = conn.Query(
                @"SELECT sr.work_date, st.name as shift_name, st.label as time_range, sr.status, sr.attendance_status
                  FROM shift_registrations sr
                  JOIN shift_templates st ON sr.shift_id = st.id
                  WHERE sr.user_id = @uid AND sr.work_date >= @ws AND sr.work_date <= @we
                  ORDER BY sr.work_date ASC, sr.shift_id ASC",
                new { uid = u.id, ws = req.week_start, we = weDate });

            var html = EmailService.GenerateScheduleEmailHtml(u.full_name, req.week_start, shifts, req.announcement ?? "", appUrl);
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
    if (currentUser == null) return Results.Unauthorized();
    var canManage = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || currentUser.can_manage_schedule || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));
    if (!canManage) return Results.StatusCode(403);

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

    var canManage = currentUser.role == "admin" || currentUser.role == "leader" || currentUser.role == "manager" || (currentUser.username != null && currentUser.username.ToLower().Contains("leader"));
    if (!canManage && currentUser.id != note.user_id)
        return Results.StatusCode(403);

    conn.Execute("DELETE FROM shift_notes WHERE id = @id", new { id });
    conn.Execute("DELETE FROM notifications WHERE type = 'shift_note_status' AND related_id = @id", new { id });

    return Results.Ok(new { message = "Đã xóa ghi chú ca làm thành công" });
});

app.MapDelete("/api/shift-notes/clear-all", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || (currentUser.role != "admin" && currentUser.role != "manager")) return Results.StatusCode(403);

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
    string? minDate = null;
    string? maxDate = null;

    foreach (var e in req.entries)
    {
        if (string.IsNullOrWhiteSpace(e.class_name) || string.IsNullOrWhiteSpace(e.work_date) ||
            string.IsNullOrWhiteSpace(e.start_time) || string.IsNullOrWhiteSpace(e.end_time))
        {
            continue;
        }

        var wdate = e.work_date.Trim();
        if (minDate == null || string.Compare(wdate, minDate, StringComparison.Ordinal) < 0) minDate = wdate;
        if (maxDate == null || string.Compare(wdate, maxDate, StringComparison.Ordinal) > 0) maxDate = wdate;

        conn.Execute(@"
            INSERT INTO class_schedules (user_id, course_code, class_name, work_date, start_time, end_time, room, source_batch_id)
            VALUES (@uid, @code, @name, @date, @stime, @etime, @room, @batchId)",
            new
            {
                uid = effectiveUserId,
                code = e.course_code?.Trim(),
                name = e.class_name.Trim(),
                date = wdate,
                stime = e.start_time.Trim(),
                etime = e.end_time.Trim(),
                room = e.room?.Trim(),
                batchId
            });
        count++;
    }

    // Đảm bảo các slot lịch trực trong khoảng thời gian này đã được tạo
    if (minDate != null && maxDate != null)
    {
        EnsureWeeklySchedule(conn, minDate, maxDate);
    }

    // Tự động đồng bộ trừ KPI cho tất cả các ca trực trùng lịch học
    int deductedCount = SyncClassScheduleKpiDeductions(conn, effectiveUserId, minDate, maxDate);

    if (deductedCount > 0)
    {
        conn.Execute(@"
            INSERT INTO notifications (target_user_id, sender_id, title, message, type)
            VALUES (@target, @sender, @title, @msg, 'class_schedule_conflict')",
            new
            {
                target = effectiveUserId,
                sender = currentUser.id,
                title = "Tự động trừ KPI do trùng Thời Khóa Biểu",
                msg = $"Hệ thống đã phát hiện và tự động chuyển {deductedCount} ca trực trùng lịch học sang trạng thái Vắng và trừ giờ KPI tương ứng."
            });
    }

    string msg = deductedCount > 0
        ? $"Đã nhập thành công {count} buổi học vào Thời Khóa Biểu và tự động trừ {deductedCount} ca trực trùng lịch học khỏi KPI!"
        : $"Đã nhập thành công {count} buổi học vào Thời Khóa Biểu!";

    return Results.Ok(new { message = msg, count, deducted_shifts = deductedCount, batch_id = batchId });
});

app.MapDelete("/api/class-schedules/{id:long}", (long id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    var item = conn.QueryFirstOrDefault<dynamic>("SELECT id, user_id, work_date FROM class_schedules WHERE id = @id", new { id });
    if (item == null) return Results.NotFound(new { detail = "Không tìm thấy buổi học này" });

    long itemUserId = (long)item.user_id;
    string itemWorkDate = (string)item.work_date;

    if (currentUser.role != "admin" && currentUser.id != itemUserId)
    {
        return Results.StatusCode(403);
    }

    conn.Execute("DELETE FROM class_schedules WHERE id = @id", new { id });
    SyncClassScheduleKpiDeductions(conn, itemUserId, itemWorkDate, itemWorkDate);
    return Results.Ok(new { message = "Đã xóa buổi học thành công và tự động cập nhật lại KPI!" });
});

app.MapDelete("/api/class-schedules/clear", (long? user_id, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    int deleted = 0;
    long? clearUserId = null;

    if (currentUser.role == "admin")
    {
        if (user_id.HasValue)
        {
            clearUserId = user_id.Value;
            deleted = conn.Execute("DELETE FROM class_schedules WHERE user_id = @uid", new { uid = user_id.Value });
        }
        else
        {
            deleted = conn.Execute("DELETE FROM class_schedules");
        }
    }
    else
    {
        clearUserId = currentUser.id;
        deleted = conn.Execute("DELETE FROM class_schedules WHERE user_id = @uid", new { uid = currentUser.id });
    }

    SyncClassScheduleKpiDeductions(conn, clearUserId);
    return Results.Ok(new { message = $"Đã xóa sạch {deleted} buổi học trong thời khóa biểu và cập nhật lại KPI thành công!", count = deleted });
});

app.MapPost("/api/class-schedules/sync-kpi", (HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null) return Results.Unauthorized();

    using var conn = Database.GetConnection();
    int count = SyncClassScheduleKpiDeductions(conn);
    return Results.Ok(new { message = $"Đã đồng bộ trừ KPI cho {count} ca làm việc trùng lịch học!", count });
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
    if (currentUser == null || (currentUser.role != "admin" && currentUser.role != "manager")) return Results.StatusCode(403);

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
    if (currentUser == null || (currentUser.role != "admin" && currentUser.role != "manager")) return Results.StatusCode(403);

    var (host, port, user, password, fromName) = EmailService.GetSmtpConfig();
    using var conn = Database.GetConnection();
    var appUrl = conn.QueryFirstOrDefault<string>("SELECT value FROM system_settings WHERE key = 'app_url'") ?? "";
    if (string.IsNullOrWhiteSpace(appUrl))
    {
        try
        {
            if (File.Exists("C:/Projects/tunnel_url.txt"))
            {
                var tUrl = File.ReadAllText("C:/Projects/tunnel_url.txt").Trim();
                if (!string.IsNullOrWhiteSpace(tUrl) && tUrl.StartsWith("http")) appUrl = tUrl;
            }
        }
        catch { }
    }

    return Results.Ok(new
    {
        host,
        port,
        user,
        from_name = fromName,
        has_password = !string.IsNullOrEmpty(password),
        app_url = appUrl
    });
});

app.MapPost("/api/settings/smtp", (SmtpSettingsRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || (currentUser.role != "admin" && currentUser.role != "manager")) return Results.StatusCode(403);

    using var conn = Database.GetConnection();
    conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_host', @v) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", new { v = req.host });
    conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_port', @v) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", new { v = req.port.ToString() });
    conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_user', @v) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", new { v = req.user });
    conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_from_name', @v) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", new { v = req.from_name ?? "" });
    if (!string.IsNullOrEmpty(req.password))
    {
        conn.Execute("INSERT INTO system_settings (key, value) VALUES ('smtp_password', @v) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", new { v = req.password.Trim() });
    }
    if (req.app_url != null)
    {
        conn.Execute("INSERT INTO system_settings (key, value) VALUES ('app_url', @v) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", new { v = req.app_url.Trim() });
    }

    return Results.Ok(new { message = "Đã lưu cấu hình SMTP và đường dẫn hệ thống thành công!" });
});

app.MapPost("/api/emails/test-send", (TestEmailRequest req, HttpContext ctx) =>
{
    var currentUser = AuthService.GetCurrentUser(ctx);
    if (currentUser == null || (currentUser.role != "admin" && currentUser.role != "manager")) return Results.StatusCode(403);

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

try
{
    using var initConn = Database.GetConnection();
    SyncClassScheduleKpiDeductions(initConn);
}
catch { }

app.Run();

