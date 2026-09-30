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
    string? announcement = "Quản lý đã xuất bản lịch làm việc cho tuần mới. Các bạn nhân viên vui lòng kiểm tra ca trực của mình và chuẩn bị đúng giờ."
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
    string? from_name
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
    string? event_type = "general"
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
    string? role
);

public record SubtaskDetailDto(
    long id,
    long task_id,
    string title,
    string? description,
    int position,
    string status, // PROCESSING, REVIEW, FINISHED
    string? due_at,
    string? review_comment,
    string? submitted_for_review_at,
    string? finished_at,
    long created_by,
    string? creator_name,
    string? created_at,
    string? updated_at,
    List<SubtaskAssigneeDto>? assignees
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
    long leader_id
);

public record UpdateTaskRequest(
    string title,
    string? description,
    string? task_type,
    string planned_date,
    string deadline,
    string? location,
    string? customer_info,
    long leader_id
);

public record PostponeTaskRequest(
    string reason
);

public record CreateSubtaskRequest(
    string title,
    string? description,
    string? due_at,
    List<long>? assignee_ids
);

public record UpdateSubtaskRequest(
    string title,
    string? description,
    string? due_at,
    List<long>? assignee_ids
);

public record ReviewSubtaskRequest(
    bool approve,
    string? comment
);
