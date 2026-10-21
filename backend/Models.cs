namespace WorkManagement.Api;

public class UserEntity
{
    public long id { get; set; }
    public string username { get; set; } = "";
    public string password_hash { get; set; } = "";
    public string full_name { get; set; } = "";
    public string email { get; set; } = "";
    public string? phone { get; set; } = "";
    public string role { get; set; } = "staff";
    public string? department { get; set; } = "Bộ phận Vận hành";
    public string status { get; set; } = "active";
}

public record LoginRequest(string username, string password);

public record CreateUserRequest(
    string username,
    string password,
    string full_name,
    string email,
    string? phone,
    string role = "staff",
    string? department = "Bộ phận Vận hành"
);

public record ShiftRegistrationRequest(int shift_id, string work_date, string? note, long? user_id = null);

public record RequestShiftCancelModel(long? registration_id, int? shift_id, string? work_date, string reason);

public record RequestShiftChangeModel(
    long? registration_id,
    int? current_shift_id,
    string? current_work_date,
    int target_shift_id,
    string target_work_date,
    string reason
);

public record ApproveShiftActionModel(long registration_id, string action, string? admin_response);

public record PublishScheduleRequest(
    string week_start,
    bool send_email = true,
    string? announcement = "Quản lý đã xuất bản lịch làm việc cho tuần mới. Các bạn nhân viên vui lòng kiểm tra ca trực của mình và chuẩn bị đúng giờ.",
    string? app_url = null
);

public record CreateShiftNoteRequest(
    int shift_id,
    string work_date,
    string original_time,
    string adjusted_time,
    string reason,
    string? note_type = "adjusted_hours",
    double? actual_hours = null
);

public record UpdateShiftNoteStatusRequest(string status, string? admin_response, double? actual_hours = null, bool sync_to_schedule = true);

public record CreateFeedbackRequest(
    string title,
    string content,
    string category,
    bool is_anonymous = false
);

public record ReplyFeedbackRequest(string admin_reply, string? status = "resolved");

public record SmtpSettingsRequest(
    string host,
    int port,
    string user,
    string? password,
    string? from_name,
    string? app_url = null
);

public record TestEmailRequest(string recipient_email);


public class ShiftEventEntity
{
    public long id { get; set; }
    public int? shift_id { get; set; }
    public string? work_date { get; set; }
    public string title { get; set; } = "";
    public string? description { get; set; }
    public string event_type { get; set; } = "general";
    public string created_at { get; set; } = "";
}

public record CreateShiftEventRequest(
    int? shift_id,
    string title,
    string? description,
    string? work_date = null,
    string? event_type = "general",
    List<int>? shift_ids = null
);

public record UpdateAttendanceRequest(string attendance_status);
public record UpdateActualHoursRequest(long user_id, int shift_id, string work_date, double? actual_hours, string? time_note);
public record ToggleAttendanceRequest(long user_id, int shift_id, string work_date, string attendance_status);


public record BulkReportAbsenceRequest(
    string reason, 
    long? user_id = null, 
    string? start_date = null, 
    string? end_date = null, 
    List<string>? dates = null, 
    List<int>? shift_ids = null
);
public record ReportAbsenceRequest(int shift_id, string work_date, string reason, long? user_id = null);
public record CancelAbsenceRequest(int shift_id, string work_date, long? user_id = null);

public record ApproveAbsenceRequest(int shift_id, string work_date, long user_id, bool approved, string? note = null);
public record BulkApproveShiftRequests(List<long>? registration_ids = null);
public record ChangePasswordRequest(string old_password, string new_password);
public record ResetPasswordRequest(string new_password);
public record UpdateUserRequest(string full_name, string email, string? phone, string? department, string role, string status);
public record UpdateProfileRequest(string full_name, string email, string? phone);
public record ForgotPasswordRequest(string identifier);

public record ClassScheduleItem(
    long? id,
    long user_id,
    string? course_code,
    string class_name,
    string work_date,
    string start_time,
    string end_time,
    string? room,
    string? source_batch_id = null,
    string? user_name = null
);

public record ImportClassScheduleRequest(
    long? target_user_id,
    List<ClassScheduleItem> entries
);

public record SubtaskAssigneeDto(
    long user_id,
    string full_name,
    string username,
    string? role,
    int contribution_pct = 0,
    double cp_earned = 0
);

public record SubtaskDetailDto(
    long id,
    long task_id,
    string title,
    string? description,
    int position,
    string status, // PENDING, PROCESSING, REVIEW, FINISHED, FAILED, REJECTED
    string? due_at,
    string? review_comment,
    string? reject_reason,
    string? submitted_for_review_at,
    string? finished_at,
    long created_by,
    string? creator_name,
    string? created_at,
    string? updated_at,
    List<SubtaskAssigneeDto>? assignees,
    int cp_points = 0,
    double quality_multiplier = 1.0
);

