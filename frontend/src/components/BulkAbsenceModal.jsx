import React, { useState, useMemo } from "react";
import {
  X, CalendarX2, Clock, AlertTriangle, User
} from "lucide-react";
import { SHIFTS } from "../constants/shifts";
import { api } from "../services/api";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BulkAbsenceModal({
  isOpen,
  onClose,
  currentUser,
  allMembers = [],
  weekDays = [],
  schedule = [],
  onSuccess
}) {
  const isAdmin = currentUser?.role === "admin";

  // Selected target member (Staff default to themselves, Admin can pick any member)
  const [targetUserId, setTargetUserId] = useState(currentUser?.id || "");
  
  // Scope Mode: 'whole_week' | 'date_range' | 'custom_days'
  const [scopeMode, setScopeMode] = useState("whole_week");

  // Dates state
  const [todayStr] = useState(getTodayStr);

  const [startDate, setStartDate] = useState(weekDays[0]?.dateStr || todayStr);
  const [endDate, setEndDate] = useState(weekDays[weekDays.length - 1]?.dateStr || todayStr);
  
  // Custom days list (selected dateStr)
  const [selectedDates, setSelectedDates] = useState(() => {
    return weekDays.map((d) => d.dateStr);
  });

  // Shift selection: 'all' | 'morning' | 'afternoon' | 'evening' | 'custom'
  const [shiftScope, setShiftScope] = useState("all");
  const [customShiftIds, setCustomShiftIds] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  // Reason
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Determine final dates to apply
  const finalDates = useMemo(() => {
    if (scopeMode === "whole_week") {
      return weekDays.map((d) => d.dateStr).filter((d) => d >= todayStr);
    }
    if (scopeMode === "date_range") {
      const dates = [];
      if (startDate && endDate) {
        let cur = new Date(startDate);
        const end = new Date(endDate);
        while (cur <= end) {
          const ds = cur.toISOString().split("T")[0];
          if (ds >= todayStr) dates.push(ds);
          cur.setDate(cur.getDate() + 1);
        }
      }
      return dates;
    }
    if (scopeMode === "custom_days") {
      return selectedDates.filter((d) => d >= todayStr);
    }
    return [];
  }, [scopeMode, weekDays, startDate, endDate, selectedDates, todayStr]);

  // Determine final shift IDs
  const finalShiftIds = useMemo(() => {
    if (shiftScope === "all") return [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (shiftScope === "morning") return [1, 2, 3];
    if (shiftScope === "afternoon") return [4, 5, 6];
    if (shiftScope === "evening") return [7, 8, 9];
    if (shiftScope === "custom") return customShiftIds;
    return [1, 2, 3, 4, 5, 6, 7, 8, 9];
  }, [shiftScope, customShiftIds]);

  // Calculate matching scheduled shifts for preview
  const affectedShifts = useMemo(() => {
    const uid = Number(targetUserId) || currentUser?.id;
    return schedule.filter((s) => {
      return (
        s.user_id === uid &&
        finalDates.includes(s.work_date) &&
        finalShiftIds.includes(s.shift_id) &&
        s.attendance_status !== "absent"
      );
    });
  }, [schedule, targetUserId, currentUser, finalDates, finalShiftIds]);

  if (!isOpen) return null;

  // Toggle single date in custom_days mode
  const handleToggleDate = (dateStr) => {
    setSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  // Toggle single shift id
  const handleToggleShiftId = (sId) => {
    setCustomShiftIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId].sort((a, b) => a - b)
    );
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMsg("Vui lòng nhập lý do xin vắng ca!");
      return;
    }
    if (finalDates.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất một ngày làm việc trong tương lai hoặc hôm nay!");
      return;
    }
    if (finalShiftIds.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất một ca làm việc!");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await api.reportAbsenceBulk({
        user_id: Number(targetUserId) || currentUser?.id,
        reason: reason.trim(),
        dates: finalDates,
        shift_ids: finalShiftIds,
      });

      if (onSuccess) {
        onSuccess(res.message || `Đã nộp đơn báo vắng thành công cho ${res.affected_count || affectedShifts.length} ca!`);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || "Lỗi khi nộp đơn báo vắng hàng loạt!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10002,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 620,
          maxHeight: "92vh",
          backgroundColor: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= HEADER ================= */}
        <div
          style={{
            padding: "18px 24px",
            background: "linear-gradient(135deg, #b91c1c, #dc2626)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarX2 size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                Đơn Báo Vắng Tuần & Nhiều Ca Trực
              </h3>
              <div style={{ fontSize: 12, color: "#fecaca", marginTop: 2 }}>
                Xin nghỉ trọn vẹn cả tuần, nghỉ vài ngày hoặc nhiều ca cùng lúc
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              color: "#ffffff",
              width: 32,
              height: 32,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ================= FORM BODY ================= */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                color: "#b91c1c",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertTriangle size={16} />
              {errorMsg}
            </div>
          )}

          {/* 1. NGƯỜI XIN NGHỈ (ADMIN CÓ THỂ CHỌN NHÂN SỰ) */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "block" }}>
              👤 Nhân sự nộp đơn xin nghỉ:
            </label>
            {isAdmin ? (
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="form-control"
                style={{ fontWeight: 600 }}
              >
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.username} (@{m.username}) {m.id === currentUser?.id ? "— (Tôi)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "10px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <User size={16} color="#2563eb" />
                {currentUser?.full_name || currentUser?.username} (@{currentUser?.username})
              </div>
            )}
          </div>

          {/* 2. PHẠM VI THỜI GIAN NGHỈ (SCOPE TABS) */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "block" }}>
              📅 Phạm vi thời gian xin nghỉ:
            </label>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => setScopeMode("whole_week")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: scopeMode === "whole_week" ? "#dc2626" : "#cbd5e1",
                  background: scopeMode === "whole_week" ? "#fef2f2" : "#ffffff",
                  color: scopeMode === "whole_week" ? "#b91c1c" : "#475569",
                  flex: 1,
                  textAlign: "center",
                }}
              >
                🌟 Cả tuần này
              </button>

              <button
                type="button"
                onClick={() => setScopeMode("date_range")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: scopeMode === "date_range" ? "#dc2626" : "#cbd5e1",
                  background: scopeMode === "date_range" ? "#fef2f2" : "#ffffff",
                  color: scopeMode === "date_range" ? "#b91c1c" : "#475569",
                  flex: 1,
                  textAlign: "center",
                }}
              >
                📅 Khoảng ngày (Từ - Đến)
              </button>

              <button
                type="button"
                onClick={() => setScopeMode("custom_days")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: scopeMode === "custom_days" ? "#dc2626" : "#cbd5e1",
                  background: scopeMode === "custom_days" ? "#fef2f2" : "#ffffff",
                  color: scopeMode === "custom_days" ? "#b91c1c" : "#475569",
                  flex: 1,
                  textAlign: "center",
                }}
              >
                📆 Chọn các ngày cụ thể
              </button>
            </div>

            {/* Chi tiết theo từng mode */}
            {scopeMode === "whole_week" && (
              <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12, color: "#475569" }}>
                ✨ Sẽ xin vắng tất cả các ngày làm việc trong tuần hiện tại:{" "}
                <strong>{weekDays[0]?.displayDate} $\rightarrow$ {weekDays[weekDays.length - 1]?.displayDate}</strong>.
              </div>
            )}

            {scopeMode === "date_range" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, background: "#f8fafc", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, display: "block" }}>
                    Từ ngày (*):
                  </label>
                  <input
                    type="date"
                    min={todayStr}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="form-control"
                    style={{ fontWeight: 600, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, display: "block" }}>
                    Đến ngày (*):
                  </label>
                  <input
                    type="date"
                    min={startDate || todayStr}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="form-control"
                    style={{ fontWeight: 600, fontSize: 13 }}
                  />
                </div>
              </div>
            )}

            {scopeMode === "custom_days" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, background: "#f8fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                {weekDays.map((d) => {
                  const isChecked = selectedDates.includes(d.dateStr);
                  const isPast = d.dateStr < todayStr;
                  return (
                    <button
                      type="button"
                      key={d.dateStr}
                      disabled={isPast}
                      onClick={() => handleToggleDate(d.dateStr)}
                      style={{
                        padding: "8px 4px",
                        borderRadius: 6,
                        border: isChecked ? "1.5px solid #dc2626" : "1px solid #cbd5e1",
                        background: isChecked ? "#fef2f2" : "#ffffff",
                        color: isChecked ? "#b91c1c" : isPast ? "#94a3b8" : "#334155",
                        fontWeight: isChecked ? 800 : 600,
                        cursor: isPast ? "not-allowed" : "pointer",
                        opacity: isPast ? 0.5 : 1,
                        fontSize: 11,
                        textAlign: "center",
                      }}
                    >
                      <div>{d.dayName.replace("Thứ ", "T")}</div>
                      <div style={{ fontSize: 10, opacity: 0.8 }}>{d.displayDate}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. CHỌN CA ÁP DỤNG (SHIFTS SCOPE) */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, display: "block" }}>
              ⚡ Ca làm việc xin nghỉ trong các ngày đã chọn:
            </label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <button
                type="button"
                onClick={() => setShiftScope("all")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: shiftScope === "all" ? "#dc2626" : "#cbd5e1",
                  background: shiftScope === "all" ? "#fef2f2" : "#ffffff",
                  color: shiftScope === "all" ? "#b91c1c" : "#475569",
                }}
              >
                🌟 Tất cả các ca (Ca 1 - Ca 9)
              </button>

              <button
                type="button"
                onClick={() => setShiftScope("morning")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: shiftScope === "morning" ? "#2563eb" : "#cbd5e1",
                  background: shiftScope === "morning" ? "#eff6ff" : "#ffffff",
                  color: shiftScope === "morning" ? "#1d4ed8" : "#475569",
                }}
              >
                🌅 Ca Sáng (Ca 1, 2, 3)
              </button>

              <button
                type="button"
                onClick={() => setShiftScope("afternoon")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: shiftScope === "afternoon" ? "#ea580c" : "#cbd5e1",
                  background: shiftScope === "afternoon" ? "#fff7ed" : "#ffffff",
                  color: shiftScope === "afternoon" ? "#c2410c" : "#475569",
                }}
              >
                ☀️ Ca Chiều (Ca 4, 5, 6)
              </button>

              <button
                type="button"
                onClick={() => setShiftScope("evening")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: shiftScope === "evening" ? "#7c3aed" : "#cbd5e1",
                  background: shiftScope === "evening" ? "#f5f3ff" : "#ffffff",
                  color: shiftScope === "evening" ? "#6d28d9" : "#475569",
                }}
              >
                🌙 Ca Tối (Ca 7, 8, 9)
              </button>

              <button
                type="button"
                onClick={() => setShiftScope("custom")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: shiftScope === "custom" ? "#0f172a" : "#cbd5e1",
                  background: shiftScope === "custom" ? "#f1f5f9" : "#ffffff",
                  color: shiftScope === "custom" ? "#0f172a" : "#475569",
                }}
              >
                ⚙️ Tự chọn từng ca
              </button>
            </div>

            {/* Custom shifts selector */}
            {shiftScope === "custom" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, background: "#f8fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                {SHIFTS.map((s) => {
                  const isChecked = customShiftIds.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => handleToggleShiftId(s.id)}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: isChecked ? "1.5px solid #dc2626" : "1px solid #cbd5e1",
                        background: isChecked ? "#fef2f2" : "#ffffff",
                        color: isChecked ? "#b91c1c" : "#334155",
                        fontWeight: isChecked ? 700 : 500,
                        cursor: "pointer",
                        fontSize: 11,
                        textAlign: "left",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{s.name.split(" ")[0]} {s.name.split(" ")[1]}</span>
                      <span>{isChecked ? "✓" : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. PREVIEW SỐ CA ĐƯỢC ÁP DỤNG */}
          <div
            style={{
              padding: "12px 14px",
              background: affectedShifts.length > 0 ? "#fffbeb" : "#f1f5f9",
              border: affectedShifts.length > 0 ? "1px solid #fde68a" : "1px solid #e2e8f0",
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: affectedShifts.length > 0 ? "#b45309" : "#475569" }}>
              <Clock size={16} />
              <span>
                Tìm thấy {affectedShifts.length} ca trực thực tế trong lịch phù hợp với phạm vi xin nghỉ
              </span>
            </div>
            {affectedShifts.length > 0 && (
              <div style={{ fontSize: 11, color: "#78350f", marginTop: 4, lineHeight: 1.4 }}>
                Các ca sẽ được chuyển sang trạng thái <strong>Chờ Quản lý duyệt</strong>:{" "}
                {affectedShifts.slice(0, 8).map((s, idx) => (
                  <span key={idx} style={{ background: "#ffffff", padding: "1px 6px", borderRadius: 4, border: "1px solid #fde68a", marginRight: 4, display: "inline-block", marginTop: 2 }}>
                    Ca {s.shift_id} ({s.work_date.slice(5).replace("-", "/")})
                  </span>
                ))}
                {affectedShifts.length > 8 && ` ... và ${affectedShifts.length - 8} ca khác`}
              </div>
            )}
          </div>

          {/* 5. LÝ DO XIN VẮNG (*) */}
          <div style={{ marginBottom: 18 }}>
            <label className="form-label" style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, display: "block" }}>
              📝 Lý do xin nghỉ (*):
            </label>
            <textarea
              rows={3}
              required
              placeholder="Ví dụ: Bị ốm cần điều trị theo chỉ định bác sĩ, Về quê việc gia đình, Bận lịch thi học kỳ..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="form-control"
              style={{ fontSize: 13 }}
            />
            {/* Quick reason pills */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
              {[
                "Bị ốm / Sốt cần nghỉ ngơi",
                "Về quê có việc gia đình đột xuất",
                "Bận lịch thi / Học quân sự",
                "Đi công tác / Nghiên cứu ngoài trường",
              ].map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setReason(r)}
                  style={{
                    background: "#f1f5f9",
                    border: "1px solid #cbd5e1",
                    borderRadius: 12,
                    padding: "2px 8px",
                    fontSize: 11,
                    color: "#475569",
                    cursor: "pointer",
                  }}
                >
                  + {r}
                </button>
              ))}
            </div>
          </div>

          {/* ================= ACTIONS ================= */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="btn btn-secondary btn-sm"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-danger btn-sm"
              style={{ fontWeight: 700, padding: "8px 18px", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {loading ? "Đang gửi..." : `✓ Gửi Đơn Báo Vắng (${affectedShifts.length || finalDates.length * finalShiftIds.length} ca)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
