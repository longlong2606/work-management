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
  // Tính toán KPI: Mọi ca được phân công mặc định CÓ MẶT, chỉ khi BÁO VẮNG mới trừ ra
  const leaderboardData = useMemo(() => {
    return allMembers.map((member) => {
      // Toàn bộ các ca của nhân sự này trong tuần
      const memberShifts = schedule.filter((s) => s.user_id === member.id);

      let totalAssignedHours = 0;
      let absentHours = 0;
      let absentCount = 0;
      let attendedCount = 0;

      // Phân tích chi tiết 6 ngày trong tuần (T2 -> T7)
      const dailyBreakdown = weekDays.map((day) => {
        const dayShifts = memberShifts.filter((s) => s.work_date === day.dateStr);

        let dayAbsent = 0;
        let dayAttended = 0;
        let dayAssignedHours = 0;
        let dayDeductedHours = 0;

        const analyzedShifts = dayShifts.map((s) => {
          const shiftMeta = SHIFTS.find((sh) => sh.id === s.shift_id) || {
            name: `Ca ${s.shift_id}`,
            startTime: s.start_time || "08:00",
            endTime: s.end_time || "09:30",
          };
          const standardDuration = s.shift_id === 8 ? 0.5 : 1.5;
          const actualHours = (s.actual_hours !== null && s.actual_hours !== undefined) ? Number(s.actual_hours) : null;
          const duration = actualHours !== null ? actualHours : standardDuration;
          const isAbsent = s.attendance_status === "absent";
          const isPending = s.attendance_status === "pending_absence";

          dayAssignedHours += duration;

          let finalStatus = "present";
          if (isAbsent) {
            finalStatus = "absent";
            dayAbsent += 1;
            dayDeductedHours += duration;
          } else if (isPending) {
            finalStatus = "pending_absence";
            dayAbsent += 1;
            dayDeductedHours += duration;
          } else {
            finalStatus = "present";
            dayAttended += 1;
          }

          return {
            ...s,
            shiftMeta,
            standardDuration,
            actualHours,
            duration,
            isAbsent,
            isPending,
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
          attendedCount: dayAttended,
          absentCount: dayAbsent,
          plannedHours: dayAssignedHours,
          actualHours: Math.max(0, dayAssignedHours - dayDeductedHours),
          hasMissed: dayAbsent > 0,
        };
      });

      // Tổng hợp toàn tuần từ memberShifts
      memberShifts.forEach((s) => {
        const standardDuration = s.shift_id === 8 ? 0.5 : 1.5;
        const dur = (s.actual_hours !== null && s.actual_hours !== undefined) ? Number(s.actual_hours) : standardDuration;
        totalAssignedHours += dur;
        if (s.attendance_status === "absent" || s.attendance_status === "pending_absence") {
          absentHours += dur;
          absentCount += 1;
        } else {
          attendedCount += 1;
        }
      });

      const validKpiHours = Math.max(0, totalAssignedHours - absentHours);
      const kpiPercent = Math.min(100, Math.round((validKpiHours / kpiTarget) * 100));
      const isMet = validKpiHours >= kpiTarget;

      return {
        member,
        totalShifts: memberShifts.length,
        totalAssignedHours,
        absentHours,
        absentCount,
        attendedCount,
        validKpiHours,
        kpiPercent,
        isMet,
        dailyBreakdown,
      };
    }).sort((a, b) => {
      // Ưu tiên xếp hạng theo giờ KPI hợp lệ (đã trừ vắng), sau đó đến tổng ca
      if (b.validKpiHours !== a.validKpiHours) {
        return b.validKpiHours - a.validKpiHours;
      }
      return b.totalAssignedHours - a.totalAssignedHours;
    });
  }, [allMembers, schedule, weekDays, kpiTarget]);

  if (!isOpen) return null;

  // Lọc dữ liệu theo tab
  const filteredData = leaderboardData.filter((item) => {
    if (activeTab === "missed") {
      return item.absentCount > 0;
    }
    if (activeTab === "met") {
      return item.isMet;
    }
    if (activeTab === "under") {
      return !item.isMet;
    }
    return true;
  });

  const totalValidKpiHoursAll = leaderboardData.reduce((acc, curr) => acc + curr.validKpiHours, 0);
  const totalAssignedHoursAll = leaderboardData.reduce((acc, curr) => acc + curr.totalAssignedHours, 0);
  const totalAbsentHoursAll = leaderboardData.reduce((acc, curr) => acc + curr.absentHours, 0);
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
                  Chuẩn 20 Giờ / Tuần
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#dbeafe", marginTop: 3 }}>
                Mặc định có mặt trong mọi ca trực được xếp • Chỉ trừ giờ KPI khi nhân sự có ca <strong>Báo Vắng</strong>
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
              🎯 ĐỊNH MỨC / NHÂN SỰ
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
              ✅ GIỜ KPI HỢP LỆ
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#16a34a", marginTop: 2 }}>
              {totalValidKpiHoursAll.toFixed(1)}h
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
              📅 TỔNG LỊCH ĐÃ XẾP
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#2563eb", marginTop: 2 }}>
              {totalAssignedHoursAll.toFixed(1)}h
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
              ⚠️ BỊ TRỪ DO VẮNG
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: totalMissedShiftsAll > 0 ? "#dc2626" : "#64748b", marginTop: 2 }}>
              {totalAbsentHoursAll.toFixed(1)}h{" "}
              <span style={{ fontSize: 10, fontWeight: 600 }}>({totalMissedShiftsAll} ca / {membersWithMissed} người)</span>
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
              onClick={() => setActiveTab("met")}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: activeTab === "met" ? "1.5px solid #16a34a" : "1px solid #e2e8f0",
                background: activeTab === "met" ? "#f0fdf4" : "#ffffff",
                color: activeTab === "met" ? "#15803d" : "#475569",
              }}
            >
              Đạt chuẩn 20h ({leaderboardData.filter((d) => d.isMet).length})
            </button>

            <button
              onClick={() => setActiveTab("under")}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: activeTab === "under" ? "1.5px solid #f59e0b" : "1px solid #e2e8f0",
                background: activeTab === "under" ? "#fef3c7" : "#ffffff",
                color: activeTab === "under" ? "#b45309" : "#475569",
              }}
            >
              Chưa đủ 20h ({leaderboardData.filter((d) => !d.isMet).length})
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
              Bị trừ do vắng ({membersWithMissed})
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
                totalShifts,
                totalAssignedHours,
                absentHours,
                absentCount,
                attendedCount,
                validKpiHours,
                kpiPercent,
                isMet,
                dailyBreakdown,
              } = item;

              const isExpanded = expandedMemberId === member.id;
              const isTop1 = index === 0 && validKpiHours > 0;
              const isTop2 = index === 1 && validKpiHours > 0;
              const isTop3 = index === 2 && validKpiHours > 0;

              return (
                <div
                  key={member.id}
                  style={{
                    borderRadius: 14,
                    border: absentCount > 0 ? "1.5px solid #fca5a5" : isMet ? "1.5px solid #86efac" : "1px solid #e2e8f0",
                    background: absentCount > 0 ? "#fffbfb" : isMet ? "#f0fdf4" : "#ffffff",
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
                          <span style={{ color: "#16a34a", fontWeight: 600 }}>{attendedCount} ca có mặt</span>
                          <span>•</span>
                          <span>Lịch: {totalAssignedHours.toFixed(1)}h</span>
                          {absentCount > 0 && (
                            <>
                              <span>•</span>
                              <span style={{ color: "#dc2626", fontWeight: 700 }}>
                                ⚠️ Trừ {absentCount} ca ({absentHours.toFixed(1)}h)
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* PROGRESS BAR: VALID KPI HOURS */}
                    <div style={{ flex: 1, maxWidth: 260 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                        <span>
                          <strong style={{ color: isMet ? "#16a34a" : (absentCount > 0 ? "#dc2626" : "#2563eb") }}>
                            {validKpiHours.toFixed(1)}h KPI
                          </strong>{" "}
                          <span style={{ color: "#94a3b8" }}>/ {kpiTarget}h chuẩn</span>
                        </span>
                        <span style={{ color: isMet ? "#16a34a" : (absentCount > 0 ? "#dc2626" : "#2563eb") }}>
                          {kpiPercent}%
                        </span>
                      </div>

                      {/* Bar container */}
                      <div
                        style={{
                          width: "100%",
                          height: 8,
                          background: "#e2e8f0",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${kpiPercent}%`,
                            background: isMet
                              ? "linear-gradient(90deg, #10b981, #059669)"
                              : absentCount > 0
                              ? "linear-gradient(90deg, #ef4444, #dc2626)"
                              : "linear-gradient(90deg, #f59e0b, #d97706)",
                            borderRadius: 4,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b", marginTop: 3 }}>
                        <span>{absentCount > 0 ? `Bị trừ ${absentHours.toFixed(1)}h do vắng` : "Mặc định có mặt 100%"}</span>
                        <span>{isMet ? "Đạt chuẩn" : `Còn thiếu ${(kpiTarget - validKpiHours).toFixed(1)}h`}</span>
                      </div>
                    </div>

                    {/* STATUS BADGES & EXPAND TOGGLE */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 150, justifyContent: "flex-end" }}>
                      {isMet ? (
                        <span
                          style={{
                            background: "#dcfce7",
                            color: "#15803d",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={13} /> Đạt KPI 20h
                        </span>
                      ) : absentCount > 0 ? (
                        <span
                          style={{
                            background: "#fee2e2",
                            color: "#b91c1c",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <AlertTriangle size={13} /> Hụt giờ do vắng
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#fef3c7",
                            color: "#b45309",
                            padding: "3px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          Thiếu {(kpiTarget - validKpiHours).toFixed(1)}h lịch
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
                        Chi tiết lịch trực 6 ngày trong tuần của {member.full_name || member.username}:
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
                                        sh.isAbsent
                                          ? "#fee2e2"
                                          : sh.isPending
                                          ? "#fef3c7"
                                          : "#dcfce7",
                                      color:
                                        sh.isAbsent
                                          ? "#b91c1c"
                                          : sh.isPending
                                          ? "#b45309"
                                          : "#15803d",
                                      borderLeft:
                                        sh.isAbsent
                                          ? "3px solid #dc2626"
                                          : sh.isPending
                                          ? "3px solid #f59e0b"
                                          : "3px solid #16a34a",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                                      <span>Ca {sh.shift_id}</span>
                                      <span>{sh.duration}h</span>
                                    </div>
                                    <div style={{ fontSize: 9, opacity: 0.9 }}>
                                      {sh.isAbsent && "❌ VẮNG (Bị trừ giờ)"}
                                      {sh.isPending && "🟡 Chờ duyệt vắng"}
                                      {!sh.isAbsent && !sh.isPending && "✅ Có mặt"}
                                    </div>
                                    {sh.time_note && (
                                      <div style={{ fontSize: 8, color: "#64748b", fontStyle: "italic", marginTop: 1 }}>
                                        💬 {sh.time_note}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Day Summary */}
                            <div style={{ marginTop: "auto", paddingTop: 4, borderTop: "1px solid #f1f5f9", fontSize: 9 }}>
                              {day.hasMissed ? (
                                <span style={{ color: "#dc2626", fontWeight: 800 }}>
                                  ⚠️ Bị trừ {day.absentCount} ca!
                                </span>
                              ) : day.shifts.length > 0 ? (
                                <span style={{ color: "#16a34a", fontWeight: 700 }}>
                                  Có mặt {day.actualHours}h
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
              <strong>Quy tắc tính KPI:</strong> Mọi ca trong lịch phân công mặc định được tính CÓ MẶT đủ giờ. Khi nhân sự báo vắng (đã duyệt), hệ thống sẽ trừ trực tiếp số giờ vắng ra khỏi quỹ KPI tuần.
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
