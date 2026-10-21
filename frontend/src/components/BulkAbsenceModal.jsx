import React, { useState, useMemo, useEffect } from "react";
import {
  X, CalendarX2, Clock, AlertTriangle, User, RotateCcw, CheckCircle2
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
  onSuccess,
  initialMode = "absence",
  initialDate = null,
}) {
  const isAdmin = currentUser?.role === "admin" || Boolean(currentUser?.can_manage_schedule);

  // Action Mode: 'absence' (Báo vắng) | 'restore' (Khôi phục có mặt)
  const [actionMode, setActionMode] = useState(initialMode || "absence");
  const isRestore = actionMode === "restore";
  const themeColor = isRestore ? "#059669" : "#dc2626";
  const themeBgLight = isRestore ? "#f0fdf4" : "#fef2f2";
  const themeActiveBorder = isRestore ? "#059669" : "#dc2626";
  const themeText = isRestore ? "#047857" : "#b91c1c";

  const memberOptions = useMemo(() => {
    if (!allMembers || allMembers.length === 0) {
      if (currentUser) return [currentUser];
      return [];
    }
    const hasCurrent = allMembers.some((m) => m.id === currentUser?.id);
    if (!hasCurrent && currentUser) {
      return [currentUser, ...allMembers];
    }
    return allMembers;
  }, [allMembers, currentUser]);

  // Selected target member (Staff default to themselves, Admin defaults to "all" in restore mode, or currentUser in absence mode)
  const [targetUserId, setTargetUserId] = useState(() => {
    if (isAdmin && (initialMode === "restore")) return "all";
    return currentUser?.id || "";
  });
  
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

  // Sync state when modal is opened or weekDays/user change
  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      setLoading(false);
      const mode = initialMode || "absence";
      setActionMode(mode);
      
      if (isAdmin && mode === "restore") {
        setTargetUserId("all");
      } else {
        setTargetUserId(currentUser?.id || "");
      }

      if (initialDate) {
        setScopeMode("custom_days");
        setStartDate(initialDate);
        setEndDate(initialDate);
        setSelectedDates([initialDate]);
      } else if (weekDays && weekDays.length > 0) {
        setScopeMode("whole_week");
        if (isAdmin || mode === "restore") {
          // Allow all days in the week view
          const start = weekDays[0]?.dateStr || todayStr;
          const end = weekDays[weekDays.length - 1]?.dateStr || start;
          setStartDate(start);
          setEndDate(end);
          setSelectedDates(weekDays.map((d) => d.dateStr));
        } else {
          const futureDays = weekDays.filter((d) => d.dateStr >= todayStr);
          const start = futureDays[0]?.dateStr || todayStr;
          const end = futureDays[futureDays.length - 1]?.dateStr || start;
          setStartDate(start);
          setEndDate(end);
          setSelectedDates(futureDays.map((d) => d.dateStr));
        }
      }
    }
  }, [isOpen, weekDays, currentUser, todayStr, initialMode, initialDate, isAdmin]);

  // Determine final dates to apply
  const finalDates = useMemo(() => {
    // When in restore mode or user is Admin, allow past dates!
    const allowPastDates = isAdmin || isRestore;

    if (scopeMode === "whole_week") {
      const dates = weekDays.map((d) => d.dateStr);
      return allowPastDates ? dates : dates.filter((d) => d >= todayStr);
    }
    if (scopeMode === "date_range") {
      const dates = [];
      if (startDate && endDate) {
        const [sy, sm, sd] = startDate.split("-").map(Number);
        const [ey, em, ed] = endDate.split("-").map(Number);
        if (!isNaN(sy) && !isNaN(ey)) {
          const cur = new Date(sy, sm - 1, sd, 12, 0, 0);
          const end = new Date(ey, em - 1, ed, 12, 0, 0);
          while (cur <= end) {
            const y = cur.getFullYear();
            const m = String(cur.getMonth() + 1).padStart(2, "0");
            const d = String(cur.getDate()).padStart(2, "0");
            const ds = `${y}-${m}-${d}`;
            if (allowPastDates || ds >= todayStr) dates.push(ds);
            cur.setDate(cur.getDate() + 1);
          }
        }
      }
      return dates;
    }
    if (scopeMode === "custom_days") {
      return allowPastDates ? selectedDates : selectedDates.filter((d) => d >= todayStr);
    }
    return [];
  }, [scopeMode, weekDays, startDate, endDate, selectedDates, todayStr, isAdmin, isRestore]);

  // Determine final shift IDs
  const finalShiftIds = useMemo(() => {
    if (shiftScope === "all") return [1, 2, 3, 4, 5, 6, 7, 8, 9];
    if (shiftScope === "morning") return [1, 2, 3];
    if (shiftScope === "afternoon") return [4, 5, 6];
    if (shiftScope === "evening") return [7, 8, 9];
    if (shiftScope === "custom") return customShiftIds;
    return [1, 2, 3, 4, 5, 6, 7, 8, 9];
  }, [shiftScope, customShiftIds]);

  // Calculate matching scheduled shifts for preview (exclude already absent and pending_absence)
  const affectedShifts = useMemo(() => {
    const isAll = targetUserId === "all";
    const uid = Number(targetUserId) || currentUser?.id;
    return schedule.filter((s) => {
      const matchUser = isAll ? true : s.user_id === uid;
      return (
        matchUser &&
        finalDates.includes(s.work_date) &&
        finalShiftIds.includes(s.shift_id) &&
        s.attendance_status !== "absent" &&
        s.attendance_status !== "pending_absence"
      );
    });
  }, [schedule, targetUserId, currentUser, finalDates, finalShiftIds]);

  // Detected duplicate shifts that already have an absence request or are marked absent
  const duplicateShifts = useMemo(() => {
    const isAll = targetUserId === "all";
    const uid = Number(targetUserId) || currentUser?.id;
    return schedule.filter((s) => {
      const matchUser = isAll ? true : s.user_id === uid;
      return (
        matchUser &&
        finalDates.includes(s.work_date) &&
        finalShiftIds.includes(s.shift_id) &&
        (s.attendance_status === "absent" || s.attendance_status === "pending_absence")
      );
    });
  }, [schedule, targetUserId, currentUser, finalDates, finalShiftIds]);

  const allSelectedDuplicates = duplicateShifts.length > 0 && affectedShifts.length === 0;

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

    if (finalDates.length === 0) {
      setErrorMsg(isAdmin 
        ? "Vui lòng chọn ít nhất một ngày làm việc!" 
        : "Vui lòng chọn ít nhất một ngày làm việc hôm nay hoặc trong tương lai!");
      return;
    }
    if (finalShiftIds.length === 0) {
      setErrorMsg("Vui lòng chọn ít nhất một ca làm việc!");
      return;
    }

    if (isRestore) {
      if (duplicateShifts.length === 0) {
        setErrorMsg("Không tìm thấy ca trực nào đang báo vắng hoặc chờ duyệt trong khoảng thời gian đã chọn!");
        return;
      }
      setLoading(true);
      setErrorMsg("");
      try {
        const payload = {
          dates: finalDates,
          shift_ids: finalShiftIds,
        };
        if (targetUserId !== "all") {
          payload.user_id = Number(targetUserId) || currentUser?.id;
        }
        const res = await api.cancelAbsenceBulk(payload);
        if (onSuccess) {
          onSuccess(res.message || `Đã khôi phục có mặt thành công cho ${res.affected_count || duplicateShifts.length} ca trực!`);
        }
        onClose();
      } catch (err) {
        setErrorMsg(err.message || "Lỗi khi khôi phục có mặt hàng loạt!");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Absence mode
    const targetUid = Number(targetUserId) || currentUser?.id;
    if (!targetUid) {
      setErrorMsg("Vui lòng chọn nhân sự nộp đơn!");
      return;
    }

    if (allSelectedDuplicates) {
      setErrorMsg(`Tất cả ${duplicateShifts.length} ca làm việc được chọn đều đã nộp đơn báo vắng (đang chờ duyệt) hoặc đã được phê duyệt nghỉ. Bạn có thể nhấn tab 'Khôi phục có mặt' ở trên để hủy nghỉ.`);
      return;
    }
    if (!reason.trim()) {
      setErrorMsg("Vui lòng nhập lý do xin vắng ca!");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await api.reportAbsenceBulk({
        user_id: targetUid,
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
          maxWidth: 820,
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
            background: isRestore
              ? "linear-gradient(135deg, #059669, #10b981)"
              : "linear-gradient(135deg, #b91c1c, #dc2626)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            transition: "all 0.3s ease",
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
              {isRestore ? (
                <RotateCcw size={22} color="#ffffff" />
              ) : (
                <CalendarX2 size={22} color="#ffffff" />
              )}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                {isRestore ? "Khôi Phục Có Mặt Hàng Loạt" : "Đơn Báo Vắng Tuần & Nhiều Ca Trực"}
              </h3>
              <div style={{ fontSize: 12, color: isRestore ? "#a7f3d0" : "#fecaca", marginTop: 2 }}>
                {isRestore
                  ? "Hủy đơn xin nghỉ / xác nhận có mặt lại cho cả tuần, theo khoảng ngày hoặc nhiều ca"
                  : "Xin nghỉ trọn vẹn cả tuần, nghỉ vài ngày hoặc nhiều ca cùng lúc"}
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

        {/* ================= TAB SWITCHER ================= */}
        <div
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 24px",
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <button
            type="button"
            onClick={() => setActionMode("absence")}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              border: "1.5px solid",
              borderColor: !isRestore ? "#dc2626" : "#cbd5e1",
              background: !isRestore ? "#fef2f2" : "#ffffff",
              color: !isRestore ? "#b91c1c" : "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.2s ease",
            }}
          >
            <CalendarX2 size={16} /> 📝 Báo Vắng Ca / Tuần
          </button>

          <button
            type="button"
            onClick={() => setActionMode("restore")}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              border: "1.5px solid",
              borderColor: isRestore ? "#059669" : "#cbd5e1",
              background: isRestore ? "#f0fdf4" : "#ffffff",
              color: isRestore ? "#047857" : "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.2s ease",
            }}
          >
            <RotateCcw size={16} /> 🔄 Khôi Phục Có Mặt Hàng Loạt
          </button>
        </div>

        {/* ================= FORM BODY (2-COLUMN GROUPED) ================= */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                color: "#b91c1c",
                padding: "10px 14px",
                borderRadius: 10,
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

          {/* 2-COLUMN GRID SECTION */}
          <div className="bulk-absence-grid">
            {/* CỘT TRÁI: NHÂN SỰ & NGÀY NGHỈ & LÝ DO */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* 1. NGƯỜI XIN NGHỈ */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <label style={{ fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6, display: "block", textTransform: "uppercase" }}>
                  👤 1. {isRestore ? "Nhân sự cần khôi phục có mặt:" : "Nhân sự nộp đơn:"}
                </label>
                {isAdmin ? (
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="form-control"
                    style={{ fontWeight: 600, fontSize: 13, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #cbd5e1" }}
                  >
                    {isRestore && (
                      <option value="all">🌟 Tất cả nhân sự (Khôi phục toàn bộ)</option>
                    )}
                    {memberOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.username} (@{m.username}) {m.id === currentUser?.id ? "— (Bạn / Admin)" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      padding: "8px 12px",
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
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 8, fontStyle: "italic" }}>
                  💡 Đơn xin nghỉ vắng chỉ áp dụng riêng cho nhân sự được chọn ở trên. Các nhân viên khác trong ca vẫn làm việc bình thường.
                </div>
              </div>

              {/* 2. PHẠM VI NGÀY NGHỈ */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <label style={{ fontWeight: 700, fontSize: 12, color: "#475569", display: "block", textTransform: "uppercase" }}>
                  📅 2. {isRestore ? "Thời gian khôi phục có mặt:" : "Thời gian xin nghỉ:"}
                </label>
                <div style={{ display: "flex", gap: 5 }}>
                  <button
                    type="button"
                    onClick={() => setScopeMode("whole_week")}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: scopeMode === "whole_week" ? themeActiveBorder : "#cbd5e1",
                      background: scopeMode === "whole_week" ? themeBgLight : "#ffffff",
                      color: scopeMode === "whole_week" ? themeText : "#475569",
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    🌟 Cả tuần
                  </button>

                  <button
                    type="button"
                    onClick={() => setScopeMode("date_range")}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: scopeMode === "date_range" ? themeActiveBorder : "#cbd5e1",
                      background: scopeMode === "date_range" ? themeBgLight : "#ffffff",
                      color: scopeMode === "date_range" ? themeText : "#475569",
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    📅 Khoảng ngày
                  </button>

                  <button
                    type="button"
                    onClick={() => setScopeMode("custom_days")}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 8,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: scopeMode === "custom_days" ? themeActiveBorder : "#cbd5e1",
                      background: scopeMode === "custom_days" ? themeBgLight : "#ffffff",
                      color: scopeMode === "custom_days" ? themeText : "#475569",
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    📆 Chọn ngày
                  </button>
                </div>

                {/* Chi tiết theo từng mode */}
                {scopeMode === "whole_week" && (
                  <div style={{ background: "#ffffff", padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11.5, color: "#475569" }}>
                    ✨ Áp dụng các ngày trong tuần:{" "}
                    <strong>{weekDays[0]?.displayDate} → {weekDays[weekDays.length - 1]?.displayDate}</strong>.
                  </div>
                )}

                {scopeMode === "date_range" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#ffffff", padding: 8, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div>
                      <label style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", marginBottom: 3, display: "block" }}>
                        Từ ngày (*):
                      </label>
                      <input
                        type="date"
                        min={todayStr}
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontWeight: 600, fontSize: 12, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", marginBottom: 3, display: "block" }}>
                        Đến ngày (*):
                      </label>
                      <input
                        type="date"
                        min={startDate || todayStr}
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontWeight: 600, fontSize: 12, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                )}

                {scopeMode === "custom_days" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4, background: "#ffffff", padding: 8, borderRadius: 8, border: "1px solid #e2e8f0" }}>
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
                            padding: "6px 2px",
                            borderRadius: 6,
                            border: isChecked ? `1.5px solid ${themeActiveBorder}` : "1px solid #cbd5e1",
                            background: isChecked ? themeBgLight : "#ffffff",
                            color: isChecked ? themeText : isPast ? "#94a3b8" : "#334155",
                            fontWeight: isChecked ? 800 : 600,
                            cursor: isPast ? "not-allowed" : "pointer",
                            opacity: isPast ? 0.5 : 1,
                            fontSize: 10.5,
                            textAlign: "center",
                          }}
                        >
                          <div>{d.dayName.replace("Thứ ", "T")}</div>
                          <div style={{ fontSize: 9.5, opacity: 0.8 }}>{d.displayDate}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. LÝ DO XIN VẮNG / GHI CHÚ KHÔI PHỤC */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "12px 14px",
                }}
              >
                <label style={{ fontWeight: 700, fontSize: 12, color: "#475569", marginBottom: 6, display: "block", textTransform: "uppercase" }}>
                  {isRestore ? "💬 3. Ghi chú khôi phục (Tùy chọn):" : "📝 3. Lý do xin nghỉ (*):"}
                </label>
                <textarea
                  required={!isRestore}
                  rows={2}
                  placeholder={
                    isRestore
                      ? "Ví dụ: Lịch bận đã hủy, có thể đi làm lại bình thường..."
                      : "Ví dụ: Bận lịch thi học kỳ, việc gia đình đột xuất, ốm sốt..."
                  }
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    background: "#ffffff",
                    resize: "vertical"
                  }}
                />
                {/* Quick reason pills */}
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                  {(isRestore
                    ? [
                        "Lịch bận đã hủy / Có mặt lại",
                        "Đã hoàn thành việc riêng sớm",
                        "Nhầm lẫn khi gửi đơn báo vắng",
                      ]
                    : [
                        "Bị ốm / Sốt cần nghỉ ngơi",
                        "Về quê có việc gia đình đột xuất",
                        "Bận lịch thi / Học quân sự",
                      ]
                  ).map((r) => (
                    <button
                      type="button"
                      key={r}
                      onClick={() => setReason(r)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: 12,
                        padding: "2px 7px",
                        fontSize: 10.5,
                        color: "#475569",
                        cursor: "pointer",
                      }}
                    >
                      + {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: CA TRỰC & XEM TRƯỚC */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* 4. CHỌN CA ÁP DỤNG */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <label style={{ fontWeight: 700, fontSize: 12, color: "#475569", display: "block", textTransform: "uppercase" }}>
                  ⚡ 4. {isRestore ? "Ca làm việc khôi phục:" : "Ca làm việc xin nghỉ:"}
                </label>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setShiftScope("all")}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: shiftScope === "all" ? themeActiveBorder : "#cbd5e1",
                      background: shiftScope === "all" ? themeBgLight : "#ffffff",
                      color: shiftScope === "all" ? themeText : "#475569",
                    }}
                  >
                    🌟 Tất cả 9 ca
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftScope("morning")}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: shiftScope === "morning" ? "#2563eb" : "#cbd5e1",
                      background: shiftScope === "morning" ? "#eff6ff" : "#ffffff",
                      color: shiftScope === "morning" ? "#1d4ed8" : "#475569",
                    }}
                  >
                    🌅 Sáng (1-3)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftScope("afternoon")}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: shiftScope === "afternoon" ? "#ea580c" : "#cbd5e1",
                      background: shiftScope === "afternoon" ? "#fff7ed" : "#ffffff",
                      color: shiftScope === "afternoon" ? "#c2410c" : "#475569",
                    }}
                  >
                    ☀️ Chiều (4-6)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftScope("evening")}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: shiftScope === "evening" ? "#7c3aed" : "#cbd5e1",
                      background: shiftScope === "evening" ? "#f5f3ff" : "#ffffff",
                      color: shiftScope === "evening" ? "#6d28d9" : "#475569",
                    }}
                  >
                    🌙 Tối (7-9)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftScope("custom")}
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: shiftScope === "custom" ? "#0f172a" : "#cbd5e1",
                      background: shiftScope === "custom" ? "#f1f5f9" : "#ffffff",
                      color: shiftScope === "custom" ? "#0f172a" : "#475569",
                    }}
                  >
                    ⚙️ Tự chọn
                  </button>
                </div>

                {shiftScope === "custom" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, background: "#ffffff", padding: 8, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    {SHIFTS.map((s) => {
                      const isChecked = customShiftIds.includes(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => handleToggleShiftId(s.id)}
                          style={{
                            padding: "5px 6px",
                            borderRadius: 6,
                            border: isChecked ? `1.5px solid ${themeActiveBorder}` : "1px solid #cbd5e1",
                            background: isChecked ? themeBgLight : "#ffffff",
                            color: isChecked ? themeText : "#334155",
                            fontWeight: isChecked ? 700 : 500,
                            cursor: "pointer",
                            fontSize: 10.5,
                            textAlign: "left",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span>Ca {s.id}</span>
                          <span>{isChecked ? "✓" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. PREVIEW SỐ CA ĐƯỢC ÁP DỤNG */}
              <div
                style={{
                  padding: "14px 16px",
                  background: isRestore
                    ? duplicateShifts.length > 0
                      ? "#f0fdf4"
                      : "#f8fafc"
                    : allSelectedDuplicates
                    ? "#fef2f2"
                    : affectedShifts.length > 0
                    ? "#fffbeb"
                    : "#f8fafc",
                  border: isRestore
                    ? duplicateShifts.length > 0
                      ? "1.5px solid #86efac"
                      : "1px solid #e2e8f0"
                    : allSelectedDuplicates
                    ? "1.5px solid #fca5a5"
                    : affectedShifts.length > 0
                    ? "1.5px solid #fde68a"
                    : "1px solid #e2e8f0",
                  borderRadius: 12,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                {isRestore ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: duplicateShifts.length > 0 ? "#15803d" : "#475569" }}>
                      <RotateCcw size={16} />
                      <span>
                        {duplicateShifts.length > 0
                          ? `Tìm thấy ${duplicateShifts.length} ca trực đang vắng mặt / chờ duyệt cần khôi phục:`
                          : `Không tìm thấy ca trực nào đang báo vắng trong khoảng thời gian đã chọn`}
                      </span>
                    </div>

                    {duplicateShifts.length > 0 && (
                      <div style={{ fontSize: 11, color: "#166534", marginTop: 8, lineHeight: 1.5, maxHeight: 110, overflowY: "auto" }}>
                        Các ca này sẽ được chuyển về <strong>🟢 Có mặt bình thường</strong>:
                        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {duplicateShifts.map((s, idx) => {
                            const memberObj = (allMembers || []).find((m) => m.id === s.user_id) || (s.user_id === currentUser?.id ? currentUser : null);
                            const memberName = s.full_name || memberObj?.full_name || memberObj?.username || `NV #${s.user_id}`;
                            return (
                              <span
                                key={idx}
                                style={{
                                  background: "#ffffff",
                                  padding: "3px 8px",
                                  borderRadius: 5,
                                  border: "1px solid #86efac",
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  color: "#166534",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <span>Ca {s.shift_id} ({s.work_date.slice(5).replace("-", "/")})</span>
                                {targetUserId === "all" && <span style={{ color: "#0f766e", fontWeight: 700 }}>• {memberName}</span>}
                                <span style={{ fontSize: 9.5, opacity: 0.85 }}>({s.attendance_status === "pending_absence" ? "Chờ duyệt" : "Đã nghỉ"})</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {duplicateShifts.length === 0 && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                        ℹ️ Nhân sự đã có mặt đầy đủ trong các ca thuộc phạm vi thời gian này.
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: allSelectedDuplicates ? "#b91c1c" : affectedShifts.length > 0 ? "#b45309" : "#475569" }}>
                      {allSelectedDuplicates ? <AlertTriangle size={16} /> : <Clock size={16} />}
                      <span>
                        {allSelectedDuplicates 
                          ? `Tất cả ${duplicateShifts.length} ca đã nộp đơn hoặc duyệt nghỉ!`
                          : `Tìm thấy ${affectedShifts.length} ca trực hợp lệ cần báo vắng`}
                      </span>
                    </div>

                    {affectedShifts.length > 0 && (
                      <div style={{ fontSize: 11, color: "#78350f", marginTop: 8, lineHeight: 1.5, maxHeight: 110, overflowY: "auto" }}>
                        Các ca này sẽ được chuyển sang <strong>Chờ Quản lý duyệt</strong>:
                        <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {affectedShifts.slice(0, 10).map((s, idx) => (
                            <span key={idx} style={{ background: "#ffffff", padding: "2px 6px", borderRadius: 4, border: "1px solid #fde68a", fontSize: 10.5, fontWeight: 600 }}>
                              Ca {s.shift_id} ({s.work_date.slice(5).replace("-", "/")})
                            </span>
                          ))}
                          {affectedShifts.length > 10 && (
                            <span style={{ fontSize: 10.5, color: "#92400e", fontWeight: 700, padding: "2px 4px" }}>
                              +{affectedShifts.length - 10} ca khác
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {duplicateShifts.length > 0 && (
                      <div
                        style={{
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          borderRadius: 8,
                          padding: "8px 10px",
                          marginTop: 8,
                          fontSize: 11,
                          color: "#9a3412",
                        }}
                      >
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <AlertTriangle size={13} color="#ea580c" />
                            <span>Đã tự động loại trừ {duplicateShifts.length} ca trùng lặp (đã báo vắng):</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActionMode("restore")}
                            style={{
                              background: "#ffffff",
                              border: "1px solid #16a34a",
                              color: "#15803d",
                              borderRadius: 6,
                              padding: "2px 8px",
                              fontSize: 10.5,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <RotateCcw size={11} /> Khôi phục có mặt ({duplicateShifts.length} ca)
                          </button>
                        </div>
                        <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 80, overflowY: "auto" }}>
                          {duplicateShifts.map((s, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: s.attendance_status === "pending_absence" ? "#fef3c7" : "#fee2e2",
                                color: s.attendance_status === "pending_absence" ? "#92400e" : "#991b1b",
                                border: "1px solid",
                                borderColor: s.attendance_status === "pending_absence" ? "#fde68a" : "#fca5a5",
                                padding: "1px 5px",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              Ca {s.shift_id} ({s.work_date.slice(5).replace("-", "/")}) - {s.attendance_status === "pending_absence" ? "Chờ duyệt" : "Đã nghỉ"}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {affectedShifts.length === 0 && duplicateShifts.length === 0 && (
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                        ℹ️ Chưa tìm thấy ca phân công nào của nhân sự trong khoảng thời gian đã chọn.
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: 11, color: "#64748b", borderTop: "1px dashed #e2e8f0", paddingTop: 8 }}>
                  {isRestore
                    ? "💡 Sau khi xác nhận khôi phục, nhân sự sẽ được ghi nhận có mặt bình thường và bảo toàn đầy đủ giờ KPI của tuần."
                    : "💡 Quản lý sẽ nhận được thông báo để phê duyệt hoặc từ chối đơn này."}
                </div>
              </div>
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
            {isRestore ? (
              <button
                type="submit"
                disabled={loading || duplicateShifts.length === 0}
                className="btn btn-sm"
                style={{
                  fontWeight: 700,
                  padding: "8px 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: duplicateShifts.length === 0 ? "#cbd5e1" : "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  cursor: (loading || duplicateShifts.length === 0) ? "not-allowed" : "pointer",
                  opacity: duplicateShifts.length === 0 ? 0.7 : 1,
                }}
              >
                <RotateCcw size={15} />
                {loading
                  ? "Đang khôi phục..."
                  : duplicateShifts.length === 0
                  ? "Không có ca nào cần khôi phục"
                  : `✓ Xác Nhận Khôi Phục Có Mặt (${duplicateShifts.length} ca)`}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || allSelectedDuplicates}
                className={`btn btn-sm ${allSelectedDuplicates ? "btn-secondary" : "btn-danger"}`}
                style={{
                  fontWeight: 700,
                  padding: "8px 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: (loading || allSelectedDuplicates) ? "not-allowed" : "pointer",
                  opacity: allSelectedDuplicates ? 0.7 : 1,
                }}
              >
                {loading
                  ? "Đang gửi..."
                  : allSelectedDuplicates
                  ? "⚠️ Tất cả ca đã báo vắng (Trùng lặp)"
                  : `✓ Gửi Đơn Báo Vắng (${affectedShifts.length || finalDates.length * finalShiftIds.length} ca)`}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
