import React, { useState, useMemo } from "react";
import {
  X, Trophy, CheckCircle2, AlertTriangle, Clock, Calendar,
  ChevronDown, ChevronUp, Info
} from "lucide-react";
import { SHIFTS } from "../constants/shifts";

export function KpiLeaderboardModal({
  isOpen,
  onClose,
  allMembers = [],
  schedule = [],
  weekDays = [],
  kpiTarget = 20.0
}) {
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'missed' | 'met_actual' | 'met_plan'
  const [expandedMemberId, setExpandedMemberId] = useState(null);

  // Tính toán KPI & Phân tích ca thực tế vs Kế hoạch cho từng nhân sự
  const leaderboardData = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const nowTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return allMembers.map((member) => {
      // Toàn bộ các ca của nhân sự này trong tuần
      const memberShifts = schedule.filter((s) => s.user_id === member.id);

      let completedHours = 0;
      let completedCount = 0;
      let inProgressHours = 0;
      let inProgressCount = 0;
      let upcomingHours = 0;
      let upcomingCount = 0;
      let absentHours = 0;
      let absentCount = 0;
      let missedTodayCount = 0;

      // Phân tích chi tiết 6 ngày trong tuần (T2 -> T7)
      const dailyBreakdown = weekDays.map((day) => {
        const dayShifts = memberShifts.filter((s) => s.work_date === day.dateStr);

        let dayCompleted = 0;
        let dayAbsent = 0;
        let dayUpcoming = 0;
        let dayHours = 0;

        const analyzedShifts = dayShifts.map((s) => {
          const shiftMeta = SHIFTS.find((sh) => sh.id === s.shift_id) || {
            name: `Ca ${s.shift_id}`,
            startTime: s.start_time || "08:00",
            endTime: s.end_time || "09:30",
          };
          const duration = s.shift_id === 8 ? 0.5 : 1.5;
          const isAbsent = s.attendance_status === "absent";
          const isPending = s.attendance_status === "pending_absence";

          // Xác định thời điểm diễn ra của ca
          let timeState = "upcoming"; // "completed" | "in_progress" | "upcoming"
          if (s.work_date < todayStr) {
            timeState = "completed";
          } else if (s.work_date === todayStr) {
            if (nowTimeStr >= shiftMeta.endTime) {
              timeState = "completed";
            } else if (nowTimeStr >= shiftMeta.startTime && nowTimeStr < shiftMeta.endTime) {
              timeState = "in_progress";
            } else {
              timeState = "upcoming";
            }
          } else {
            timeState = "upcoming";
          }

          let finalStatus = "upcoming";
          if (isAbsent) {
            finalStatus = "absent";
            dayAbsent += 1;
          } else if (isPending) {
            finalStatus = "pending_absence";
          } else if (timeState === "completed") {
            finalStatus = "completed";
            dayCompleted += 1;
            dayHours += duration;
          } else if (timeState === "in_progress") {
            finalStatus = "in_progress";
            dayHours += duration;
          } else {
            finalStatus = "upcoming";
            dayUpcoming += 1;
            dayHours += duration;
          }

          return {
            ...s,
            shiftMeta,
            duration,
            timeState,
            finalStatus,
          };
        });

        const displayDate = day.displayDate || (day.dateStr ? day.dateStr.slice(5).replace("-", "/") : "");
        const dayName = day.dayName || "";

        return {
          dateStr: day.dateStr,
          dayName: dayName,
          displayDate: displayDate,
          isToday: Boolean(day.isToday),
          shifts: analyzedShifts,
          totalShifts: dayShifts.length,
          completedCount: dayCompleted,
          absentCount: dayAbsent,
          upcomingCount: dayUpcoming,
          plannedHours: dayShifts.reduce((acc, curr) => acc + (curr.shift_id === 8 ? 0.5 : 1.5), 0),
          actualHours: dayHours,
          hasMissed: dayAbsent > 0,
        };
      });

      // Tổng hợp toàn tuần từ dailyBreakdown
      dailyBreakdown.forEach((d) => {
        d.shifts.forEach((sh) => {
          if (sh.finalStatus === "absent") {
            absentHours += sh.duration;
            absentCount += 1;
            if (d.isToday) missedTodayCount += 1;
          } else if (sh.finalStatus === "completed") {
            completedHours += sh.duration;
            completedCount += 1;
          } else if (sh.finalStatus === "in_progress") {
            inProgressHours += sh.duration;
            inProgressCount += 1;
          } else {
            upcomingHours += sh.duration;
            upcomingCount += 1;
          }
        });
      });

      const totalScheduledHours = completedHours + inProgressHours + upcomingHours;
      const actualPercent = Math.min(100, Math.round((completedHours / kpiTarget) * 100));
      const scheduledPercent = Math.min(100, Math.round((totalScheduledHours / kpiTarget) * 100));
      const isMetActual = completedHours >= kpiTarget;
      const isMetScheduled = totalScheduledHours >= kpiTarget;

      return {
        member,
        totalShifts: memberShifts.length,
        completedHours,
        completedCount,
        inProgressHours,
        inProgressCount,
        upcomingHours,
        upcomingCount,
        absentHours,
        absentCount,
        missedTodayCount,
        totalScheduledHours,
        actualPercent,
        scheduledPercent,
        isMetActual,
        isMetScheduled,
        dailyBreakdown,
      };
    }).sort((a, b) => {
      // Ưu tiên xếp hạng theo giờ thực tế đã làm xong, sau đó đến tổng lịch
      if (b.completedHours !== a.completedHours) {
        return b.completedHours - a.completedHours;
      }
      return b.totalScheduledHours - a.totalScheduledHours;
    });
  }, [allMembers, schedule, weekDays, kpiTarget]);

  if (!isOpen) return null;

  // Lọc dữ liệu theo tab
  const filteredData = leaderboardData.filter((item) => {
    if (activeTab === "missed") {
      return item.absentCount > 0;
    }
    if (activeTab === "met_actual") {
      return item.isMetActual;
    }
    if (activeTab === "met_plan") {
      return item.isMetScheduled;
    }
    return true;
  });

  const totalActualHoursAll = leaderboardData.reduce((acc, curr) => acc + curr.completedHours, 0);
  const totalScheduledHoursAll = leaderboardData.reduce((acc, curr) => acc + curr.totalScheduledHours, 0);
  const totalMissedShiftsAll = leaderboardData.reduce((acc, curr) => acc + curr.absentCount, 0);
  const membersWithMissed = leaderboardData.filter((d) => d.absentCount > 0).length;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 880,
          maxHeight: "92vh",
          backgroundColor: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= HEADER ================= */}
        <div
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #1e3a8a, #2563eb)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trophy size={26} color="#fbbf24" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>
                  Bảng Theo Dõi Tiến Độ KPI 20h / Tuần
                </h3>
                <span
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Xác Thực Ca Thực Tế
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#dbeafe", marginTop: 3 }}>
                Phân biệt rõ: <strong>Giờ Đã Làm Xong Thực Tế</strong> vs{" "}
                <strong>Kế Hoạch Cả Tuần</strong> • Nhận diện ca thiếu trong ngày
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "none",
              color: "#ffffff",
              width: 34,
              height: 34,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.2s",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ================= 4 CARDS OVERVIEW ================= */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            padding: "16px 24px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>
              🎯 CHỈ TIÊU / NHÂN SỰ
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#1e293b", marginTop: 2 }}>
              {kpiTarget}h <span style={{ fontSize: 11, fontWeight: 500 }}>/ tuần</span>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1.5px solid #86efac",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: "#15803d", fontWeight: 700 }}>
              ✅ ĐÃ LÀM THỰC TẾ
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#16a34a", marginTop: 2 }}>
              {totalActualHoursAll.toFixed(1)}h
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #bfdbfe",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>
              📅 TỔNG KẾ HOẠCH LỊCH
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#2563eb", marginTop: 2 }}>
              {totalScheduledHoursAll.toFixed(1)}h
            </div>
          </div>

          <div
            style={{
              background: totalMissedShiftsAll > 0 ? "#fef2f2" : "#ffffff",
              padding: "12px 14px",
              borderRadius: 12,
              border: totalMissedShiftsAll > 0 ? "1.5px solid #fca5a5" : "1px solid #e2e8f0",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, color: totalMissedShiftsAll > 0 ? "#b91c1c" : "#64748b", fontWeight: 700 }}>
              ⚠️ CA VẮNG / THIẾU
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: totalMissedShiftsAll > 0 ? "#dc2626" : "#64748b", marginTop: 2 }}>
              {totalMissedShiftsAll} ca{" "}
              <span style={{ fontSize: 10, fontWeight: 600 }}>({membersWithMissed} người)</span>
            </div>
          </div>
        </div>

        {/* ================= TABS LỌC NHANH ================= */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 24px",
            background: "#ffffff",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setActiveTab("all")}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: activeTab === "all" ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                background: activeTab === "all" ? "#eff6ff" : "#ffffff",
                color: activeTab === "all" ? "#1d4ed8" : "#475569",
              }}
            >
              Tất cả ({leaderboardData.length})
            </button>

            <button
              onClick={() => setActiveTab("missed")}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: activeTab === "missed" ? "1.5px solid #ef4444" : "1px solid #e2e8f0",
                background: activeTab === "missed" ? "#fef2f2" : "#ffffff",
                color: activeTab === "missed" ? "#b91c1c" : "#475569",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <AlertTriangle size={13} color="#ef4444" />
              Có ca thiếu / vắng ({membersWithMissed})
            </button>

            <button
              onClick={() => setActiveTab("met_actual")}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: activeTab === "met_actual" ? "1.5px solid #16a34a" : "1px solid #e2e8f0",
                background: activeTab === "met_actual" ? "#f0fdf4" : "#ffffff",
                color: activeTab === "met_actual" ? "#15803d" : "#475569",
              }}
            >
              Đã đủ 20h thực tế ({leaderboardData.filter((d) => d.isMetActual).length})
            </button>

            <button
              onClick={() => setActiveTab("met_plan")}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: activeTab === "met_plan" ? "1.5px solid #7c3aed" : "1px solid #e2e8f0",
                background: activeTab === "met_plan" ? "#f5f3ff" : "#ffffff",
                color: activeTab === "met_plan" ? "#6d28d9" : "#475569",
              }}
            >
              Đủ lịch kế hoạch ({leaderboardData.filter((d) => d.isMetScheduled).length})
            </button>
          </div>

          <div style={{ fontSize: 11, color: "#64748b" }}>
            💡 Nhấp vào từng nhân sự để xem chi tiết 6 ngày trong tuần
          </div>
        </div>

        {/* ================= DANH SÁCH NHÂN SỰ ================= */}
        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filteredData.map((item, index) => {
              const {
                member,
                completedHours,
                completedCount,
                upcomingCount,
                absentHours,
                absentCount,
                totalScheduledHours,
                actualPercent,
                scheduledPercent,
                isMetActual,
                isMetScheduled,
                dailyBreakdown,
              } = item;

              const isExpanded = expandedMemberId === member.id;
              const isTop1 = index === 0 && completedHours > 0;
              const isTop2 = index === 1 && completedHours > 0;
              const isTop3 = index === 2 && completedHours > 0;

              return (
                <div
                  key={member.id}
                  style={{
                    borderRadius: 14,
                    border: absentCount > 0 ? "1.5px solid #fca5a5" : isMetActual ? "1.5px solid #86efac" : "1px solid #e2e8f0",
                    background: absentCount > 0 ? "#fffbfb" : isMetActual ? "#f0fdf4" : "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    overflow: "hidden",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* MAIN ROW */}
                  <div
                    onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                    style={{
                      padding: "12px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      gap: 16,
                      userSelect: "none",
                    }}
                  >
                    {/* Rank + Avatar + Name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 230 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: isTop1 ? "#fef08a" : isTop2 ? "#e2e8f0" : isTop3 ? "#fed7aa" : "#f1f5f9",
                          color: isTop1 ? "#854d0e" : isTop2 ? "#475569" : isTop3 ? "#9a3412" : "#64748b",
                          fontWeight: 900,
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {isTop1 ? "🥇" : isTop2 ? "🥈" : isTop3 ? "🥉" : `#${index + 1}`}
                      </div>

                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: member.role === "admin" ? "#ede9fe" : "#dbeafe",
                          color: member.role === "admin" ? "#6d28d9" : "#1d4ed8",
                          fontWeight: 800,
                          fontSize: 13,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {(member.full_name || member.username || "U")[0].toUpperCase()}
                      </div>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                          {member.full_name || member.username}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                          <span>@{member.username}</span>
                          <span>•</span>
                          <span style={{ color: "#16a34a", fontWeight: 600 }}>{completedCount} ca đã làm</span>
                          <span>•</span>
                          <span>{upcomingCount} ca chờ</span>
                          {absentCount > 0 && (
                            <>
                              <span>•</span>
                              <span style={{ color: "#dc2626", fontWeight: 700 }}>
                                ⚠️ Thiếu {absentCount} ca ({absentHours.toFixed(1)}h)
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* DUAL PROGRESS BAR: ACTUAL (GREEN) vs SCHEDULED (BLUE) */}
                    <div style={{ flex: 1, maxWidth: 260 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                        <span>
                          <strong style={{ color: "#16a34a" }}>{completedHours.toFixed(1)}h thực tế</strong>{" "}
                          <span style={{ color: "#94a3b8" }}>/ {totalScheduledHours.toFixed(1)}h lịch</span>
                        </span>
                        <span style={{ color: isMetActual ? "#16a34a" : "#2563eb" }}>
                          {actualPercent}%
                        </span>
                      </div>

                      {/* Bar container */}
                      <div
                        style={{
                          width: "100%",
                          height: 10,
                          background: "#e2e8f0",
                          borderRadius: 6,
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        {/* Layer 1: Scheduled hours (lighter blue bar behind) */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            height: "100%",
                            width: `${scheduledPercent}%`,
                            background: "#93c5fd",
                            borderRadius: 6,
                          }}
                        />
                        {/* Layer 2: Actually completed hours (vibrant green bar in front) */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            height: "100%",
                            width: `${actualPercent}%`,
                            background: "linear-gradient(90deg, #10b981, #059669)",
                            borderRadius: 6,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginTop: 3 }}>
                        <span>Xanh đậm = Đã làm</span>
                        <span>Mục tiêu: {kpiTarget}h</span>
                      </div>
                    </div>

                    {/* STATUS BADGES & EXPAND TOGGLE */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 150, justifyContent: "flex-end" }}>
                      {isMetActual ? (
                        <span
                          style={{
                            background: "#dcfce7",
                            color: "#15803d",
                            padding: "3px 8px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <CheckCircle2 size={12} /> Đủ 20h
                        </span>
                      ) : isMetScheduled ? (
                        <span
                          style={{
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            padding: "3px 8px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <Clock size={12} /> Đủ lịch chờ làm
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#fef3c7",
                            color: "#b45309",
                            padding: "3px 8px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Thiếu {(kpiTarget - totalScheduledHours).toFixed(1)}h lịch
                        </span>
                      )}

                      {/* Expand Chevron */}
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: "#64748b",
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* ================= EXPANDED: CHI TIẾT 6 NGÀY (T2 -> T7) ================= */}
                  {isExpanded && (
                    <div
                      style={{
                        padding: "12px 18px",
                        background: "#f8fafc",
                        borderTop: "1px solid #e2e8f0",
                        animation: "fadeIn 0.2s ease-out",
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                        <Calendar size={14} color="#2563eb" />
                        Chi tiết lịch trực 6 ngày trong tuần của {member.full_name}:
                      </div>

                      {/* 6 Days Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(6, 1fr)",
                          gap: 8,
                        }}
                      >
                        {dailyBreakdown.map((day) => (
                          <div
                            key={day.dateStr}
                            style={{
                              background: day.isToday ? "#eff6ff" : "#ffffff",
                              borderRadius: 8,
                              border: day.hasMissed
                                ? "1.5px solid #f87171"
                                : day.isToday
                                ? "1.5px solid #60a5fa"
                                : "1px solid #cbd5e1",
                              padding: "8px 10px",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: day.isToday ? "#1d4ed8" : "#1e293b" }}>
                                {day.dayName ? day.dayName.replace("Thứ ", "T") : "T"}
                              </span>
                              <span style={{ fontSize: 10, color: "#64748b" }}>
                                {day.displayDate || day.dateStr || ""}
                              </span>
                            </div>

                            {/* Shifts in this day */}
                            {day.shifts.length === 0 ? (
                              <div style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic", textAlign: "center", padding: "8px 0" }}>
                                Nghỉ (0 ca)
                              </div>
                            ) : (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {day.shifts.map((sh, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      padding: "4px 6px",
                                      borderRadius: 4,
                                      fontSize: 10,
                                      fontWeight: 600,
                                      background:
                                        sh.finalStatus === "completed"
                                          ? "#dcfce7"
                                          : sh.finalStatus === "absent"
                                          ? "#fee2e2"
                                          : sh.finalStatus === "in_progress"
                                          ? "#fef3c7"
                                          : "#f1f5f9",
                                      color:
                                        sh.finalStatus === "completed"
                                          ? "#15803d"
                                          : sh.finalStatus === "absent"
                                          ? "#b91c1c"
                                          : sh.finalStatus === "in_progress"
                                          ? "#b45309"
                                          : "#334155",
                                      borderLeft:
                                        sh.finalStatus === "completed"
                                          ? "3px solid #16a34a"
                                          : sh.finalStatus === "absent"
                                          ? "3px solid #dc2626"
                                          : "3px solid #94a3b8",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span>Ca {sh.shift_id}</span>
                                      <span>{sh.duration}h</span>
                                    </div>
                                    <div style={{ fontSize: 9, opacity: 0.9 }}>
                                      {sh.finalStatus === "completed" && "✅ Đã trực"}
                                      {sh.finalStatus === "absent" && "❌ VẮNG MẶT"}
                                      {sh.finalStatus === "in_progress" && "⚡ Đang trực"}
                                      {sh.finalStatus === "upcoming" && "⏳ Chờ trực"}
                                      {sh.finalStatus === "pending_absence" && "🟡 Chờ duyệt"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Day Summary */}
                            <div style={{ marginTop: "auto", paddingTop: 4, borderTop: "1px solid #f1f5f9", fontSize: 9 }}>
                              {day.hasMissed ? (
                                <span style={{ color: "#dc2626", fontWeight: 800 }}>
                                  ⚠️ Thiếu {day.absentCount} ca!
                                </span>
                              ) : day.completedCount > 0 ? (
                                <span style={{ color: "#16a34a", fontWeight: 700 }}>
                                  Xong {day.actualHours}h
                                </span>
                              ) : day.shifts.length > 0 ? (
                                <span style={{ color: "#2563eb", fontWeight: 600 }}>
                                  Lịch {day.plannedHours}h
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= FOOTER ================= */}
        <div
          style={{
            padding: "14px 24px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
            <Info size={14} color="#2563eb" />
            <span>
              <strong>Thanh Xanh Đậm:</strong> Giờ ca trực thực tế đã kết thúc và có mặt •{" "}
              <strong>Thanh Xanh Nhạt:</strong> Tổng giờ kế hoạch toàn tuần •{" "}
              <strong>Ca Vắng (Đỏ):</strong> Bị trừ trực tiếp khỏi KPI.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 22px",
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
