// API Service for WorkShiftPro TV Signage

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && (window.location.port === "5173" || window.location.port === "5174")
    ? `http://${window.location.hostname}:8000/api`
    : "/api");

// 9 Ca làm việc chuẩn
export const DEFAULT_SHIFTS = [
  { id: 1, name: "Ca 1 (Shift 1)", start_time: "08:00", end_time: "09:30", label: "08:00 - 09:30" },
  { id: 2, name: "Ca 2 (Shift 2)", start_time: "09:35", end_time: "11:05", label: "09:35 - 11:05" },
  { id: 3, name: "Ca 3 (Shift 3)", start_time: "11:10", end_time: "12:40", label: "11:10 - 12:40" },
  { id: 4, name: "Ca 4 (Shift 4)", start_time: "13:10", end_time: "14:40", label: "13:10 - 14:40" },
  { id: 5, name: "Ca 5 (Shift 5)", start_time: "14:45", end_time: "16:15", label: "14:45 - 16:15" },
  { id: 6, name: "Ca 6 (Shift 6)", start_time: "16:45", end_time: "18:15", label: "16:45 - 18:15" },
  { id: 7, name: "Ca 7 (Shift 7)", start_time: "18:20", end_time: "19:50", label: "18:20 - 19:50" },
  { id: 8, name: "Ca 8 (Shift 8)", start_time: "19:55", end_time: "20:25", label: "19:55 - 20:25" },
  { id: 9, name: "Ca 9 (Shift 9)", start_time: "20:30", end_time: "22:00", label: "20:30 - 22:00" },
];

