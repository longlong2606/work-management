import React, { useState, useEffect, useRef } from "react";
import { fetchTvSchedule } from "./services/api";
import { RosterDetailModal } from "./components/RosterDetailModal";
import {
  Clock, Calendar, Users, Bell, Maximize2, Minimize2, RefreshCw,
  ChevronLeft, ChevronRight, Zap, BarChart2, Radio, CheckCircle2,
  AlertCircle, ShieldCheck, ArrowUpRight, Flame
} from "lucide-react";

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDateKey, setCurrentDateKey] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduleData, setScheduleData] = useState({
    isLive: false,
    shifts: [],
    registrations: [],
    events: []
  });
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [eventPageIndex, setEventPageIndex] = useState(0);
  const [selectedShiftForModal, setSelectedShiftForModal] = useState(null);
  const [isIdle, setIsIdle] = useState(false);

  const idleTimerRef = useRef(null);
  const EVENTS_PER_PAGE = 4; //  sự kiện mỗi trang bên cột trái TV

  // 1. Tải dữ liệu từ backend hoặc mock
  const loadData = async (dateStr) => {
    try {
      const data = await fetchTvSchedule(dateStr);
      setScheduleData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Chạy đồng hồ thời gian thực & Tự động sang ngày mới lúc 00:00
  useEffect(() => {
    loadData(currentDateKey);

    const clockTimer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const todayStr = now.toISOString().slice(0, 10);
      // Khi bước qua nửa đêm (00:00:00)
      if (todayStr !== currentDateKey) {
        console.log(`[TV Display] 🌙 Đã qua 00:00, chuyển sang ngày mới: ${todayStr}`);
        setCurrentDateKey(todayStr);
        setEventPageIndex(0);
        loadData(todayStr);
      }
    }, 1000);

    // Tự động Polling làm mới dữ liệu ngầm mỗi 5 giây (Realtime sync)
    const pollTimer = setInterval(() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      loadData(todayStr);
    }, 5000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(pollTimer);
    };
  }, [currentDateKey]);

  // 3. Gom nhóm các sự kiện trùng nhau (khi người dùng chọn áp dụng cho 1, 2 hoặc nhiều ca cùng lúc)
  const groupedEvents = React.useMemo(() => {
    if (!scheduleData.events || scheduleData.events.length === 0) return [];

    const map = new Map();

    scheduleData.events.forEach((ev) => {
      const titleKey = (ev.title || "").trim();
      const descKey = (ev.description || "").trim();
      const typeKey = ev.event_type || "general";
      const dateKey = ev.work_date || "";
      const key = `${titleKey}___${descKey}___${typeKey}___${dateKey}`;

      if (!map.has(key)) {
        map.set(key, {
          ...ev,
          all_shift_ids: [ev.shift_id],
          items: [ev]
        });
      } else {
        const item = map.get(key);
        if (!item.all_shift_ids.includes(ev.shift_id)) {
          item.all_shift_ids.push(ev.shift_id);
          item.items.push(ev);
        }
      }
    });

    return Array.from(map.values()).map((item) => {
      // Nếu có shift_id = 0 -> Áp dụng cả ngày
      if (item.all_shift_ids.includes(0)) {
        return {
          ...item,
          display_shift_label: item.shift_name
            ? `${item.shift_name} (${item.shift_label || "08:00 - 22:00"})`
            : "Cả ngày (All Day) (08:00 - 22:00)"
        };
      }

      const validShiftIds = item.all_shift_ids.filter((id) => id > 0).sort((a, b) => a - b);

      if (validShiftIds.length <= 1) {
        return {
          ...item,
          display_shift_label: item.shift_name
            ? `${item.shift_name} (${item.shift_label || ""})`
            : "Áp dụng cả ngày"
        };
      }

      // Khi chọn từ 2 ca trở lên (ví dụ: Ca 1, Ca 2 hoặc Ca 1, Ca 2, Ca 3)
      const shiftObjs = validShiftIds.map(
        (id) => scheduleData.shifts.find((s) => s.id === id) || { id, name: `Ca ${id}` }
      );
      const isConsecutive = validShiftIds.every((id, idx) => idx === 0 || id === validShiftIds[idx - 1] + 1);
      const namesStr = validShiftIds.map((id) => `Ca ${id}`).join(", ");

      const timesKnown = shiftObjs.filter((s) => s.start_time && s.end_time);
      let timeRangeStr = "";
      if (isConsecutive && timesKnown.length === validShiftIds.length && validShiftIds.length > 0) {
        timeRangeStr = ` (${timesKnown[0].start_time} - ${timesKnown[timesKnown.length - 1].end_time})`;
      } else if (!isConsecutive) {
        const labels = shiftObjs.map((s) => (s.start_time ? `${s.start_time}-${s.end_time}` : "")).filter(Boolean);
        if (labels.length > 0 && labels.length <= 2) {
          timeRangeStr = ` (${labels.join(", ")})`;
        }
      }

      return {
        ...item,
        display_shift_label: `${namesStr}${timeRangeStr}`
      };
    });
  }, [scheduleData.events, scheduleData.shifts]);

  const totalEvents = groupedEvents.length;
  const totalEventPages = Math.max(1, Math.ceil(totalEvents / EVENTS_PER_PAGE));

  useEffect(() => {
    if (totalEventPages <= 1) return;

    const slideTimer = setInterval(() => {
      setEventPageIndex((prev) => (prev + 1) % totalEventPages);
    }, 10000); // 10 giây lướt 1 lần

    return () => clearInterval(slideTimer);
  }, [totalEventPages]);

  // 4. Tự động ẩn con trỏ chuột khi không cử động trên màn hình TV (sau 3.5s)
  useEffect(() => {
    const onMouseMove = () => {
      setIsIdle(false);
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsIdle(true);
      }, 3500);
    };

    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      clearTimeout(idleTimerRef.current);
    };
  }, []);

  // 5. Bật/Tắt Toàn Màn Hình
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => { });
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => { });
    }
  };

  // Xác định ca đang trực tiếp theo giờ đồng hồ
  const nowTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  const getShiftStatus = (shift) => {
    const [sH, sM] = (shift.start_time || "00:00").split(":").map(Number);
    const [eH, eM] = (shift.end_time || "00:00").split(":").map(Number);
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;

    if (nowTotalMinutes >= startMin && nowTotalMinutes < endMin) {
      return "current"; // Đang trực
    } else if (nowTotalMinutes >= endMin) {
      return "past"; // Đã qua
    }
    return "upcoming"; // Chưa đến
  };

  const activeShift = scheduleData.shifts.find((s) => getShiftStatus(s) === "current");

  // Sự kiện đang hiển thị ở trang hiện tại (đã gộp các ca trùng)
  const visibleEvents = groupedEvents.slice(
    eventPageIndex * EVENTS_PER_PAGE,
    (eventPageIndex + 1) * EVENTS_PER_PAGE
  );

  // Định dạng ngày giờ tiếng Việt
  const timeFormatted = currentTime.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const dayOfWeekNames = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayOfWeek = dayOfWeekNames[currentTime.getDay()];
  const dateFormatted = `${String(currentTime.getDate()).padStart(2, "0")}/${String(currentTime.getMonth() + 1).padStart(2, "0")}/${currentTime.getFullYear()}`;

  // Đếm tổng số thành viên phân công hôm nay
  const uniqueMembers = new Set(scheduleData.registrations.map((r) => r.user_id || r.full_name));
  const totalAssignedStaff = uniqueMembers.size;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        padding: "12px 20px",
        overflow: "hidden",
        cursor: isIdle ? "none" : "default",
        boxSizing: "border-box"
      }}
    >
      {/* ========================================================
          1. HEADER CHUẨN FORM WORKSHIFTPRO + ĐỒNG HỒ DIGITAL TV
          ======================================================== */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          padding: "10px 20px",
          marginBottom: 12,
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)"
        }}
      >
        {/* LOGO & TITLE */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)"
            }}
          >
            <Clock size={26} color="#ffffff" />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", letterSpacing: "-0.5px" }}>
                WorkShift<span style={{ color: "#2563eb" }}>Pro</span>
              </span>
              <span
                style={{
                  background: "#eff6ff",
                  border: "1.5px solid #bfdbfe",
                  color: "#1d4ed8",
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Lịch Làm Việc (9 Ca)
              </span>
              <span
                style={{
                  background: "#f5f3ff",
                  border: "1.5px solid #ddd6fe",
                  color: "#6d28d9",
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                📺 Màn Hình TV 50"
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Hệ thống Quản lý 9 Ca & Kiosk Trình Chiếu Trực Quan Toàn Công Ty
            </div>
          </div>
        </div>

        {/* TRẠNG THÁI CA TRỰC HIỆN TẠI (ĐANG DIỄN RA) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: activeShift ? "#fef2f2" : "#f1f5f9",
            border: activeShift ? "1.5px solid #fecaca" : "1.5px solid #e2e8f0",
            padding: "8px 18px",
            borderRadius: 30
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: activeShift ? "#ef4444" : "#94a3b8",
              boxShadow: activeShift ? "0 0 10px #ef4444" : "none"
            }}
            className={activeShift ? "pulse-badge" : ""}
          />
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: activeShift ? "#dc2626" : "#64748b", textTransform: "uppercase" }}>
              {activeShift ? "🔥 CA ĐANG TRỰC" : "NGHỈ GIỮA CA"}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              {activeShift ? `${activeShift.name} (${activeShift.start_time} - ${activeShift.end_time})` : "Chờ đến ca trực tiếp theo"}
            </div>
          </div>
        </div>

        {/* ĐỒNG HỒ DIGITAL TV & NÚT ĐIỀU KHIỂN */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                fontFamily: "var(--font-mono)",
                color: "#1e40af",
                letterSpacing: "1px",
                lineHeight: 1
              }}
            >
              {timeFormatted}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginTop: 4 }}>
              {dayOfWeek}, {dateFormatted}
            </div>
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => loadData(currentDateKey)}
              title="Đồng bộ dữ liệu"
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                color: "#2563eb",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5
              }}
            >
              <RefreshCw size={14} />
              Đồng bộ
            </button>

            <button
              onClick={toggleFullscreen}
              title="Chế độ Toàn màn hình (F11)"
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#334155",
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? "Thu nhỏ" : "Toàn TV"}
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          2. BANNER TIÊU ĐỀ & 4 THẺ KPI CHUẨN THEO ẢNH GỐC
          ======================================================== */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: 0 }}>
                Quản Lý & Phân Bổ Ca Làm Việc (9 Ca)
              </h2>
              <span
                style={{
                  background: "#eff6ff",
                  color: "#2563eb",
                  border: "1px solid #bfdbfe",
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                Đội Ngũ {totalAssignedStaff || 2} Thành Viên
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Ô ca hiển thị gọn thành viên (Nhấn vào xem ai có mặt, ai vắng mặt kèm lý do). Tự động cập nhật qua ngày mới lúc 00:00.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 12px",
                borderRadius: 20,
                background: scheduleData.isLive ? "#ecfdf5" : "#fef3c7",
                border: scheduleData.isLive ? "1px solid #a7f3d0" : "1px solid #fde68a",
                color: scheduleData.isLive ? "#059669" : "#b45309",
                fontSize: 12,
                fontWeight: 700
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: scheduleData.isLive ? "#10b981" : "#f59e0b"
                }}
              />
              {scheduleData.isLive ? "API Backend Trực Tiếp (Port 8000)" : "Dữ Liệu Demo Dự Phòng"}
            </span>
          </div>
        </div>

        {/* 4 THẺ KPI CHUẨN FORM THEO ẢNH */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12
          }}
        >
          {/* Card 1: Quy chuẩn đội ngũ */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderLeft: "4px solid #3b82f6",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)"
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Quy chuẩn đội ngũ</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 2 }}>
              {totalAssignedStaff || 2} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>thành viên</span>
            </div>
          </div>

          {/* Card 2: Ca trực hôm nay */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderLeft: "4px solid #10b981",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)"
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Ca trực đang diễn ra</div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#059669", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeShift ? `${activeShift.name}` : "Nghỉ giữa ca"}
            </div>
          </div>

          {/* Card 3: Sự kiện các ca trực */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderLeft: "4px solid #8b5cf6",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)"
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Sự kiện các ca trực</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#7c3aed", marginTop: 2 }}>
              {totalEvents} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>sự kiện</span>
            </div>
          </div>

          {/* Card 4: Cơ chế điểm danh */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderLeft: "4px solid #f59e0b",
              borderRadius: 12,
              padding: "10px 14px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)"
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Cơ chế Điểm danh & Báo vắng</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#d97706", marginTop: 4 }}>
              Bấm 2 người để xem • Tự động lướt trang
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. NỘI DUNG CHÍNH: CHIA 2 BÊN (SỰ KIỆN vs LỊCH 9 CA)
          ======================================================== */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "36% 64%",
          gap: 16,
          overflow: "hidden"
        }}
      >
        {/* ====================================================
            CỘT BÊN TRÁI: BẢNG SỰ KIỆN (TỰ ĐỘNG LƯỚT QUA)
            ==================================================== */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)"
          }}
        >
          {/* Header Bảng Sự Kiện */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #f1f5f9",
              paddingBottom: 10,
              marginBottom: 10
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  color: "#d97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Bell size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  SỰ KIỆN & CÔNG VIỆC TRỌNG TÂM
                </h3>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  Tổng cộng {totalEvents} sự kiện • Tự động trượt trang sau 10s
                </div>
              </div>
            </div>

            {/* Phân trang tự động lướt */}
            {totalEventPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    background: "#eff6ff",
                    color: "#2563eb",
                    border: "1px solid #bfdbfe",
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 800
                  }}
                >
                  Trang {eventPageIndex + 1}/{totalEventPages}
                </span>

                <div style={{ display: "flex", gap: 2 }}>
                  <button
                    onClick={() => setEventPageIndex((p) => (p - 1 + totalEventPages) % totalEventPages)}
                    style={{
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      borderRadius: 6,
                      padding: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    <ChevronLeft size={14} color="#64748b" />
                  </button>
                  <button
                    onClick={() => setEventPageIndex((p) => (p + 1) % totalEventPages)}
                    style={{
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      borderRadius: 6,
                      padding: 3,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    <ChevronRight size={14} color="#64748b" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Thanh Tiến Trình Lướt Trang (Countdown Progress Bar) */}
          {totalEventPages > 1 && (
            <div
              style={{
                width: "100%",
                height: 3,
                backgroundColor: "#f1f5f9",
                borderRadius: 2,
                marginBottom: 10,
                overflow: "hidden"
              }}
            >
              <div
                key={eventPageIndex}
                style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                  animation: "slideTimer 10s linear infinite"
                }}
              />
            </div>
          )}

          {/* Danh Sách Các Sự Kiện Đang Lướt (Chuẩn form badge theo ảnh) */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              overflow: "hidden"
            }}
          >
            {totalEvents === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                  gap: 8
                }}
              >
                <CheckCircle2 size={36} color="#cbd5e1" />
                <div style={{ fontSize: 14, fontWeight: 700 }}>Không có sự kiện đặc biệt hôm nay</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Các ca làm việc tiến hành bình thường</div>
              </div>
            ) : (
              visibleEvents.map((ev, index) => {
                const isTask = ev.event_type === "task";
                const isMeeting = ev.event_type === "meeting";

                // Màu sắc thẻ chuẩn theo ảnh gốc
                const themeColor = isTask ? "#059669" : isMeeting ? "#7c3aed" : "#d97706";
                const bgTag = isTask ? "#ecfdf5" : isMeeting ? "#f5f3ff" : "#fffbeb";
                const borderTag = isTask ? "#a7f3d0" : isMeeting ? "#ddd6fe" : "#fde68a";

                return (
                  <div
                    key={ev.id || index}
                    style={{
                      background: "#ffffff",
                      border: `1px solid ${borderTag}`,
                      borderLeft: `4px solid ${themeColor}`,
                      borderRadius: 12,
                      padding: "10px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      animation: "fadeInCard 0.3s ease-out",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          background: bgTag,
                          color: themeColor,
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        {isTask ? <Zap size={11} /> : <BarChart2 size={11} />}
                        {isTask ? "NHIỆM VỤ CA" : isMeeting ? "GIAO BAN" : "SỰ KIỆN"}
                      </span>

                      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                        {ev.display_shift_label || (ev.shift_name ? `${ev.shift_name} (${ev.shift_label || ""})` : "Áp dụng cả ngày")}
                      </span>
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.3 }}>
                      {ev.title}
                    </div>

                    {ev.description && (
                      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.4 }}>
                        {ev.description}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ====================================================
            CỘT BÊN PHẢI: LỊCH HIỆN TẠI (9 CA) & THÀNH VIÊN THAM GIA
            (Giữ đúng form thẻ ô ca: 👥 2 người, Báo vắng, Xem)
            ==================================================== */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.02)"
          }}
        >
          {/* Header Bảng Ca Trực */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #f1f5f9",
              paddingBottom: 10,
              marginBottom: 10
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Calendar size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  LỊCH LÀM VIỆC HÔM NAY (9 CA) • {dayOfWeek}, {dateFormatted}
                </h3>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  Tự động chuyển lịch sang ngày mới lúc 00:00:00 • Bấm thẻ để xem chi tiết
                </div>
              </div>
            </div>

            {/* Chú giải trạng thái */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#dc2626", fontWeight: 800 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                Đang trực
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#059669", fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                Có mặt
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#e11d48", fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f43f5e" }} />
                Báo vắng
              </span>
            </div>
          </div>

          {/* LƯỚI 9 CA LÀM VIỆC (3 CỘT X 3 HÀNG) - CHUẨN FORM NHƯ ẢNH GỐC */}
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              gap: 10,
              overflow: "hidden"
            }}
          >
            {scheduleData.shifts.map((shift) => {
              const status = getShiftStatus(shift);
              const isCurrent = status === "current";
              const isPast = status === "past";

              // Danh sách thành viên trong ca hôm nay
              const shiftMembers = scheduleData.registrations.filter(
                (r) => r.shift_id === shift.id || r.shiftId === shift.id
              );

              // Danh sách sự kiện riêng của ca này
              const shiftEvents = scheduleData.events.filter((e) => e.shift_id === shift.id);

              return (
                <div
                  key={shift.id}
                  onClick={() => setSelectedShiftForModal(shift)}
                  className="card-transition"
                  style={{
                    background: isCurrent ? "#f0f7ff" : isPast ? "#f8fafc" : "#ffffff",
                    border: isCurrent
                      ? "2px solid #2563eb"
                      : isPast
                        ? "1px solid #e2e8f0"
                        : "1px solid #cbd5e1",
                    borderRadius: 12,
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: isCurrent ? "0 0 16px rgba(37, 99, 235, 0.2)" : "0 1px 3px rgba(0,0,0,0.02)",
                    position: "relative",
                    cursor: "pointer",
                    opacity: isPast ? 0.75 : 1
                  }}
                >
                  {/* Badge LIVE NOW nếu ca đang diễn ra */}
                  {isCurrent && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        background: "#ef4444",
                        color: "#ffffff",
                        fontSize: 9,
                        fontWeight: 900,
                        padding: "2px 8px",
                        borderBottomLeftRadius: 8,
                        letterSpacing: 0.5,
                        display: "flex",
                        alignItems: "center",
                        gap: 3
                      }}
                    >
                      <Flame size={10} /> ĐANG TRỰC
                    </div>
                  )}

                  {/* 1. TIÊU ĐỀ CA & GIỜ TRỰC */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 13,
                          color: isCurrent ? "#1d4ed8" : "#0f172a"
                        }}
                      >
                        {shift.name}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isCurrent ? "#2563eb" : "#64748b"
                        }}
                      >
                        {shift.start_time || shift.startTime} - {shift.end_time || shift.endTime}
                      </span>
                    </div>

                    {/* 2. DÒNG THAO TÁC THEO FORM ẢNH: [👥 2 người] [Báo vắng] [Xem ↗] */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 4,
                        paddingBottom: 4,
                        borderBottom: "1px solid #f1f5f9"
                      }}
                    >
                      {/* Badge số lượng người */}
                      <span
                        style={{
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          color: "#1d4ed8",
                          padding: "1px 6px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3
                        }}
                      >
                        <Users size={11} /> {shiftMembers.length} người
                      </span>

                      {/* Nút Báo vắng */}
                      <span
                        style={{
                          background: "#fff1f2",
                          border: "1px solid #fecdd3",
                          color: "#e11d48",
                          padding: "1px 6px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700
                        }}
                      >
                        Báo vắng
                      </span>

                      {/* Nút Xem chi tiết */}
                      <span
                        style={{
                          color: "#2563eb",
                          fontSize: 11,
                          fontWeight: 700,
                          marginLeft: "auto",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 2
                        }}
                      >
                        Xem <ArrowUpRight size={12} />
                      </span>
                    </div>
                  </div>

                  {/* 3. DÒNG SỰ KIỆN: 📅 SỰ KIỆN (X) */}
                  <div style={{ marginTop: 2 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", gap: 3 }}>
                      📅 SỰ KIỆN ({shiftEvents.length})
                    </div>
                    {shiftEvents.length > 0 ? (
                      <div
                        style={{
                          background: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                          borderRadius: 4,
                          padding: "1px 6px",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "#059669",
                          marginTop: 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        ⚡ {shiftEvents[0].title}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic", marginTop: 2 }}>
                        Không có sự kiện
                      </div>
                    )}
                  </div>

                  {/* 4. DANH SÁCH THÀNH VIÊN THAM GIA CA HÔM NAY */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {shiftMembers.length === 0 ? (
                        <span style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
                          Chưa phân công
                        </span>
                      ) : (
                        shiftMembers.map((m, idx) => {
                          const isAbsent = m.attendance_status === "absent";
                          return (
                            <span
                              key={m.id || idx}
                              style={{
                                background: isAbsent ? "#fef2f2" : "#f0fdf4",
                                border: isAbsent ? "1px solid #fecaca" : "1px solid #bbf7d0",
                                color: isAbsent ? "#dc2626" : "#15803d",
                                padding: "1px 6px",
                                borderRadius: 5,
                                fontSize: 11,
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3
                              }}
                            >
                              {m.full_name || m.username}
                              {isAbsent && <span style={{ fontSize: 9 }}>(Vắng)</span>}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================
          MODAL XEM CHI TIẾT THÀNH VIÊN & SỰ KIỆN KHI BẤM Ô CA
          ======================================================== */}
      {selectedShiftForModal && (
        <RosterDetailModal
          shift={selectedShiftForModal}
          dateStr={dateFormatted}
          members={scheduleData.registrations.filter((r) => r.shift_id === selectedShiftForModal.id)}
          events={scheduleData.events.filter((e) => e.shift_id === selectedShiftForModal.id)}
          onClose={() => setSelectedShiftForModal(null)}
        />
      )}
    </div>
  );
}
