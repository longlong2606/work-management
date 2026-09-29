import React, { useMemo } from "react";
import {
  X, Trophy, CheckCircle2
} from "lucide-react";

export function KpiLeaderboardModal({
  isOpen,
  onClose,
  allMembers = [],
  schedule = [],
  weekDays = [],
  kpiTarget = 20.0
}) {
  // Tính toán KPI cho từng nhân sự
  const leaderboardData = useMemo(() => {
    return allMembers.map((member) => {
      const activeShifts = schedule.filter(
        (s) => s.user_id === member.id && s.attendance_status !== "absent"
      );
      const absentShifts = schedule.filter(
        (s) => s.user_id === member.id && s.attendance_status === "absent"
      );

      const totalHours = activeShifts.reduce(
        (acc, curr) => acc + (curr.shift_id === 8 ? 0.5 : 1.5),
        0
      );

      const percent = Math.min(100, Math.round((totalHours / kpiTarget) * 100));
      const isMet = totalHours >= kpiTarget;

      return {
        member,
        shiftsCount: activeShifts.length,
        absentCount: absentShifts.length,
        hours: totalHours,
        percent,
        isMet,
      };
    }).sort((a, b) => b.hours - a.hours);
  }, [allMembers, schedule, kpiTarget]);

  if (!isOpen) return null;

  const metCount = leaderboardData.filter((d) => d.isMet).length;
  const totalLabHours = leaderboardData.reduce((acc, curr) => acc + curr.hours, 0);

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
        padding: 20
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 780,
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            background: "linear-gradient(135deg, #059669, #10b981)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Trophy size={24} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                Bảng Xếp Hạng & Chỉ Tiêu KPI Phòng Lab
              </h3>
              <div style={{ fontSize: 13, color: "#d1fae5", marginTop: 2 }}>
                Chuẩn tiêu chí Lab Management: Tối thiểu <strong>{kpiTarget} giờ / tuần</strong> ({weekDays[0]?.displayDate} - {weekDays[weekDays.length - 1]?.displayDate})
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#ffffff",
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats Summary Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            padding: "16px 24px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: "12px 16px",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>ĐÃ ĐẠT CHUẨN KPI (≥ 20h)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#059669", marginTop: 2 }}>
              {metCount} / {leaderboardData.length} <span style={{ fontSize: 13, fontWeight: 600 }}>người</span>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: "12px 16px",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>TỔNG GIỜ CẢ LAB TUẦN NÀY</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#2563eb", marginTop: 2 }}>
              {totalLabHours.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 600 }}>giờ</span>
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: 12,
              padding: "12px 16px",
              border: "1px solid #e2e8f0",
              textAlign: "center"
            }}
          >
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>TỶ LỆ HOÀN THÀNH LAB</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#7c3aed", marginTop: 2 }}>
              {leaderboardData.length > 0 ? Math.round((metCount / leaderboardData.length) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* List of Members */}
        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {leaderboardData.map((item, index) => {
              const { member, shiftsCount, absentCount, hours, percent, isMet } = item;
              const isTop1 = index === 0 && hours > 0;
              const isTop2 = index === 1 && hours > 0;
              const isTop3 = index === 2 && hours > 0;

              return (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 18px",
                    borderRadius: 14,
                    background: isMet ? "#f0fdf4" : hours >= 12 ? "#fcfbf7" : "#fff1f2",
                    border: isMet ? "1px solid #bbf7d0" : hours >= 12 ? "1px solid #e2e8f0" : "1px solid #fecaca",
                    gap: 16
                  }}
                >
                  {/* Rank & Avatar & Name */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 220 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: isTop1 ? "#fef08a" : isTop2 ? "#e2e8f0" : isTop3 ? "#fed7aa" : "#f1f5f9",
                        color: isTop1 ? "#854d0e" : isTop2 ? "#475569" : isTop3 ? "#9a3412" : "#64748b",
                        fontWeight: 900,
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      {isTop1 ? "🥇" : isTop2 ? "🥈" : isTop3 ? "🥉" : `#${index + 1}`}
                    </div>

                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: member.role === "admin" ? "#ede9fe" : "#dbeafe",
                        color: member.role === "admin" ? "#6d28d9" : "#1d4ed8",
                        fontWeight: 800,
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0
                      }}
                    >
                      {(member.full_name || member.username || "U")[0].toUpperCase()}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                        {member.full_name || member.username}
                      </div>
                      <div style={{ fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                        <span>@{member.username}</span>
                        <span>•</span>
                        <span>{shiftsCount} ca trực</span>
                        {absentCount > 0 && (
                          <>
                            <span>•</span>
                            <span style={{ color: "#dc2626", fontWeight: 600 }}>Vắng {absentCount} ca</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar & Hours */}
                  <div style={{ flex: 1, maxWidth: 280 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                      <span style={{ color: isMet ? "#059669" : "#475569" }}>
                        {hours.toFixed(1)}h / {kpiTarget}h
                      </span>
                      <span style={{ color: isMet ? "#059669" : hours >= 12 ? "#d97706" : "#dc2626" }}>
                        {percent}%
                      </span>
                    </div>

                    <div style={{ width: "100%", height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${percent}%`,
                          background: isMet
                            ? "linear-gradient(90deg, #10b981, #059669)"
                            : hours >= 12
                            ? "linear-gradient(90deg, #f59e0b, #d97706)"
                            : "linear-gradient(90deg, #f87171, #ef4444)",
                          transition: "width 0.3s ease"
                        }}
                      />
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div style={{ textAlign: "right", minWidth: 120 }}>
                    {isMet ? (
                      <span
                        style={{
                          background: "#dcfce7",
                          color: "#15803d",
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <CheckCircle2 size={13} /> Đạt KPI
                      </span>
                    ) : (
                      <span
                        style={{
                          background: hours >= 12 ? "#fef3c7" : "#fee2e2",
                          color: hours >= 12 ? "#b45309" : "#b91c1c",
                          padding: "4px 10px",
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        {hours >= 12 ? "Thiếu " + (kpiTarget - hours).toFixed(1) + "h" : "Cần bổ sung ca"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>
            * Thời lượng tính: <strong>Ca 1-7 & 9</strong> = 1.5 giờ; <strong>Ca 8</strong> = 0.5 giờ theo timeline trường.
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