public record TaskDetailDto(
    long id,
    string title,
    string? description,
    string task_type, // RESEARCH, INDUSTRY, LAB_MAINTENANCE, EVENT, OTHER
    string planned_date,
    string deadline,
    string? location,
    string? customer_info,
    long leader_id,
    string? leader_name,
    long created_by,
    string? creator_name,
    int total_cp,
    int allocated_cp,
    string status, // OPEN, IN_PROGRESS, FINISHED, POSTPONED
    string? postponed_reason,
    string? finished_at,
    string? created_at,
    string? updated_at,
    int subtasks_count,
    int finished_subtasks_count,
    int review_subtasks_count,
    int my_subtasks_count,
    List<SubtaskDetailDto>? subtasks
);

public record CreateTaskRequest(
    string title,
    string? description,
    string? task_type,
    string planned_date,
    string deadline,
    string? location,
    string? customer_info,
    long leader_id,
    int total_cp = 0
);

public record UpdateTaskRequest(
    string title,
    string? description = null,
    string? task_type = null,
    string? planned_date = null,
    string? deadline = null,
    string? location = null,
    string? customer_info = null,
    long leader_id = 0,
    int total_cp = 0
);

public record PostponeTaskRequest(
    string reason
);

public record ResumeTaskRequest(
    string? planned_date = null,
    string? deadline = null
);

public record AssigneeContribution(long user_id, int contribution_pct);

public record CreateSubtaskRequest(
    string title,
    string? description,
    string? due_at,
    List<long>? assignee_ids,
    int cp_points = 0,
    List<AssigneeContribution>? assignee_contributions = null
);

public record UpdateSubtaskRequest(
    string title,
    string? description,
    string? due_at,
    List<long>? assignee_ids,
    int cp_points = 0,
    List<AssigneeContribution>? assignee_contributions = null
);

public record RejectSubtaskRequest(
    string? reason = null
);

public record ReviewSubtaskRequest(
    bool approve,
    string? comment,
    double quality_multiplier = 1.0,
    bool is_penalty = false,
    int penalty_points = 0
);

// ===== CP SYSTEM DTOs =====
public class CpUserSummary
{
    public long user_id { get; set; }
    public string username { get; set; } = "";
    public string full_name { get; set; } = "";
    public string role { get; set; } = "";
    public string? role_display_name { get; set; }
    public string? department { get; set; }
    public double total_cp { get; set; }
    public int subtasks_finished { get; set; }
    public string tier { get; set; } = "Thành viên";
    public double next_tier_cp { get; set; } = 50;
    public double progress_pct { get; set; } = 0;
}

public class CpTransactionDto
{
    public long id { get; set; }
    public long user_id { get; set; }
    public string? user_name { get; set; }
    public long subtask_id { get; set; }
    public string? subtask_title { get; set; }
    public double cp_earned { get; set; }
    public int contribution_pct { get; set; }
    public double quality_multiplier { get; set; }
    public string? created_at { get; set; }
}

public class RoleEntity
{
    public string id { get; set; } = "";
    public string display_name { get; set; } = "";
    public string? description { get; set; }
    public string? color { get; set; } = "#3b82f6";
    public bool is_system { get; set; } = false;
    public bool can_manage_schedule { get; set; } = false;
    public bool can_manage_tasks { get; set; } = false;
    public bool can_manage_staff { get; set; } = false;
    public bool can_evaluate { get; set; } = false;
    public bool can_manage_cp { get; set; } = false;
    public int user_count { get; set; } = 0;
    public string? created_at { get; set; }
}

public record CreateRoleRequest(
    string id,
    string display_name,
    string? description,
    string? color = "#3b82f6",
    bool can_manage_schedule = false,
    bool can_manage_tasks = false,
    bool can_manage_staff = false,
    bool can_evaluate = false,
    bool can_manage_cp = false
);

public record UpdateRoleRequest(
    string display_name,
    string? description,
    string? color,
    bool can_manage_schedule = false,
    bool can_manage_tasks = false,
    bool can_manage_staff = false,
    bool can_evaluate = false,
    bool can_manage_cp = false
);

public class DepartmentEntity
{
    public long id { get; set; }
    public string name { get; set; } = "";
    public string? code { get; set; }
    public string? description { get; set; }
    public string? manager_name { get; set; }
    public string? color { get; set; } = "#3b82f6";
    public int member_count { get; set; } = 0;
    public string? created_at { get; set; }
}

public record CreateDepartmentRequest(
    string name,
    string? code,
    string? description,
    string? manager_name,
    string? color = "#3b82f6"
);

public record UpdateDepartmentRequest(
    string name,
    string? code,
    string? description,
    string? manager_name,
    string? color = "#3b82f6"
);


public class CompetencyEvaluationDto
{
    public long id { get; set; }
    public string username { get; set; } = "";
    public string full_name { get; set; } = "";
    public string role { get; set; } = "";
    public string? department { get; set; } = "";
    public string status { get; set; } = "active";
    public string scores_json { get; set; } = "{}";
    public string? desired_direction { get; set; }
    public string? commitment_level { get; set; }
    public string? evidence_notes { get; set; }
    public string? updated_at { get; set; }
}

public record UpdateCompetencyRequest(
    string? scores_json,
    string? desired_direction,
    string? commitment_level,
    string? evidence_notes
);
