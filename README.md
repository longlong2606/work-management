# WorkShiftPro - Hệ Thống Quản Lý Ca Trực & Kiosk Smart TV (Dual-Screen)

**WorkShiftPro** là giải pháp phần mềm quản lý phân ca làm việc, điều phối nhân sự và trình chiếu thời gian thực trên màn hình Smart TV (Kiosk 50 inch). Hệ thống được thiết kế theo mô hình **Dual-Screen song song**: Một màn hình dành cho Quản lý / Nhân viên thao tác trên máy tính, và một màn hình Kiosk toàn màn hình trình chiếu lịch trực, đếm ngược ca và phân công tại phòng lab / nơi làm việc.

---

## 🌟 Kiến Trúc Hệ Thống (3 Thành Phần)

```
                    ┌───────────────────────────────┐
                    │    Backend API (.NET 10)      │
                    │      Port: 8000 (0.0.0.0)     │
                    │   SQLite + Dapper + MailKit   │
                    └───────────────┬───────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌─────────────────────────────┐           ┌─────────────────────────────────┐
│     Web Quản Lý Máy Tính    │           │    Web Kiosk Smart TV 50 Inch   │
│     (frontend / Port: 5173) │           │   (tv-display / Port: 5174)     │
│   • Phân ca tuần (T2 - T7)  │           │   • Giao diện Dark Kiosk 4K/FHD │
│   • Chọn nhiều ca sự kiện   │           │   • Đồng hồ & đếm ngược ca trực │
│   • Bảng KPI 20h/tuần       │           │   • Lịch trực 9 ca trong ngày   │
│   • Checklist nhiệm vụ ca   │           │   • Sự kiện & nhân sự trực ca   │
│   • CSV Phân ca & Báo vắng  │           │   • Xem qua LAN: IP:5174        │
└─────────────────────────────┘           └─────────────────────────────────┘
```

---

## 🚀 Các Tính Năng Nổi Bật

### 1. 🖥️ Web Quản Lý Máy Tính (`frontend`)
- **Bảng ma trận phân ca 9 ca trực (Thứ 2 đến Thứ 7):** Hiển thị trực quan, hỗ trợ xem chi tiết phân công, nhân sự trực và sự kiện từng ca.
- **Thêm sự kiện đa ca (Multi-Shift Event Selection):** Cho phép gắn sự kiện cho một ca, chọn nhiều ca cùng lúc (ví dụ: Ca 1, 2, 3 hoặc Ca 7, 8) hoặc áp dụng cho toàn bộ cả ngày. Có sẵn các nút chọn nhanh (Preset) tiện lợi.
- **Bảng theo dõi KPI 20h/tuần:** Tự động thống kê số giờ đăng ký trong tuần của từng nhân sự, xếp hạng huy chương Vàng/Bạc/Đồng, cảnh báo ai chưa đủ chỉ tiêu 20 giờ.
- **Nhiệm vụ theo ca (Shift Checklist):** Quản lý đầu việc cần bàn giao, checklist kiểm tra thiết bị / vệ sinh đầu ca và cuối ca.
- **Phân ca hàng loạt & Báo vắng qua CSV:** Hỗ trợ tải file mẫu CSV chuẩn, upload phân ca nhanh cho cả tuần mà không cần nhập thủ công.
- **Quy trình báo vắng & xét duyệt:** Nhân viên gửi lý do báo vắng; Quản lý xét duyệt hoặc từ chối có ghi chú. Khóa duyệt tự động các ca trong quá khứ.
- **Hệ thống Email tự động:** Thông báo lịch trực tuần, thông báo đổi ca / báo vắng qua hòm thư Outbox.

### 2. 📺 Màn Hình Kiosk Smart TV (`tv-display`)
- Thiết kế giao diện chuyên dụng tối ưu hiển thị trên màn hình lớn (50 - 65 inch) ở chế độ Full Screen (`F11`).
- Đồng hồ thời gian thực và đồng hồ đếm ngược trực quan đến ca trực tiếp theo.
- Tự động nhận diện ca đang diễn ra (highlight vàng rực rỡ) và danh sách nhân sự đang trực.
- Tự động lấy địa chỉ IP mạng Wi-Fi nội bộ để các thiết bị Smart TV có thể truy cập qua trình duyệt mà không cần cài đặt ứng dụng.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend:** C# ASP.NET Core Minimal APIs (.NET 10), Dapper ORM, SQLite, JWT Authentication, MailKit SMTP.
- **Frontend (Web Quản lý):** React 19, Vite, Vanilla CSS hiện đại, Lucide React Icons.
- **TV Display (Kiosk):** React 19, Vite, tối ưu hóa CSS cho màn hình Smart TV độ phân giải lớn.

---

### 🌟 Tính Năng Hợp Nhất Đường Dẫn (Unified TV & PC Dashboard)

