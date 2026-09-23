from pydantic import BaseModel, EmailStr
from typing import Optional, List

class LoginRequest(BaseModel):
    username: str
    password: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    full_name: str
    email: str
    phone: Optional[str] = ""
    role: str = "staff"
    department: Optional[str] = "Bộ phận Vận hành"

class ShiftRegistrationRequest(BaseModel):
    shift_id: int
    work_date: str
    note: Optional[str] = ""

class PublishScheduleRequest(BaseModel):
    week_start: str
    send_email: bool = True
    announcement: Optional[str] = "Quản lý đã xuất bản lịch làm việc cho tuần mới. Các bạn nhân viên vui lòng kiểm tra ca trực của mình và chuẩn bị đúng giờ."

class CreateShiftNoteRequest(BaseModel):
    shift_id: int
    work_date: str
    original_time: str
    adjusted_time: str
    reason: str
    note_type: Optional[str] = "adjusted_hours"

class UpdateShiftNoteStatusRequest(BaseModel):
    status: str  # 'approved', 'rejected', 'acknowledged'
    admin_response: Optional[str] = ""

class CreateFeedbackRequest(BaseModel):
    title: str
    content: str
    category: str
    is_anonymous: bool = False

class ReplyFeedbackRequest(BaseModel):
    admin_reply: str
    status: Optional[str] = "resolved"

class CreateNotificationRequest(BaseModel):
    target_user_id: Optional[int] = 0
    title: str
    message: str
    type: Optional[str] = "general"

class SmtpSettingsRequest(BaseModel):
    host: str = "smtp.gmail.com"
    port: int = 587
    user: str
    password: Optional[str] = ""
    from_name: Optional[str] = "Hệ Thống Phân Ca WorkShiftPro"

class TestEmailRequest(BaseModel):
    recipient_email: str
