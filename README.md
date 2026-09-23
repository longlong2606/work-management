# WorkShiftPro - Hệ Thống Quản Lý Ca Trực & Điều Hành Công Việc

Hệ thống quản lý, phân ca trực, theo dõi chấm công và xét duyệt đổi ca / báo vắng chuyên nghiệp.

## Công Nghệ Sử Dụng

- **Backend:** C# ASP.NET Core (.NET 10), SQLite (Dapper ORM), JWT Authentication, SMTP MailKit
- **Frontend:** React 18, Vite, Vanilla CSS, Lucide React Icons

## Các Tính Năng Chính

- **Ma trận lịch tuần 9 ca chuẩn:** Quản lý ca trực linh hoạt, mở rộng xem chi tiết từng ca.
- **Quản lý danh sách 13 nhân sự:** Hiển thị gọn gàng, xem trạng thái có mặt / vắng mặt.
- **Quy trình báo vắng & xét duyệt:** Nhân viên báo vắng kèm lý do bắt buộc; Quản lý xét duyệt hoặc từ chối.
- **Khóa duyệt ca quá hạn:** Tự động phát hiện và khóa duyệt các ca đã qua ngày, hỗ trợ chuyển sang từ chối nhanh.
- **Sự kiện linh hoạt (Ngày / Ca):** Tạo sự kiện kéo dài cả ngày hoặc theo từng ca làm việc cụ thể.
- **Sổ ghi chú báo bận đột xuất:** Chỉ cho phép chọn ngày hiện tại hoặc tương lai.
- **Hệ thống Email tự động:** Thông báo lịch tuần đến toàn bộ 13 nhân sự, hỗ trợ Hòm thư đi (Outbox).

## Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Khởi chạy Backend (.NET 10)
`ash
cd backend
dotnet run
`
Backend sẽ khởi chạy tại: http://localhost:8000

### 2. Khởi chạy Frontend (React + Vite)
`ash
cd frontend
npm install
npm run dev
`
Frontend sẽ khởi chạy tại: http://localhost:5173