// Dữ liệu dự phòng khi mất kết nối mạng
export const MOCK_FALLBACK = {
  shifts: DEFAULT_SHIFTS,
  registrations: [
    { id: 101, shift_id: 1, full_name: "Nguyễn Văn An", username: "an.nv", phone: "0981234567", attendance_status: "present" },
    { id: 102, shift_id: 1, full_name: "Trần Thị Bình", username: "binh.tt", phone: "0987654321", attendance_status: "present" },
    { id: 103, shift_id: 2, full_name: "Lê Văn Cường", username: "cuong.lv", phone: "0912345678", attendance_status: "present" },
    { id: 104, shift_id: 2, full_name: "Phạm Minh Đức", username: "duc.pm", phone: "0934567890", attendance_status: "absent", absence_reason: "Báo ốm sốt xuất huyết" },
    { id: 105, shift_id: 3, full_name: "Hoàng Thị Em", username: "em.ht", phone: "0978901234", attendance_status: "present" },
    { id: 106, shift_id: 3, full_name: "Vũ Quang Hải", username: "hai.vq", phone: "0965432109", attendance_status: "present" },
    { id: 107, shift_id: 4, full_name: "Đỗ Thùy Linh", username: "linh.dt", phone: "0943210987", attendance_status: "present" },
    { id: 108, shift_id: 4, full_name: "Ngô Quốc Nam", username: "nam.nq", phone: "0921098765", attendance_status: "present" },
    { id: 109, shift_id: 5, full_name: "Bùi Thị Oanh", username: "oanh.bt", phone: "0910987654", attendance_status: "present" },
    { id: 110, shift_id: 5, full_name: "Dương Tuấn Phúc", username: "phuc.dt", phone: "0909876543", attendance_status: "present" },
    { id: 111, shift_id: 6, full_name: "Mai Văn Quân", username: "quan.mv", phone: "0988776655", attendance_status: "present" },
    { id: 112, shift_id: 6, full_name: "Tạ Thị Sen", username: "sen.tt", phone: "0977665544", attendance_status: "present" },
    { id: 113, shift_id: 7, full_name: "Trịnh Văn Tuấn", username: "tuan.tv", phone: "0966554433", attendance_status: "present" },
    { id: 114, shift_id: 7, full_name: "Đinh Thu Uyên", username: "uyen.dt", phone: "0955443322", attendance_status: "present" },
    { id: 115, shift_id: 8, full_name: "Lý Gia Vũ", username: "vu.lg", phone: "0944332211", attendance_status: "present" },
    { id: 116, shift_id: 8, full_name: "Hà Thanh Xuân", username: "xuan.ht", phone: "0933221100", attendance_status: "present" },
    { id: 117, shift_id: 9, full_name: "Chu Đình Yến", username: "yen.cd", phone: "0922110099", attendance_status: "present" },
    { id: 118, shift_id: 9, full_name: "Phan Văn Long", username: "long.pv", phone: "0911009988", attendance_status: "present" },
  ],
  events: [
    {
      id: 1,
      shift_id: 2,
      shift_name: "Ca 2 (Shift 2)",
      shift_label: "09:35 - 11:05",
      title: "Kiểm tra hệ thống máy chủ & mạng",
      description: "Rà soát toàn diện phòng server, kiểm tra tải băng thông và đường truyền dự phòng.",
      event_type: "task",
    },
    {
      id: 2,
      shift_id: 3,
      shift_name: "Ca 3 (Shift 3)",
      shift_label: "11:10 - 12:40",
      title: "Giám sát lưu lượng cao điểm trưa",
      description: "Trực ban hỗ trợ sinh viên và người dùng trực tuyến, đảm bảo SLA phản hồi dưới 2 phút.",
      event_type: "general",
    },
    {
      id: 3,
      shift_id: 4,
      shift_name: "Ca 4 (Shift 4)",
      shift_label: "13:10 - 14:40",
      title: "Giao ban ca chiều & xử lý ticket tồn",
      description: "Họp nhanh 10 phút đầu ca chiều để bàn giao nhiệm vụ và rà soát ticket tồn đọng.",
      event_type: "meeting",
    },
    {
      id: 4,
      shift_id: 5,
      shift_name: "Ca 5 (Shift 5)",
      shift_label: "14:45 - 16:15",
      title: "Sao lưu cơ sở dữ liệu định kỳ",
      description: "Thực hiện snapshot database và đồng bộ lên cụm cloud dự phòng định kỳ tuần.",
      event_type: "task",
    },
    {
      id: 5,
      shift_id: 6,
      shift_name: "Ca 6 (Shift 6)",
      shift_label: "16:45 - 18:15",
      title: "Bảo trì nâng cấp hệ thống giám sát",
      description: "Khởi động lại cụm proxy và kiểm tra cảnh báo tự động trên hệ thống Zabbix.",
      event_type: "task",
    },
    {
      id: 6,
      shift_id: 0,
      shift_name: "Cả ngày",
      shift_label: "Toàn công ty",
      title: "Đoàn đánh giá chất lượng ATVS & An ninh",
      description: "Yêu cầu tất cả nhân sự mặc đồng phục đúng quy chuẩn, đeo thẻ nhân viên đầy đủ.",
      event_type: "general",
    }
  ]
};

export async function fetchTvSchedule(dateStr) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const url = `${API_BASE_URL}/tv/today${dateStr ? `?date=${dateStr}` : ""}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API trả về mã lỗi: ${response.status}`);
    }

    const data = await response.json();
    return {
      isLive: true,
      date: data.date || dateStr,
      server_time: data.server_time,
      shifts: data.shifts && data.shifts.length > 0 ? data.shifts : DEFAULT_SHIFTS,
      registrations: data.registrations || [],
      events: data.events || []
    };
  } catch (error) {
    console.warn("[TV Signage] Không thể kết nối API backend, kích hoạt dữ liệu demo dự phòng:", error.message);
    return {
      isLive: false,
      date: dateStr,
      server_time: new Date().toISOString(),
      shifts: MOCK_FALLBACK.shifts,
      registrations: MOCK_FALLBACK.registrations,
      events: MOCK_FALLBACK.events
    };
  }
}