Hệ thống hỗ trợ truy cập song song 2 giao diện trên cùng **1 địa chỉ / 1 cổng duy nhất** (`:5173` khi chạy dev, hoặc `:3000` khi chạy Docker):
- 📺 **Khi truy cập root (hoặc bỏ `/schedule`):** `http://localhost:5173/` (hoặc `http://<IP_LAN>:5173/`)
  - Tự động hiển thị **Màn hình Kiosk TV 50 Inch** chuẩn trình chiếu, không yêu cầu đăng nhập.
  - Có sẵn nút **"Vào Quản Lý"** trên thanh tiêu đề để nhân sự quản lý nhanh.
- 💻 **Khi truy cập `/schedule`:** `http://localhost:5173/schedule`
  - Hiển thị **Giao diện Web Quản lý máy tính** đầy đủ tính năng.
  - Thanh Navbar có sẵn nút **"Màn hình TV"** để chuyển tức thì sang giao diện TV toàn màn hình.

---

## ⚡ Hướng Dẫn Khởi Chạy Nhanh (1-Click)

### Cách 1: Chạy tự động toàn bộ bằng file Batch (Khuyên Dùng trên Windows)
Chỉ cần nhấp đúp vào file:
```bash
run_all.bat
```
Script sẽ tự động:
1. Lấy địa chỉ IP Wi-Fi/LAN của máy tính.
2. Giải phóng các cổng `8000`, `5173`, `5174` nếu đang bị chiếm.
3. Khởi chạy song song Backend API, Web Quản lý và Web TV Kiosk.
4. Mở sẵn 2 tab trình duyệt trên máy tính và in ra đường dẫn để gõ trên TV (`http://<IP_MAY_TINH>:5174`).

Khi muốn dừng toàn bộ server, nhấp đúp vào:
```bash
stop_all.bat
```

---

### Cách 3: Triển khai toàn diện bằng Docker Compose (Production / Đa nền tảng)

Hệ thống được cấu hình sẵn Docker Compose hoàn chỉnh gồm 4 dịch vụ:
1. **db**: PostgreSQL 16 Alpine
2. **backend**: ASP.NET Core (.NET 10) Minimal API
3. **frontend**: Web Quản lý React 19 (Nginx Reverse Proxy)
4. **tv-display**: Kiosk Smart TV React 19 (Nginx Reverse Proxy)

Khởi chạy 1 lệnh duy nhất:
```bash
docker compose up -d --build
```

Truy cập các dịch vụ:
- 🖥️ **Web Quản lý máy tính:** `http://localhost:3000`
- 📺 **Màn hình Kiosk Smart TV:** `http://localhost:3001` (hoặc `http://<IP_LAN>:3001`)
- ⚙️ **Backend API REST:** `http://localhost:8001/api`
- 🗄️ **PostgreSQL Database:** `localhost:5432`

Dừng hệ thống:
```bash
docker compose down
```

---

### Cách 2: Khởi chạy thủ công từng phần

#### 1. Khởi chạy Backend (.NET 10)
```bash
cd backend
dotnet run
```
> API lắng nghe tại: `http://localhost:8000` (hỗ trợ `0.0.0.0:8000` cho mạng nội bộ).

#### 2. Khởi chạy Web Quản Lý (Frontend)
```bash
cd frontend
npm install
npm run dev
```
> Giao diện quản lý tại: `http://localhost:5173`

#### 3. Khởi chạy Màn Hình Kiosk TV
```bash
cd tv-display
npm install
npm run dev
```
> Màn hình TV Kiosk tại: `http://localhost:5174` (hoặc `http://<IP_LAN>:5174`)

---

## 🔑 Tài Khoản Đăng Nhập Mặc Định

| Vai trò | Tên đăng nhập | Mật khẩu |
| :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin` | `Admin@123` |
| **Trưởng nhóm (Leader)** | `leader1` | `leader123` |
| **Nhân viên (Staff)** | `longlong` | `User@123` |

---

## 📁 Cấu Trúc Thư Mục

```
work-management/
├── backend/                  # Mã nguồn C# ASP.NET Core 10 Web API
│   ├── Controllers / Endpoints
│   ├── Database.cs           # Khởi tạo SQLite DB & Seed dữ liệu
│   └── Program.cs            # Cấu hình CORS, DI, Routing
├── frontend/                 # Ứng dụng Web Quản lý ca trực (React + Vite)
│   ├── src/
│   │   ├── components/       # Navbar, CsvModal, KpiLeaderboard, ShiftChecklist...
│   │   ├── pages/            # SchedulePage, AdminPage, LoginPage...
│   │   └── services/         # Axios API client
│   └── package.json
├── tv-display/               # Ứng dụng Kiosk Smart TV 50 inch (React + Vite)
│   ├── src/                  # App trình chiếu toàn màn hình, đếm ngược ca
│   └── package.json
├── data/                     # Thư mục chứa cơ sở dữ liệu SQLite
├── run_all.bat               # Script khởi động tự động toàn bộ hệ thống
├── run_dual_screen.bat       # Script khởi động song song 2 màn hình
├── stop_all.bat              # Script giải phóng cổng & dừng server an toàn
└── README.md                 # Tài liệu hướng dẫn sử dụng
```

---
*Phát triển bởi longlong2606*
