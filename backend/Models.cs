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
    string? note_type = "adjusted_hours"
);

public record UpdateShiftNoteStatusRequest(string status, string? admin_response);

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


public record ReportAbsenceRequest(int shift_id, string work_date, string reason, long? user_id = null);
public record CancelAbsenceRequest(int shift_id, string work_date, long? user_id = null);

public record ApproveAbsenceRequest(int shift_id, string work_date, long user_id, bool approved, string? note = null);
public record ChangePasswordRequest(string old_password, string new_password);
public record ResetPasswordRequest(string new_password);
public record UpdateUserRequest(string full_name, string email, string? phone, string? department, string role, string status);
public record UpdateProfileRequest(string full_name, string email, string? phone);
public record ForgotPasswordRequest(string identifier);
