import React, { useState, useEffect, useCallback } from "react";
import { SHIFTS } from "../constants/shifts";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import {
  Clock, Send, Mail, CheckCircle2, AlertCircle, PlusCircle, Trash2,
  ChevronLeft, ChevronRight, LayoutGrid, CalendarRange, UserCheck,
  UserPlus, ArrowLeftRight, Hourglass, Check, X, ShieldAlert, Calendar, ArrowRight,
  Users, Plus, ChevronDown, ChevronUp, Sparkles, Tag, Eye, Info, UserX,
  Lock, AlertTriangle
} from "lucide-react";

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().split("T")[0];
}

function getDaysOfWeek(mondayStr) {
  const monday = new Date(mondayStr);
  const days = [];
  const dayNames = [
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
    "Chủ Nhật"
  ];
  const todayStr = new Date().toISOString().split("T")[0];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const displayDate = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    days.push({
      dayName: dayNames[i],
      dateStr,
      displayDate,
      isToday: dateStr === todayStr,
    });
  }
  return days;
}

export function SchedulePage() {
  const { user } = useAuth();
  const { fetchUnreadCount } = useNotifications();
  const isAdmin = user?.role === "admin";

  const [viewMode, setViewMode] = useState("week"); // 'week' | 'day' | 'my'
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [mondayDate, setMondayDate] = useState(() => getMonday(new Date()));
  const [weekDays, setWeekDays] = useState(() => getDaysOfWeek(getMonday(new Date())));

  const [schedule, setSchedule] = useState([]);
  const [events, setEvents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Expanded Day state & Table Scroll
  const [expandedDay, setExpandedDay] = useState(null);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const tableScrollRef = React.useRef(null);

  // Roster Modal: Shows all 13 members for a clicked shift
  const [rosterModal, setRosterModal] = useState({
    open: false,
    shift: null,
    day: null,
    rosterList: [],
    loading: false,
  });

  // Report Absence Modal: User enters reason to send to Manager
  const [reportAbsenceModal, setReportAbsenceModal] = useState({
    open: false,
    shiftId: 1,
    workDate: "",
    shiftName: "",
    shiftLabel: "",
    targetUser: null,
    reason: "",
    submitting: false,
  });

  // Event Modal (Xem toàn bộ sự kiện của ca)
  const [eventModal, setEventModal] = useState({
    open: false,
    shift: null,
    day: null,
    eventList: [],
  });

  // Create Event Modal
  const [createEventModal, setCreateEventModal] = useState({
    open: false,
    shift_id: 1,
    work_date: "",
    title: "",
    description: "",
    event_type: "general",
  });

  // Cancel Request Modal
  const [cancelModal, setCancelModal] = useState({
    open: false,
    registrationId: null,
    shiftId: null,
    shiftName: "",
    shiftLabel: "",
    workDate: "",
    reason: "",
    submitting: false,
  });

  // Change Request Modal
  const [changeModal, setChangeModal] = useState({
    open: false,
    registrationId: null,
    currentShiftId: null,
    currentShiftName: "",
    currentShiftLabel: "",
    currentWorkDate: "",
    targetShiftId: 1,
    targetWorkDate: "",
    reason: "",
    submitting: false,
  });

  // Reject Request Modal
  const [rejectModal, setRejectModal] = useState({
    open: false,
    registrationId: null,
    staffName: "",
    actionType: "",
    adminResponse: "",
    submitting: false,
  });

  const [actionMsg, setActionMsg] = useState({ text: "", type: "success" });

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "Quản lý đã xuất bản lịch làm việc cho tuần mới. Các bạn nhân viên vui lòng kiểm tra ca trực của mình và chuẩn bị đúng giờ."
  );
  const [sendEmail, setSendEmail] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    setWeekDays(getDaysOfWeek(mondayDate));
  }, [mondayDate]);

  const fetchPendingRequests = useCallback(async () => {
    try {
      const data = await api.getPendingShiftRequests();
      setPendingRequests(data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.getShiftEvents();
      setEvents(data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchPendingRequests();
    }
    fetchEvents();
  }, [isAdmin, fetchPendingRequests, fetchEvents]);

  const fetchSchedule = useCallback(async () => {
    try {
      let start, end;
      if (viewMode === "day") {
        start = currentDate;
        end = currentDate;
      } else {
        const days = getDaysOfWeek(mondayDate);
        start = days[0].dateStr;
        end = days[6].dateStr;
      }
      const [data, evData] = await Promise.all([
        api.getSchedule(start, end),
        api.getShiftEvents(),
      ]);
      setSchedule(data || []);
      setEvents(evData || []);
      if (isAdmin) {
        fetchPendingRequests();
      }
    } catch (err) {
      showToast("Lỗi khi tải dữ liệu: " + (err.message || ""), "danger");
    }
  }, [viewMode, currentDate, mondayDate, isAdmin, fetchPendingRequests]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const showToast = (text, type = "success") => {
    setActionMsg({ text, type });
    setTimeout(() => setActionMsg({ text: "", type: "success" }), 4000);
  };

  // Open Roster Modal (13 Members)
  const openRosterModal = async (shift, day) => {
    setRosterModal({
      open: true,
      shift,
      day,
      rosterList: [],
      loading: true,
    });
    try {
      const data = await api.getShiftRoster(shift.id, day.dateStr);
      setRosterModal({
        open: true,
        shift,
        day,
        rosterList: data || [],
        loading: false,
      });
    } catch (err) {
      showToast("Lỗi khi tải danh sách 13 thành viên: " + (err.message || ""), "danger");
      setRosterModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Report Absence Modal
  const openReportAbsence = (shift, day, targetUser = null) => {
    setReportAbsenceModal({
      open: true,
      shiftId: shift.id,
      workDate: day.dateStr,
      shiftName: shift.name,
      shiftLabel: shift.label,
      targetUser: targetUser || user,
      reason: "",
      submitting: false,
    });
  };

  // Handle Admin Approve or Reject Absence
  const handleApproveAbsence = async (shiftId, workDate, targetUserId, approved, staffName, note) => {
    try {
      const res = await api.approveAbsence({
        shift_id: shiftId,
        work_date: workDate,
        user_id: targetUserId,
        approved,
        note: note || (approved ? "Quản lý đã phê duyệt đơn nghỉ vắng" : "Quản lý từ chối đơn nghỉ vắng"),
      });
      showToast(res.message || (approved ? `Đã duyệt đơn xin vắng của ${staffName}!` : `Đã từ chối đơn xin vắng của ${staffName}.`));
      fetchSchedule();
      fetchPendingRequests();
      if (rosterModal.open && rosterModal.shift) {
        const data = await api.getShiftRoster(rosterModal.shift.id, rosterModal.day.dateStr);
        setRosterModal((prev) => ({ ...prev, rosterList: data || [] }));
      }
    } catch (err) {
      showToast("Lỗi khi xử lý phê duyệt vắng: " + (err.message || ""), "danger");
    }
  };

  // Submit Report Absence
  const handleReportAbsenceSubmit = async (e) => {
    e.preventDefault();
    if (!reportAbsenceModal.reason.trim()) {
      showToast("Vui lòng nhập lý do báo vắng!", "danger");
      return;
    }
    setReportAbsenceModal((prev) => ({ ...prev, submitting: true }));
    try {
      await api.reportAbsence({
        shift_id: reportAbsenceModal.shiftId,
        work_date: reportAbsenceModal.workDate,
        reason: reportAbsenceModal.reason.trim(),
        user_id: reportAbsenceModal.targetUser?.id || user?.id,
      });
      showToast("Đã nộp đơn báo vắng ca thành công! Vui lòng chờ Quản lý xem xét và phê duyệt.");
      setReportAbsenceModal({
        open: false,
        shiftId: 1,
        workDate: "",
        shiftName: "",
        shiftLabel: "",
        targetUser: null,
        reason: "",
        submitting: false,
      });
      fetchSchedule();
      if (rosterModal.open && rosterModal.shift) {
        const data = await api.getShiftRoster(rosterModal.shift.id, rosterModal.day.dateStr);
        setRosterModal((prev) => ({ ...prev, rosterList: data || [] }));
      }
    } catch (err) {
      showToast("Lỗi khi báo vắng: " + (err.message || ""), "danger");
      setReportAbsenceModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Cancel Absence (Confirm Present)
  const handleCancelAbsence = async (shiftId, workDate, targetUserId) => {
    try {
      await api.cancelAbsence({
        shift_id: shiftId,
        work_date: workDate,
        user_id: targetUserId,
      });
      showToast("Đã xác nhận có mặt trở lại ca trực!");
      fetchSchedule();
      if (rosterModal.open && rosterModal.shift) {
        const data = await api.getShiftRoster(rosterModal.shift.id, rosterModal.day.dateStr);
        setRosterModal((prev) => ({ ...prev, rosterList: data || [] }));
      }
    } catch (err) {
      showToast("Lỗi: " + (err.message || ""), "danger");
    }
  };

  // Open Event Modal
  const openEventModal = (shift, day, eventList) => {
    setEventModal({
      open: true,
      shift,
      day,
      eventList: eventList || [],
    });
  };

  // Open Create Event Modal (Hỗ trợ cả ngày hoặc theo ca, chỉ lấy hiện tại và tương lai)
  const openCreateEventModal = (shiftId = 0, workDate = "") => {
    const todayStr = new Date().toISOString().split("T")[0];
    let initialDate = workDate || mondayDate || todayStr;
    if (initialDate < todayStr) {
      initialDate = todayStr;
    }
    setCreateEventModal({
      open: true,
      shift_id: shiftId !== undefined && shiftId !== null ? shiftId : 0,
      work_date: initialDate,
      title: "",
      description: "",
      event_type: "meeting",
    });
  };

  // Handle Create Event Submit
  const handleCreateEventSubmit = async (e) => {
    e.preventDefault();
    if (!createEventModal.title.trim()) {
      showToast("Vui lòng nhập tên sự kiện!", "danger");
      return;
    }
    const todayStr = new Date().toISOString().split("T")[0];
    if (createEventModal.work_date && createEventModal.work_date < todayStr) {
      showToast("Không thể tạo sự kiện cho ngày trong quá khứ! Chỉ được chọn ngày hôm nay hoặc tương lai.", "danger");
      return;
    }
    try {
      await api.createShiftEvent({
        shift_id: createEventModal.shift_id,
        work_date: createEventModal.work_date || null,
        title: createEventModal.title.trim(),
        description: createEventModal.description?.trim() || "",
        event_type: createEventModal.event_type || "general",
      });
      showToast(
        createEventModal.shift_id === 0
          ? "Thêm sự kiện cả ngày thành công!"
          : "Thêm sự kiện cho ca làm việc thành công!"
      );
      setCreateEventModal({
        open: false,
        shift_id: 0,
        work_date: "",
        title: "",
        description: "",
        event_type: "meeting",
      });
      fetchEvents();
      if (eventModal.open) {
        setEventModal((prev) => ({ ...prev, open: false }));
      }
    } catch (err) {
      showToast("Lỗi khi tạo sự kiện: " + (err.message || ""), "danger");
    }
  };

  // Handle Delete Event
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa sự kiện này?")) return;
    try {
      await api.deleteShiftEvent(eventId);
      showToast("Đã xóa sự kiện thành công!");
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
      if (eventModal.open) {
        setEventModal((prev) => ({
          ...prev,
          eventList: prev.eventList.filter((ev) => ev.id !== eventId),
        }));
      }
    } catch (err) {
      showToast("Lỗi khi xóa sự kiện: " + (err.message || ""), "danger");
    }
  };

  // Handle Cancel Submit
  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelModal.reason.trim()) {
      showToast("Vui lòng nhập lý do xin hủy ca!", "danger");
      return;
    }
    setCancelModal((prev) => ({ ...prev, submitting: true }));
    try {
      await api.requestShiftCancel({
        registration_id: cancelModal.registrationId,
        shift_id: cancelModal.shiftId,
        work_date: cancelModal.workDate,
        reason: cancelModal.reason.trim(),
      });
      showToast("Đã gửi yêu cầu xin hủy ca! Vui lòng chờ Quản lý phê duyệt.");
      setCancelModal({
        open: false,
        registrationId: null,
        shiftId: null,
        shiftName: "",
        shiftLabel: "",
        workDate: "",
        reason: "",
        submitting: false,
      });
      fetchSchedule();
    } catch (err) {
      showToast("Lỗi khi gửi yêu cầu: " + (err.message || ""), "danger");
      setCancelModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Handle Change Submit
  const handleChangeSubmit = async (e) => {
    e.preventDefault();
    if (!changeModal.reason.trim()) {
      showToast("Vui lòng nhập lý do xin đổi ca!", "danger");
      return;
    }
    setChangeModal((prev) => ({ ...prev, submitting: true }));
    try {
      await api.requestShiftChange({
        registration_id: changeModal.registrationId,
        current_shift_id: changeModal.currentShiftId,
        current_work_date: changeModal.currentWorkDate,
        target_shift_id: Number(changeModal.targetShiftId),
        target_work_date: changeModal.targetWorkDate,
        reason: changeModal.reason.trim(),
      });
      showToast("Đã gửi yêu cầu xin đổi ca! Vui lòng chờ Quản lý phê duyệt.");
      setChangeModal({
        open: false,
        registrationId: null,
        currentShiftId: null,
        currentShiftName: "",
        currentShiftLabel: "",
        currentWorkDate: "",
        targetShiftId: 1,
        targetWorkDate: "",
        reason: "",
        submitting: false,
      });
      fetchSchedule();
    } catch (err) {
      showToast("Lỗi khi gửi yêu cầu: " + (err.message || ""), "danger");
      setChangeModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Handle Admin Approve
  const handleAdminApprove = async (regId, staffName, workDate) => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (workDate && workDate < todayStr) {
      showToast(`Ca làm việc ngày ${workDate} đã qua ngày. Yêu cầu này đã bị khóa duyệt, chỉ có thể chuyển sang từ chối!`, "danger");
      return;
    }
    try {
      await api.approveShiftRequest({
        registration_id: regId,
        action: "approve",
        admin_response: "Quản lý đã phê duyệt yêu cầu!",
      });
      showToast(`Đã duyệt thành công yêu cầu ca làm của ${staffName}!`);
      fetchSchedule();
      fetchPendingRequests();
    } catch (err) {
      showToast("Lỗi khi duyệt: " + (err.message || ""), "danger");
    }
  };

  // Handle Reject All Expired Requests
  const handleRejectAllExpired = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn chuyển toàn bộ các yêu cầu đã qua ngày sang trạng thái TỪ CHỐI không?")) {
      return;
    }
    try {
      const res = await api.rejectExpiredRequests();
      showToast(res.message || "Đã chuyển toàn bộ các yêu cầu quá hạn sang từ chối!");
      fetchSchedule();
      fetchPendingRequests();
    } catch (err) {
      showToast("Lỗi khi xử lý: " + (err.message || ""), "danger");
    }
  };

  // Open Reject Modal
  const openRejectModal = (req) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const isPast = req.work_date && req.work_date < todayStr;
    setRejectModal({
      open: true,
      registrationId: req.id,
      staffName: req.full_name,
      actionType: req.status === "pending_cancel" ? "hủy ca" : "đổi ca",
      adminResponse: isPast ? "Hệ thống / Quản lý từ chối do quá hạn duyệt (đã qua ngày ca làm việc)" : "",
      submitting: false,
    });
  };

  // Handle Reject Submit
  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectModal.adminResponse.trim()) {
      showToast("Vui lòng nhập lý do từ chối!", "danger");
      return;
    }
    setRejectModal((prev) => ({ ...prev, submitting: true }));
    try {
      await api.approveShiftRequest({
        registration_id: rejectModal.registrationId,
        action: "reject",
        admin_response: rejectModal.adminResponse.trim(),
      });
      showToast(`Đã từ chối yêu cầu của ${rejectModal.staffName}.`);
      setRejectModal({
        open: false,
        registrationId: null,
        staffName: "",
        actionType: "",
        adminResponse: "",
        submitting: false,
      });
      fetchSchedule();
      fetchPendingRequests();
    } catch (err) {
      showToast("Lỗi khi từ chối: " + (err.message || ""), "danger");
      setRejectModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Handle Publish Schedule
  const handlePublishSchedule = async () => {
    setPublishing(true);
    try {
      const res = await api.publishSchedule(
        mondayDate,
        true,
        announcement
      );
      showToast(
        `Xuất bản lịch thành công! Đã gửi ${res.emails_sent || 0} email thông báo đến nhân sự.`
      );
      setShowPublishModal(false);
    } catch (err) {
      showToast("Lỗi khi xuất bản: " + (err.message || ""), "danger");
    } finally {
      setPublishing(false);
    }
  };

  const handleWeekChange = (weeks) => {
    const d = new Date(mondayDate);
    d.setDate(d.getDate() + weeks * 7);
    setMondayDate(d.toISOString().split("T")[0]);
  };

  const handleDayChange = (days) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  const toggleExpandDay = (dateStr) => {
    setExpandedDay((prev) => (prev === dateStr ? null : dateStr));
    setTimeout(() => {
      const colElem = document.getElementById(`day-col-${dateStr}`);
      if (colElem && tableScrollRef.current) {
        const leftPos = colElem.offsetLeft - 150;
        tableScrollRef.current.scrollTo({ left: Math.max(0, leftPos), behavior: "smooth" });
      }
    }, 60);
  };

  const scrollTable = (direction) => {
    if (tableScrollRef.current) {
      const offset = direction === "right" ? 340 : -340;
      tableScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const myShiftsInWeek = schedule.filter((s) => s.user_id === user?.id);
  const totalHours = myShiftsInWeek.reduce(
    (acc, curr) => acc + (curr.shift_id === 8 ? 0.5 : 1.5),
    0
  );

  const getEventTypeBadge = (type) => {
    switch (type) {
      case "meeting":
        return { icon: "📌", label: "Họp", bg: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" };
      case "maintenance":
        return { icon: "🔧", label: "Bảo trì", bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
      case "task":
        return { icon: "⚡", label: "Tác vụ", bg: "#ecfdf5", border: "#a7f3d0", color: "#047857" };
      case "handover":
        return { icon: "📋", label: "Bàn giao", bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" };
      default:
        return { icon: "📢", label: "Sự kiện", bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" };
    }
  };

  return (
    <div
      style={{
        maxWidth: isFullWidth ? "100%" : 1440,
        margin: "0 auto",
        padding: isFullWidth ? "20px 16px" : "24px 20px",
        transition: "max-width 0.25s ease",
      }}
    >
      {actionMsg.text && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: actionMsg.type === "danger" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: 12,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 600,
            fontSize: 14,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {actionMsg.type === "danger" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {actionMsg.text}
        </div>
      )}

      {/* HEADER SECTION */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.5px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>Quản Lý & Phân Bổ Ca Làm Việc (9 Ca)</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 20,
                background: "#dbeafe",
                color: "#1d4ed8",
              }}
            >
              Đội Ngũ 13 Thành Viên
            </span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Ô ca hiển thị gọn <strong>13 người</strong> (nhấn vào để xem đầy đủ ai có mặt, ai vắng
            mặt kèm lý do). Nhân viên vắng phải báo vắng kèm lý do cho Quản lý.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isAdmin && pendingRequests.length > 0 && (
            <button
              onClick={() => setShowPendingModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                padding: "8px 16px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(220, 38, 38, 0.1)",
              }}
            >
              <ShieldAlert size={16} />
              <span>Chờ Duyệt ({pendingRequests.length})</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => openCreateEventModal(0, mondayDate)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#f3e8ff",
                border: "1px solid #d8b4fe",
                color: "#7e22ce",
                padding: "8px 16px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(126, 34, 206, 0.1)",
              }}
              title="Tạo sự kiện chung cho cả ngày hoặc cho ca cụ thể"
            >
              <Plus size={16} />
              <span>+ Thêm Sự Kiện (Ngày / Ca)</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setShowPublishModal(true)}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Send size={16} />
              <span>Xuất Bản Lịch & Gửi Mail</span>
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY STATS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div className="card" style={{ padding: 16, borderLeft: "4px solid #3b82f6" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            Quy chuẩn đội ngũ
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1e293b", marginTop: 4 }}>
            13 <span style={{ fontSize: 14, fontWeight: 500 }}>thành viên cố định</span>
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: "4px solid #10b981" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            Ca trực của bạn tuần này
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#10b981", marginTop: 4 }}>
            {myShiftsInWeek.length}{" "}
            <span style={{ fontSize: 14, fontWeight: 500 }}>ca ({totalHours} giờ)</span>
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: "4px solid #8b5cf6" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            Sự kiện các ca trực
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#8b5cf6", marginTop: 4 }}>
            {events.length} <span style={{ fontSize: 14, fontWeight: 500 }}>sự kiện</span>
          </div>
        </div>

        <div className="card" style={{ padding: 16, borderLeft: "4px solid #f59e0b" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            Cơ chế Điểm danh & Báo vắng
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#b45309", marginTop: 6 }}>
            Bấm <strong>13 người</strong> để xem • Báo vắng kèm lý do
          </div>
        </div>
      </div>

      {/* NAVIGATION BAR & VIEW SWITCHER */}
      <div
        className="card"
        style={{
          padding: "12px 16px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setViewMode("week")}
            className={`btn ${viewMode === "week" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <LayoutGrid size={15} />
            Lịch 1 Tuần (9 Ca)
          </button>
          <button
            onClick={() => setViewMode("day")}
            className={`btn ${viewMode === "day" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <CalendarRange size={15} />
            Chi Tiết Theo 1 Ngày
          </button>
          <button
            onClick={() => setViewMode("my")}
            className={`btn ${viewMode === "my" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <UserCheck size={15} />
            Ca Trực Của Tôi ({myShiftsInWeek.length})
          </button>
        </div>

        {/* Date Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {viewMode === "week" && (
            <>
              <button
                onClick={() => handleWeekChange(-1)}
                className="btn btn-secondary btn-sm"
                title="Tuần trước"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontWeight: 700, fontSize: 14, minWidth: 170, textAlign: "center" }}>
                Tuần: {weekDays[0]?.displayDate} - {weekDays[6]?.displayDate}/2026
              </span>
              <button
                onClick={() => handleWeekChange(1)}
                className="btn btn-secondary btn-sm"
                title="Tuần sau"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setMondayDate(getMonday(new Date()))}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12 }}
              >
                Tuần này
              </button>
            </>
          )}

          {viewMode === "day" && (
            <>
              <button
                onClick={() => handleDayChange(-1)}
                className="btn btn-secondary btn-sm"
                title="Ngày trước"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 13,
                  fontWeight: 600,
                  background: "#ffffff",
                  color: "#0f172a",
                }}
              />
              <button
                onClick={() => handleDayChange(1)}
                className="btn btn-secondary btn-sm"
                title="Ngày sau"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date().toISOString().split("T")[0])}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12 }}
              >
                Hôm nay
              </button>
            </>
          )}
        </div>
      </div>

      {/* QUICK DAY JUMP BUTTONS & HORIZONTAL SCROLL CONTROLS */}
      {viewMode === "week" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            background: "#ffffff",
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            marginBottom: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: 4 }}>
              👉 Bấm Thứ để mở rộng & kéo sang phải:
            </span>
            {weekDays.map((d) => {
              const isExpanded = expandedDay === d.dateStr;
              return (
                <button
                  key={d.dateStr}
                  onClick={() => toggleExpandDay(d.dateStr)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    border: isExpanded ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    background: isExpanded ? "#2563eb" : d.isToday ? "#eff6ff" : "#ffffff",
                    color: isExpanded ? "#ffffff" : d.isToday ? "#1d4ed8" : "#334155",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: isExpanded ? "0 4px 10px rgba(37, 99, 235, 0.25)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>
                    {d.dayName} {d.displayDate}
                  </span>
                  {d.isToday && (
                    <span
                      style={{
                        fontSize: 10,
                        background: isExpanded ? "#1d4ed8" : "#2563eb",
                        color: "#fff",
                        padding: "1px 6px",
                        borderRadius: 10,
                      }}
                    >
                      Nay
                    </span>
                  )}
                  {isExpanded && <span style={{ fontSize: 11 }}>✦ Mở rộng</span>}
                </button>
              );
            })}
            {expandedDay && (
              <button
                onClick={() => setExpandedDay(null)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                ✕ Thu gọn tất cả
              </button>
            )}
          </div>

          {/* Quick Scroll & Full Width controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => scrollTable("left")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
              }}
              title="Cuộn bảng sang trái"
            >
              <ChevronLeft size={16} /> Sang trái
            </button>
            <button
              onClick={() => scrollTable("right")}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 600,
                color: "#475569",
              }}
              title="Kéo cuộn bảng sang phải"
            >
              Sang phải <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setIsFullWidth(!isFullWidth)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                background: isFullWidth ? "#eff6ff" : "#f8fafc",
                border: isFullWidth ? "1.5px solid #3b82f6" : "1px solid #cbd5e1",
                color: isFullWidth ? "#1d4ed8" : "#475569",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
              }}
              title="Chuyển đổi chế độ bảng mở rộng tràn viền để xem đầy đủ nhất"
            >
              {isFullWidth ? "⤡ Vừa màn hình" : "⤢ Toàn màn hình"}
            </button>
          </div>
        </div>
      )}

      {/* ================= VIEW 1: LỊCH 1 TUẦN TỔNG THỂ (9 CA MATRIX) ================= */}
      {viewMode === "week" && (
        <div
          className="card"
          style={{ padding: 0, overflow: "hidden", border: "1px solid #e2e8f0" }}
        >
          <div
            ref={tableScrollRef}
            style={{
              overflowX: "auto",
              scrollBehavior: "smooth",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: expandedDay ? 1720 : 1520,
                borderCollapse: "separate",
                borderSpacing: 0,
                textAlign: "left",
                transition: "min-width 0.25s ease",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                  <th
                    style={{
                      padding: "14px 12px",
                      width: 140,
                      minWidth: 140,
                      maxWidth: 140,
                      fontWeight: 800,
                      fontSize: 12,
                      color: "#475569",
                      textTransform: "uppercase",
                      position: "sticky",
                      left: 0,
                      zIndex: 20,
                      background: "#f1f5f9",
                      borderRight: "2px solid #cbd5e1",
                      borderBottom: "2px solid #cbd5e1",
                      boxShadow: "2px 0 6px rgba(0,0,0,0.06)",
                    }}
                  >
                    Ca Làm Việc (9 Ca)
                  </th>
                  {weekDays.map((day) => {
                    const isExpanded = expandedDay === day.dateStr;
                    return (
                      <th
                        id={`day-col-${day.dateStr}`}
                        key={day.dateStr}
                        onClick={() => toggleExpandDay(day.dateStr)}
                        style={{
                          padding: "12px 10px",
                          textAlign: "center",
                          width: isExpanded ? 330 : 190,
                          minWidth: isExpanded ? 330 : 190,
                          background: isExpanded
                            ? "#eff6ff"
                            : day.isToday
                              ? "#eff6ff"
                              : "#f8fafc",
                          borderLeft: isExpanded ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                          borderRight: isExpanded ? "2px solid #3b82f6" : "none",
                          borderBottom: isExpanded ? "3px solid #2563eb" : "2px solid #e2e8f0",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          userSelect: "none",
                        }}
                        title="👉 Bấm để mở rộng & kéo sang phải xem chi tiết ngày này"
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: isExpanded ? "#1d4ed8" : day.isToday ? "#2563eb" : "#1e293b",
                            }}
                          >
                            {day.dayName}
                          </span>
                          <Calendar
                            size={13}
                            color={isExpanded || day.isToday ? "#2563eb" : "#94a3b8"}
                          />
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: isExpanded ? "#1d4ed8" : day.isToday ? "#3b82f6" : "var(--text-muted)",
                            marginTop: 2,
                            fontWeight: 600,
                          }}
                        >
                          {day.displayDate} {day.isToday && "(Hôm nay)"}
                        </div>
                        <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 10,
                              background: isExpanded ? "#2563eb" : "#e2e8f0",
                              color: isExpanded ? "#ffffff" : "#334155",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            {isExpanded ? "✦ Đang mở rộng" : "▼ Mở rộng"}
                          </span>
                          {isAdmin && (day.dateStr >= new Date().toISOString().split("T")[0]) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openCreateEventModal(0, day.dateStr);
                              }}
                              style={{
                                fontSize: 9,
                                background: "#f3e8ff",
                                border: "1px solid #d8b4fe",
                                color: "#7e22ce",
                                borderRadius: 6,
                                padding: "2px 6px",
                                cursor: "pointer",
                                fontWeight: 700,
                              }}
                              title="Tạo sự kiện riêng cho ngày này"
                            >
                              + Sự kiện
                            </button>
                          )}
                        </div>
                        {(() => {
                          const allDayEvents = events.filter(
                            (e) => (!e.shift_id || e.shift_id === 0) && (!e.work_date || e.work_date === day.dateStr)
                          );
                          if (allDayEvents.length === 0) return null;
                          return (
                            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                              {allDayEvents.map((ev) => (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEventModal(null, day, [ev]);
                                  }}
                                  style={{
                                    background: "linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%)",
                                    border: "1px solid #c084fc",
                                    borderRadius: 6,
                                    padding: "3px 6px",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#6b21a8",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 4,
                                    cursor: "pointer",
                                    boxShadow: "0 1px 3px rgba(126, 34, 206, 0.08)",
                                  }}
                                  title={`Sự kiện cả ngày: ${ev.title}${ev.description ? ` - ${ev.description}` : ""}`}
                                >
                                  <Sparkles size={11} color="#9333ea" />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: isExpanded ? 260 : 150 }}>
                                    {ev.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {SHIFTS.map((shift) => (
                  <tr key={shift.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    {/* Shift Label Column (Sticky Left) */}
                    <td
                      style={{
                        padding: "12px 10px",
                        verticalAlign: "top",
                        width: 140,
                        minWidth: 140,
                        maxWidth: 140,
                        position: "sticky",
                        left: 0,
                        zIndex: 10,
                        background: "#fafafa",
                        borderRight: "2px solid #cbd5e1",
                        borderBottom: "1px solid #e2e8f0",
                        boxShadow: "2px 0 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a" }}>
                        {shift.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#2563eb",
                          marginTop: 3,
                          background: "#eff6ff",
                          padding: "2px 6px",
                          borderRadius: 4,
                          display: "inline-block",
                        }}
                      >
                        {shift.label}
                      </div>
                      {shift.description && (
                        <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                          {shift.description}
                        </div>
                      )}
                    </td>

                    {/* 7 Days Columns for this Shift */}
                    {weekDays.map((day) => {
                      const isExpanded = expandedDay === day.dateStr;
                      const absentInSlot = schedule.filter(
                        (s) =>
                          s.shift_id === shift.id &&
                          s.work_date === day.dateStr &&
                          s.attendance_status === "absent"
                      );
                      const pendingInSlot = schedule.filter(
                        (s) =>
                          s.shift_id === shift.id &&
                          s.work_date === day.dateStr &&
                          s.attendance_status === "pending_absence"
                      );
                      const hasAbsence = absentInSlot.length > 0;
                      const hasPending = pendingInSlot.length > 0;
                      const eventsInThisSlot = events.filter(
                        (e) =>
                          (!e.shift_id || e.shift_id === 0 || e.shift_id === shift.id) &&
                          (!e.work_date || e.work_date === day.dateStr)
                      );

                      return (
                        <td
                          key={day.dateStr}
                          style={{
                            padding: isExpanded ? "10px 12px" : "8px",
                            verticalAlign: "top",
                            width: isExpanded ? 330 : 190,
                            minWidth: isExpanded ? 330 : 190,
                            borderLeft: isExpanded ? "2px solid #60a5fa" : "1px solid #f1f5f9",
                            borderRight: isExpanded ? "2px solid #60a5fa" : "none",
                            borderBottom: "1px solid #e2e8f0",
                            background: isExpanded
                              ? "#f0f7ff"
                              : day.isToday
                                ? "#fcfdff"
                                : "#ffffff",
                            minHeight: 110,
                            position: "relative",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {/* ================= PHẦN TRÊN: 13 NGƯỜI (GỌN GÀNG, NHẤN ĐỂ MỞ) ================= */}
                            <div>
                              <div
                                onClick={() => openRosterModal(shift, day)}
                                style={{
                                  padding: "7px 10px",
                                  borderRadius: 8,
                                  background: hasAbsence ? "#fff1f2" : "#f1f5f9",
                                  border: hasAbsence
                                    ? "1.5px solid #fda4af"
                                    : "1px solid #cbd5e1",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) =>
                                (e.currentTarget.style.background = hasAbsence
                                  ? "#fee2e2"
                                  : "#e2e8f0")
                                }
                                onMouseLeave={(e) =>
                                (e.currentTarget.style.background = hasAbsence
                                  ? "#fff1f2"
                                  : "#f1f5f9")
                                }
                                title="Bấm để xem đầy đủ danh sách 13 thành viên (ai có mặt, ai vắng mặt)"
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                                  <Users
                                    size={14}
                                    color={hasAbsence ? "#e11d48" : hasPending ? "#d97706" : "#2563eb"}
                                  />
                                  <span
                                    style={{
                                      fontWeight: 800,
                                      fontSize: 11,
                                      color: hasAbsence ? "#9f1239" : hasPending ? "#92400e" : "#1e293b",
                                    }}
                                  >
                                    13 người
                                  </span>
                                  {hasAbsence && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 800,
                                        background: "#ef4444",
                                        color: "#ffffff",
                                        padding: "1px 5px",
                                        borderRadius: 10,
                                      }}
                                    >
                                      🔴 {absentInSlot.length} vắng
                                    </span>
                                  )}
                                  {hasPending && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 800,
                                        background: "#f59e0b",
                                        color: "#ffffff",
                                        padding: "1px 5px",
                                        borderRadius: 10,
                                      }}
                                    >
                                      🟡 {pendingInSlot.length} chờ duyệt
                                    </span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => openReportAbsence(shift, day)}
                                    style={{
                                      background: "#fee2e2",
                                      border: "1px solid #fca5a5",
                                      borderRadius: 4,
                                      padding: "1px 5px",
                                      fontSize: 9,
                                      fontWeight: 700,
                                      color: "#b91c1c",
                                      cursor: "pointer",
                                    }}
                                    title="Báo vắng ca này kèm lý do cho Quản lý"
                                  >
                                    Báo vắng
                                  </button>
                                  <span
                                    onClick={() => openRosterModal(shift, day)}
                                    style={{
                                      fontSize: 9,
                                      color: hasAbsence ? "#e11d48" : "#2563eb",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Xem ↗
                                  </span>
                                </div>
                              </div>

                              {/* Hiển thị chi tiết ai vắng mặt ngay trong cột khi mở rộng */}
                              {isExpanded && absentInSlot.length > 0 && (
                                <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3, borderTop: "1px dashed #fda4af", paddingTop: 4 }}>
                                  {absentInSlot.map((a) => (
                                    <div
                                      key={a.id}
                                      style={{
                                        fontSize: 10,
                                        color: "#b91c1c",
                                        background: "#fee2e2",
                                        padding: "2px 6px",
                                        borderRadius: 4,
                                        fontWeight: 600,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 4,
                                      }}
                                    >
                                      <span>🔴 {a.full_name || a.username}</span>
                                      <span style={{ fontSize: 9, fontStyle: "italic", opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
                                        {a.absence_reason || "Vắng mặt"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* ================= PHẦN DƯỚI: 📅 SỰ KIỆN TRONG CA ================= */}
                            <div style={{ borderTop: "1px dashed #cbd5e1", paddingTop: 5, marginTop: 2 }}>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEventModal(shift, day, eventsInThisSlot);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  fontSize: 10,
                                  fontWeight: 800,
                                  color: "#64748b",
                                  marginBottom: 4,
                                  cursor: "pointer",
                                  userSelect: "none",
                                }}
                                title="Bấm để xem chi tiết hoặc thêm sự kiện"
                              >
                                <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <Calendar size={11} color="#8b5cf6" /> SỰ KIỆN ({eventsInThisSlot.length})
                                </span>
                                {isAdmin && (day.dateStr >= new Date().toISOString().split("T")[0]) && (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openCreateEventModal(shift.id, day.dateStr);
                                    }}
                                    style={{
                                      fontSize: 9,
                                      color: "#8b5cf6",
                                      fontWeight: 800,
                                      cursor: "pointer",
                                    }}
                                    title="Thêm sự kiện mới"
                                  >
                                    + Thêm
                                  </span>
                                )}
                              </div>

                              {/* DIRECT DISPLAY OF EVENT NAMES */}
                              {eventsInThisSlot.length === 0 ? (
                                <div
                                  onClick={() =>
                                    isAdmin && (day.dateStr >= new Date().toISOString().split("T")[0]) && openCreateEventModal(shift.id, day.dateStr)
                                  }
                                  style={{
                                    fontSize: 10,
                                    color: "#94a3b8",
                                    fontStyle: "italic",
                                    padding: "2px 4px",
                                    cursor: isAdmin && (day.dateStr >= new Date().toISOString().split("T")[0]) ? "pointer" : "default",
                                  }}
                                >
                                  {isAdmin && (day.dateStr >= new Date().toISOString().split("T")[0]) ? "+ Thêm sự kiện" : "Không có sự kiện"}
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                  {eventsInThisSlot.map((ev) => {
                                    const badge = getEventTypeBadge(ev.event_type);
                                    return (
                                      <div
                                        key={ev.id}
                                        onClick={() => openEventModal(shift, day, eventsInThisSlot)}
                                        style={{
                                          display: "flex",
                                          flexDirection: isExpanded ? "column" : "row",
                                          alignItems: isExpanded ? "flex-start" : "center",
                                          gap: 3,
                                          padding: isExpanded ? "4px 7px" : "3px 6px",
                                          borderRadius: 4,
                                          background: badge.bg,
                                          border: `1px solid ${badge.border}`,
                                          color: badge.color,
                                          fontSize: 10,
                                          fontWeight: 600,
                                          cursor: "pointer",
                                        }}
                                        title={`${ev.title}${ev.description ? ` - ${ev.description}` : ""
                                          }`}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
                                          <span style={{ fontSize: 9 }}>{badge.icon}</span>
                                          {(!ev.shift_id || ev.shift_id === 0) && (
                                            <span style={{ fontSize: 8, fontWeight: 800, padding: "1px 4px", borderRadius: 3, background: "#7e22ce", color: "#fff", flexShrink: 0 }}>
                                              CẢ NGÀY
                                            </span>
                                          )}
                                          <span
                                            style={{
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: isExpanded ? "normal" : "nowrap",
                                              flex: 1,
                                            }}
                                          >
                                            {ev.title}
                                          </span>
                                        </div>
                                        {isExpanded && ev.description && (
                                          <div
                                            style={{
                                              fontSize: 9,
                                              color: "#475569",
                                              paddingLeft: 14,
                                              lineHeight: 1.2,
                                              opacity: 0.9,
                                            }}
                                          >
                                            {ev.description}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: CHI TIẾT THEO 1 NGÀY CỤ THỂ ================= */}
      {viewMode === "day" && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              background: "#ffffff",
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#1e293b" }}>
                Chi Tiết 9 Ca Làm Việc Ngày: {currentDate}
              </h2>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Xem danh sách 13 thành viên trong từng ca trực, ai vắng mặt sẽ hiện màu đỏ kèm lý do.
              </span>
            </div>
            <button
              onClick={() => setViewMode("week")}
              className="btn btn-secondary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <ArrowLeftRight size={14} /> Quay về Lịch 1 Tuần
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SHIFTS.map((shift) => {
              const dayObj = { dateStr: currentDate, displayDate: currentDate, dayName: "Hôm nay" };
              const absentInShift = schedule.filter(
                (s) =>
                  s.shift_id === shift.id &&
                  s.work_date === currentDate &&
                  s.attendance_status === "absent"
              );
              const eventsInShift = events.filter(
                (e) =>
                  e.shift_id === shift.id && (!e.work_date || e.work_date === currentDate)
              );

              return (
                <div
                  key={shift.id}
                  className="card"
                  style={{
                    padding: 16,
                    borderLeft: absentInShift.length > 0 ? "4px solid #ef4444" : "4px solid #3b82f6",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12,
                      borderBottom: "1px solid #f1f5f9",
                      paddingBottom: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                          {shift.name}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "#eff6ff",
                            color: "#2563eb",
                          }}
                        >
                          <Clock size={12} style={{ display: "inline", marginRight: 4 }} />
                          {shift.label}
                        </span>
                      </div>
                      {shift.description && (
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                          {shift.description}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => openReportAbsence(shift, dayObj)}
                        style={{
                          background: "#fee2e2",
                          border: "1px solid #fca5a5",
                          color: "#b91c1c",
                          borderRadius: 6,
                          padding: "6px 12px",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Báo Vắng Ca Này
                      </button>
                      <button
                        onClick={() => openRosterModal(shift, dayObj)}
                        className="btn btn-primary btn-sm"
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <Users size={14} /> Xem 13 Người (Điểm danh)
                      </button>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>
                      👥 Đội ngũ: <strong>13 người</strong> •{" "}
                      {absentInShift.length > 0 ? (
                        <span style={{ color: "#dc2626", fontWeight: 700 }}>
                          🔴 {absentInShift.length} người vắng mặt
                        </span>
                      ) : (
                        <span style={{ color: "#16a34a", fontWeight: 700 }}>
                          🟢 Đủ 13 người có mặt
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      📅 {eventsInShift.length} sự kiện trong ca
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= VIEW 3: CA TRỰC CỦA TÔI ================= */}
      {viewMode === "my" && (
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            Danh Sách Ca Làm Của Bạn Trong Tuần ({weekDays[0]?.displayDate} -{" "}
            {weekDays[6]?.displayDate})
          </h2>

          {myShiftsInWeek.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)" }}>
              <Clock size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <p>Bạn chưa có lịch ca trực nào được ghi nhận trong tuần này.</p>
              <button
                onClick={() => setViewMode("week")}
                className="btn btn-primary"
                style={{ marginTop: 12 }}
              >
                Vào Bảng Lịch Tuần
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myShiftsInWeek.map((shift) => {
                const isAbsent = shift.attendance_status === "absent";
                return (
                  <div
                    key={shift.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 14,
                      borderRadius: 10,
                      background: isAbsent ? "#fef2f2" : "#f8fafc",
                      border: isAbsent ? "1.5px solid #ef4444" : "1px solid #e2e8f0",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: isAbsent ? "#991b1b" : "#0f172a",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <span>
                          {shift.shift_name} ({shift.shift_label})
                        </span>
                        {isAbsent ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              background: "#ef4444",
                              color: "#fff",
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            🔴 VẮNG MẶT
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              background: "#dcfce7",
                              color: "#166534",
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            🟢 Có mặt
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        Ngày làm: <strong>{shift.work_date}</strong> • Ghi chú:{" "}
                        {shift.note || "Không có"}
                      </div>
                      {isAbsent && shift.absence_reason && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#991b1b",
                            fontStyle: "italic",
                            marginTop: 3,
                          }}
                        >
                          Lý do báo vắng: "{shift.absence_reason}"
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isAbsent ? (
                        <button
                          onClick={() => handleCancelAbsence(shift.shift_id, shift.work_date, user?.id)}
                          className="btn btn-primary btn-sm"
                        >
                          Xác Nhận Có Mặt Lại
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            openReportAbsence(
                              { id: shift.shift_id, name: shift.shift_name, label: shift.shift_label },
                              { dateStr: shift.work_date }
                            )
                          }
                          style={{
                            background: "#fee2e2",
                            border: "1px solid #fca5a5",
                            color: "#b91c1c",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Báo Vắng Ca
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: DANH SÁCH TOÀN BỘ 13 NGƯỜI & ĐIỂM DANH (ROSTER MODAL) ================= */}
      {rosterModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 620,
              width: "100%",
              padding: 24,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#0f172a" }}>
                  Danh Sách 13 Thành Viên Ca Trực
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {rosterModal.shift?.name} ({rosterModal.shift?.label}) • Ngày:{" "}
                  {rosterModal.day?.dateStr}
                </div>
              </div>
              <button
                onClick={() =>
                  setRosterModal({ open: false, shift: null, day: null, rosterList: [], loading: false })
                }
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Notification guideline */}
            <div
              style={{
                background: "#eff6ff",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12,
                color: "#1e40af",
                marginBottom: 16,
              }}
            >
              💡 <strong>Quy chuẩn:</strong> Ca trực bao gồm đầy đủ <strong>13 thành viên</strong>.
              Thành viên nào <strong>Vắng mặt</strong> sẽ hiển thị{" "}
              <span style={{ color: "#dc2626", fontWeight: 800 }}>MÀU ĐỎ</span> kèm lý do đã báo cho
              Quản lý.
            </div>

            {/* List of 13 members */}
            {rosterModal.loading ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b" }}>
                Đang tải danh sách 13 thành viên...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rosterModal.rosterList.map((m, idx) => {
                  const isMe = m.user_id === user?.id;
                  const isPending = m.attendance_status === "pending_absence";
                  const isAbsent = m.attendance_status === "absent";
                  const isPresent = !isPending && !isAbsent;

                  let cardBg = "#f8fafc";
                  let cardBorder = "1px solid #e2e8f0";
                  let cardShadow = "none";
                  let avatarBg = "#dbeafe";
                  let avatarColor = "#1d4ed8";

                  if (isPending) {
                    cardBg = "#fffbeb";
                    cardBorder = "1.5px solid #f59e0b";
                    cardShadow = "0 3px 10px rgba(245, 158, 11, 0.15)";
                    avatarBg = "#fef3c7";
                    avatarColor = "#b45309";
                  } else if (isAbsent) {
                    cardBg = "#fef2f2";
                    cardBorder = "1.5px solid #ef4444";
                    cardShadow = "0 3px 10px rgba(239, 68, 68, 0.15)";
                    avatarBg = "#fee2e2";
                    avatarColor = "#dc2626";
                  }

                  return (
                    <div
                      key={m.user_id}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: cardBg,
                        border: cardBorder,
                        boxShadow: cardShadow,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: avatarBg,
                              color: avatarColor,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 800,
                              fontSize: 13,
                            }}
                          >
                            {idx + 1}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: isAbsent ? "#991b1b" : isPending ? "#92400e" : "#0f172a",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <span>
                                {m.full_name} {isMe && "(Tôi)"}
                              </span>
                              {isPending && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    background: "#f59e0b",
                                    color: "#ffffff",
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                  }}
                                >
                                  🟡 ĐƠN CHỜ QUẢN LÝ DUYỆT
                                </span>
                              )}
                              {isAbsent && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    background: "#ef4444",
                                    color: "#ffffff",
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                  }}
                                >
                                  🔴 VẮNG MẶT (QUẢN LÝ ĐÃ DUYỆT)
                                </span>
                              )}
                              {isPresent && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    background: "#dcfce7",
                                    color: "#166534",
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                  }}
                                >
                                  🟢 Có mặt
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              {m.department || "Nhân viên"} • {m.phone || m.email}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons based on Role */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* 1. If Staff is current logged-in user and PRESENT -> button to report absence */}
                          {isMe && isPresent && (
                            <button
                              onClick={() =>
                                openReportAbsence(rosterModal.shift, rosterModal.day, m)
                              }
                              style={{
                                background: "#fee2e2",
                                border: "1px solid #fca5a5",
                                color: "#b91c1c",
                                borderRadius: 6,
                                padding: "6px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              📝 Báo vắng ca này
                            </button>
                          )}

                          {/* 2. If Staff has PENDING request */}
                          {isPending && (
                            <>
                              {/* Manager: Approve or Reject buttons */}
                              {isAdmin && (
                                <div style={{ display: "flex", gap: 6 }}>
                                  <button
                                    onClick={() =>
                                      handleApproveAbsence(
                                        rosterModal.shift.id,
                                        rosterModal.day.dateStr,
                                        m.user_id,
                                        true,
                                        m.full_name
                                      )
                                    }
                                    style={{
                                      background: "#10b981",
                                      border: "none",
                                      color: "#ffffff",
                                      borderRadius: 6,
                                      padding: "5px 12px",
                                      fontSize: 11,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                      boxShadow: "0 2px 4px rgba(16, 185, 129, 0.3)",
                                    }}
                                  >
                                    ✓ Phê Duyệt Cho Vắng
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleApproveAbsence(
                                        rosterModal.shift.id,
                                        rosterModal.day.dateStr,
                                        m.user_id,
                                        false,
                                        m.full_name
                                      )
                                    }
                                    style={{
                                      background: "#ffffff",
                                      border: "1.5px solid #ef4444",
                                      color: "#ef4444",
                                      borderRadius: 6,
                                      padding: "5px 10px",
                                      fontSize: 11,
                                      fontWeight: 800,
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✕ Từ Chối
                                  </button>
                                </div>
                              )}

                              {/* Staff themselves: Cancel their request */}
                              {isMe && !isAdmin && (
                                <button
                                  onClick={() =>
                                    handleCancelAbsence(
                                      rosterModal.shift.id,
                                      rosterModal.day.dateStr,
                                      m.user_id
                                    )
                                  }
                                  style={{
                                    background: "#f1f5f9",
                                    border: "1px solid #cbd5e1",
                                    color: "#475569",
                                    borderRadius: 6,
                                    padding: "5px 12px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  ✕ Hủy Yêu Cầu Xin Vắng
                                </button>
                              )}

                              {!isAdmin && !isMe && (
                                <span style={{ fontSize: 11, color: "#b45309", fontStyle: "italic", fontWeight: 600 }}>
                                  (Đang chờ duyệt)
                                </span>
                              )}
                            </>
                          )}

                          {/* 3. If ABSENT (Manager approved) */}
                          {isAbsent && (
                            <>
                              {/* Manager can restore presence */}
                              {isAdmin && (
                                <button
                                  onClick={() =>
                                    handleCancelAbsence(
                                      rosterModal.shift.id,
                                      rosterModal.day.dateStr,
                                      m.user_id
                                    )
                                  }
                                  style={{
                                    background: "#dcfce7",
                                    border: "1px solid #86efac",
                                    color: "#166534",
                                    borderRadius: 6,
                                    padding: "5px 12px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  🔄 Khôi phục Có mặt
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Display Pending Absence Reason Box in Amber */}
                      {isPending && m.absence_reason && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: "#ffffff",
                            border: "1px dashed #f59e0b",
                            borderLeft: "4px solid #f59e0b",
                            fontSize: 12,
                            color: "#92400e",
                          }}
                        >
                          <strong>📝 Đơn xin nghỉ vắng gửi Quản lý:</strong> "{m.absence_reason}"
                        </div>
                      )}

                      {/* Display Approved Absence Reason Box in Red */}
                      {isAbsent && m.absence_reason && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: "#ffffff",
                            border: "1px dashed #ef4444",
                            borderLeft: "4px solid #ef4444",
                            fontSize: 12,
                            color: "#991b1b",
                          }}
                        >
                          <strong>📝 Lý do vắng:</strong> "{m.absence_reason}"
                          {m.approved_by_name && (
                            <span style={{ marginLeft: 8, color: "#64748b", fontWeight: 600 }}>
                              • Đã duyệt bởi: <strong>{m.approved_by_name}</strong>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() =>
                  setRosterModal({ open: false, shift: null, day: null, rosterList: [], loading: false })
                }
                className="btn btn-secondary btn-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: BÁO VẮNG CA KÈM LÝ DO (REPORT ABSENCE MODAL) ================= */}
      {reportAbsenceModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 500,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <UserX size={20} color="#dc2626" />
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#dc2626" }}>
                  Nộp Đơn Báo Vắng Ca Cho Quản Lý
                </h3>
              </div>
              <button
                onClick={() => setReportAbsenceModal((prev) => ({ ...prev, open: false }))}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReportAbsenceSubmit}>
              <div
                style={{
                  background: "#fef2f2",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                  border: "1px solid #fecaca",
                }}
              >
                <div style={{ fontSize: 12, color: "#991b1b" }}>Nhân viên báo vắng:</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#7f1d1d", marginTop: 2 }}>
                  {reportAbsenceModal.targetUser?.full_name || user?.full_name}
                </div>
                <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>
                  Ca: <strong>{reportAbsenceModal.shiftName}</strong> (
                  {reportAbsenceModal.shiftLabel}) • Ngày:{" "}
                  <strong>{reportAbsenceModal.workDate}</strong>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Lý do báo vắng mặt (* bắt buộc gửi Quản lý):
                </label>
                <textarea
                  required
                  rows={3}
                  className="form-control"
                  placeholder="Ví dụ: Bị ốm đột xuất, bận thi học kỳ, việc gia đình đột xuất..."
                  value={reportAbsenceModal.reason}
                  onChange={(e) =>
                    setReportAbsenceModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setReportAbsenceModal((prev) => ({ ...prev, open: false }))}
                  className="btn btn-secondary btn-sm"
                  disabled={reportAbsenceModal.submitting}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-danger btn-sm"
                  disabled={reportAbsenceModal.submitting}
                  style={{
                    background: "#dc2626",
                    borderColor: "#dc2626",
                    fontWeight: 700,
                  }}
                >
                  {reportAbsenceModal.submitting ? "Đang gửi đơn..." : "Gửi Đơn Xin Vắng Đến Quản Lý"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DANH SÁCH SỰ KIỆN CA (EVENT MODAL) ================= */}
      {eventModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 560,
              width: "100%",
              padding: 24,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#0f172a" }}>
                  Toàn Bộ Sự Kiện & Công Việc Trong Ca
                </h3>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {eventModal.shift?.name} ({eventModal.shift?.label}) • Ngày:{" "}
                  {eventModal.day?.dateStr}
                </div>
              </div>
              <button
                onClick={() =>
                  setEventModal({ open: false, shift: null, day: null, eventList: [] })
                }
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              {eventModal.eventList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "30px 10px",
                    color: "#94a3b8",
                    fontStyle: "italic",
                  }}
                >
                  Chưa có sự kiện nào cho ca này.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {eventModal.eventList.map((ev) => {
                    const badge = getEventTypeBadge(ev.event_type);
                    return (
                      <div
                        key={ev.id}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            <span>{badge.icon}</span>
                            <span>{ev.title}</span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "rgba(0,0,0,0.06)",
                              }}
                            >
                              {badge.label}
                            </span>
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteEvent(ev.id)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                              }}
                              title="Xóa sự kiện"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        {ev.description && (
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.85,
                              marginTop: 6,
                              lineHeight: 1.4,
                            }}
                          >
                            {ev.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              {isAdmin && eventModal.shift && (
                <button
                  onClick={() => {
                    const shiftId = eventModal.shift.id;
                    const dateStr = eventModal.day?.dateStr;
                    openCreateEventModal(shiftId, dateStr);
                  }}
                  className="btn btn-primary btn-sm"
                >
                  <Plus size={14} style={{ marginRight: 6 }} /> Thêm sự kiện mới
                </button>
              )}
              <button
                onClick={() =>
                  setEventModal({ open: false, shift: null, day: null, eventList: [] })
                }
                className="btn btn-secondary btn-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TẠO SỰ KIỆN MỚI (CREATE EVENT MODAL) ================= */}
      {createEventModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 500,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Thêm Sự Kiện / Nhiệm Vụ Cho Ca
              </h3>
              <button
                onClick={() => setCreateEventModal((prev) => ({ ...prev, open: false }))}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateEventSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Ngày diễn ra sự kiện (*):</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={createEventModal.work_date || ""}
                  onChange={(e) =>
                    setCreateEventModal((prev) => ({ ...prev, work_date: e.target.value }))
                  }
                  className="form-control"
                  style={{ fontWeight: 600 }}
                />
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  ℹ️ Hệ thống chỉ cho phép chọn ngày hôm nay hoặc các ngày trong tương lai.
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>Phạm vi sự kiện (Theo Ngày hoặc Shift):</label>
                <select
                  value={createEventModal.shift_id}
                  onChange={(e) =>
                    setCreateEventModal((prev) => ({
                      ...prev,
                      shift_id: Number(e.target.value),
                    }))
                  }
                  className="form-control"
                  style={{
                    fontWeight: createEventModal.shift_id === 0 ? 700 : 500,
                    color: createEventModal.shift_id === 0 ? "#7e22ce" : "#0f172a",
                    background: createEventModal.shift_id === 0 ? "#faf5ff" : "#ffffff",
                    borderColor: createEventModal.shift_id === 0 ? "#c084fc" : "#cbd5e1",
                  }}
                >
                  <option value={0}>🌟 CẢ NGÀY (Sự kiện diễn ra cả ngày / Toàn bộ các ca)</option>
                  <optgroup label="── Hoặc chọn ca làm cụ thể ──">
                    {SHIFTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.label})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  {createEventModal.shift_id === 0
                    ? "✨ Sự kiện cả ngày sẽ hiển thị xuyên suốt toàn bộ 9 ca và hiện banner ở đầu ngày."
                    : "📌 Sự kiện này sẽ chỉ áp dụng riêng cho ca làm việc đã chọn."}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Tên sự kiện / công việc (*):</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Họp giao ban đầu ca, Kiểm tra hệ thống..."
                  value={createEventModal.title}
                  onChange={(e) =>
                    setCreateEventModal((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="form-control"
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Loại sự kiện:</label>
                <select
                  value={createEventModal.event_type}
                  onChange={(e) =>
                    setCreateEventModal((prev) => ({ ...prev, event_type: e.target.value }))
                  }
                  className="form-control"
                >
                  <option value="meeting">📌 Họp / Giao ban</option>
                  <option value="maintenance">🔧 Bảo trì / Kỹ thuật</option>
                  <option value="task">⚡ Nhiệm vụ / Tác vụ</option>
                  <option value="handover">📋 Bàn giao ca trực</option>
                  <option value="general">📢 Sự kiện / Thông báo chung</option>
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Mô tả chi tiết / Hướng dẫn công việc:</label>
                <textarea
                  rows={3}
                  placeholder="Nhập nội dung cần lưu ý trong ca này..."
                  value={createEventModal.description}
                  onChange={(e) =>
                    setCreateEventModal((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="form-control"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCreateEventModal((prev) => ({ ...prev, open: false }))}
                  className="btn btn-secondary btn-sm"
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Lưu sự kiện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: XIN HỦY CA LÀM VIỆC ================= */}
      {cancelModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 500,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Yêu Cầu Xin Hủy Ca Làm Việc
              </h3>
              <button
                onClick={() => setCancelModal((prev) => ({ ...prev, open: false }))}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit}>
              <div
                style={{
                  background: "#f8fafc",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ fontSize: 12, color: "#64748b" }}>Ca làm việc muốn xin hủy:</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginTop: 2 }}>
                  {cancelModal.shiftName} ({cancelModal.shiftLabel})
                </div>
                <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, marginTop: 2 }}>
                  Ngày làm: {cancelModal.workDate}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Lý do xin hủy ca (*):</label>
                <textarea
                  required
                  rows={3}
                  className="form-control"
                  placeholder="Ví dụ: Bận việc gia đình đột xuất, trùng lịch học thực hành..."
                  value={cancelModal.reason}
                  onChange={(e) => setCancelModal((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCancelModal((prev) => ({ ...prev, open: false }))}
                  className="btn btn-secondary btn-sm"
                  disabled={cancelModal.submitting}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-danger btn-sm"
                  disabled={cancelModal.submitting}
                >
                  {cancelModal.submitting ? "Đang gửi..." : "Gửi Yêu Cầu Xin Hủy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: XIN ĐỔI CA LÀM VIỆC ================= */}
      {changeModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 520,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#0f172a" }}>
                Yêu Cầu Xin Đổi Ca Trực
              </h3>
              <button
                onClick={() => setChangeModal((prev) => ({ ...prev, open: false }))}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangeSubmit}>
              <div
                style={{
                  background: "#eff6ff",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 14,
                  border: "1px solid #bfdbfe",
                }}
              >
                <div style={{ fontSize: 12, color: "#1e40af" }}>Ca làm việc hiện tại của bạn:</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a", marginTop: 2 }}>
                  {changeModal.currentShiftName} ({changeModal.currentShiftLabel}) - Ngày:{" "}
                  {changeModal.currentWorkDate}
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Chọn ca mục tiêu muốn đổi sang (*):</label>
                <select
                  className="form-control"
                  value={changeModal.targetShiftId}
                  onChange={(e) =>
                    setChangeModal((prev) => ({
                      ...prev,
                      targetShiftId: Number(e.target.value),
                    }))
                  }
                >
                  {SHIFTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.label})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Chọn ngày muốn đổi sang (*):</label>
                <input
                  type="date"
                  required
                  className="form-control"
                  value={changeModal.targetWorkDate}
                  onChange={(e) =>
                    setChangeModal((prev) => ({ ...prev, targetWorkDate: e.target.value }))
                  }
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Lý do xin đổi ca (*):</label>
                <textarea
                  required
                  rows={3}
                  className="form-control"
                  placeholder="Ví dụ: Trùng lịch kiểm tra buổi sáng, xin đổi sang ca chiều..."
                  value={changeModal.reason}
                  onChange={(e) => setChangeModal((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setChangeModal((prev) => ({ ...prev, open: false }))}
                  className="btn btn-secondary btn-sm"
                  disabled={changeModal.submitting}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={changeModal.submitting}
                >
                  {changeModal.submitting ? "Đang gửi..." : "Gửi Yêu Cầu Xin Đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: TỪ CHỐI YÊU CẦU ================= */}
      {rejectModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 480,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 12,
                marginBottom: 16,
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#dc2626" }}>
                Từ Chối Yêu Cầu Ca Làm
              </h3>
              <button
                onClick={() => setRejectModal((prev) => ({ ...prev, open: false }))}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit}>
              <div style={{ fontSize: 13, color: "#334155", marginBottom: 14 }}>
                Từ chối yêu cầu {rejectModal.actionType} của <strong>{rejectModal.staffName}</strong>.
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Lý do từ chối gửi nhân viên (*):</label>
                <textarea
                  required
                  rows={3}
                  className="form-control"
                  placeholder="Ví dụ: Ca trực này hiện thiếu người, chưa thể duyệt đổi..."
                  value={rejectModal.adminResponse}
                  onChange={(e) =>
                    setRejectModal((prev) => ({ ...prev, adminResponse: e.target.value }))
                  }
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRejectModal((prev) => ({ ...prev, open: false }))}
                  className="btn btn-secondary btn-sm"
                  disabled={rejectModal.submitting}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="btn btn-danger btn-sm"
                  disabled={rejectModal.submitting}
                >
                  {rejectModal.submitting ? "Đang xử lý..." : "Xác Nhận Từ Chối"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: DANH SÁCH CHỜ DUYỆT ================= */}
      {showPendingModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 760,
              width: "100%",
              padding: 24,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: "#0f172a" }}>
                  Danh Sách Yêu Cầu Xin Hủy / Đổi Ca / Báo Vắng Cần Phê Duyệt
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Quản lý xem xét lý do và bấm Duyệt hoặc Từ chối trực tiếp
                </span>
              </div>
              <button
                onClick={() => setShowPendingModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {pendingRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 10px", color: "#64748b" }}>
                <CheckCircle2
                  size={40}
                  style={{ color: "#10b981", opacity: 0.8, marginBottom: 8 }}
                />
                <p>Hiện không có yêu cầu hủy hoặc đổi ca nào đang chờ xét duyệt.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {(() => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  const expiredCount = pendingRequests.filter(r => r.is_expired || (r.work_date && r.work_date < todayStr)).length;
                  if (expiredCount === 0) return null;
                  return (
                    <div
                      style={{
                        background: "linear-gradient(135deg, #fffbeb 0%, #fef2f2 100%)",
                        border: "1px solid #f87171",
                        borderRadius: 10,
                        padding: "12px 16px",
                        marginBottom: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#991b1b", fontSize: 13 }}>
                        <AlertTriangle size={18} color="#dc2626" />
                        <span>
                          Phát hiện <strong>{expiredCount}</strong> yêu cầu đã qua ngày ca trực (quên duyệt). Nút Duyệt đã bị khóa.
                        </span>
                      </div>
                      <button
                        onClick={handleRejectAllExpired}
                        className="btn btn-danger btn-sm"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#dc2626",
                          borderColor: "#b91c1c",
                          fontWeight: 700,
                          boxShadow: "0 2px 8px rgba(220, 38, 38, 0.3)"
                        }}
                      >
                        <Trash2 size={14} /> Chuyển tất cả quá hạn sang Từ Chối
                      </button>
                    </div>
                  );
                })()}

                {pendingRequests.map((req) => {
                  const todayStr = new Date().toISOString().split("T")[0];
                  const isExpired = Boolean(req.is_expired || (req.work_date && req.work_date < todayStr));
                  const isCancel = req.status === "pending_cancel";
                  const isAbsence = req.attendance_status === "pending_absence";
                  return (
                    <div
                      key={req.id}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: isCancel ? "#fef2f2" : "#fffbeb",
                        border: isCancel ? "1px solid #fecaca" : "1px solid #fde68a",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: isAbsence ? "#d97706" : isCancel ? "#ef4444" : "#3b82f6",
                              color: "#ffffff",
                            }}
                          >
                            {isAbsence ? "YÊU CẦU BÁO VẮNG CA" : isCancel ? "YÊU CẦU XIN HỦY CA" : "YÊU CẦU XIN ĐỔI CA"}
                          </span>
                          {isExpired && (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: "2px 8px",
                                borderRadius: 4,
                                background: "#dc2626",
                                color: "#ffffff",
                                marginLeft: 6,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Clock size={11} /> ĐÃ QUA NGÀY (QUÁ HẠN DUYỆT)
                            </span>
                          )}
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 14,
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            {req.full_name} ({req.department || "Nhân viên"})
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          SĐT: {req.phone || "Chưa có"} • Email: {req.email}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, fontSize: 13, color: "#1e293b" }}>
                        <div>
                          Ca làm việc: <strong>{req.shift_name}</strong> ({req.shift_label}) - Ngày:{" "}
                          <strong>{req.work_date}</strong>
                        </div>
                        {!isCancel && !isAbsence && (
                          <div style={{ marginTop: 4, color: "#b45309" }}>
                            👉 Xin đổi sang: <strong>{req.target_shift_name}</strong> (
                            {req.target_shift_label}) - Ngày: <strong>{req.target_work_date}</strong>
                          </div>
                        )}
                        <div
                          style={{
                            marginTop: 6,
                            background: "rgba(255,255,255,0.85)",
                            padding: "8px 12px",
                            borderRadius: 6,
                            border: isAbsence ? "1px dashed #f59e0b" : "1px dashed rgba(0,0,0,0.1)",
                            fontSize: 12,
                            color: isAbsence ? "#92400e" : "inherit",
                          }}
                        >
                          <strong>Lý do {isAbsence ? "xin vắng ca" : "yêu cầu"}:</strong> "{req.absence_reason || req.request_reason || "Không ghi rõ"}"
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 8,
                          marginTop: 12,
                        }}
                      >
                        {isAbsence ? (
                          <>
                            <button
                              onClick={() => handleApproveAbsence(req.shift_id, req.work_date, req.user_id, false, req.full_name, isExpired ? "Từ chối do quá hạn ngày ca làm" : "")}
                              className="btn btn-danger btn-sm"
                              style={{ display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <X size={14} /> {isExpired ? "Chuyển Sang Từ Chối (Quá Hạn)" : "Từ Chối"}
                            </button>
                            {isExpired ? (
                              <button
                                disabled
                                className="btn btn-secondary btn-sm"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  opacity: 0.5,
                                  cursor: "not-allowed",
                                  background: "#cbd5e1",
                                  color: "#64748b",
                                  border: "none",
                                }}
                                title="Không thể phê duyệt ca làm trong quá khứ"
                              >
                                <Lock size={14} /> Đã Khóa Duyệt
                              </button>
                            ) : (
                              <button
                                onClick={() => handleApproveAbsence(req.shift_id, req.work_date, req.user_id, true, req.full_name)}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  background: "#10b981",
                                  borderColor: "#10b981",
                                }}
                              >
                                <Check size={14} /> Phê Duyệt Cho Vắng
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openRejectModal(req)}
                              className="btn btn-danger btn-sm"
                              style={{ display: "flex", alignItems: "center", gap: 4 }}
                            >
                              <X size={14} /> {isExpired ? "Chuyển Sang Từ Chối (Quá Hạn)" : "Từ Chối"}
                            </button>
                            {isExpired ? (
                              <button
                                disabled
                                className="btn btn-secondary btn-sm"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  opacity: 0.5,
                                  cursor: "not-allowed",
                                  background: "#cbd5e1",
                                  color: "#64748b",
                                  border: "none",
                                }}
                                title="Không thể phê duyệt ca làm trong quá khứ"
                              >
                                <Lock size={14} /> Đã Khóa Duyệt
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAdminApprove(req.id, req.full_name, req.work_date)}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  background: "#10b981",
                                  borderColor: "#10b981",
                                }}
                              >
                                <Check size={14} /> Phê Duyệt Ngay
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: XUẤT BẢN LỊCH TUẦN ================= */}
      {showPublishModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 540,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 14,
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Mail size={20} color="#2563eb" />
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  Xuất Bản Lịch & Gửi Email Cho Nhân Viên
                </h3>
              </div>
              <button
                onClick={() => setShowPublishModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              Hệ thống sẽ gửi email tổng hợp lịch trực 9 ca của tuần (từ {weekDays[0]?.displayDate}{" "}
              đến {weekDays[6]?.displayDate}) đến từng nhân sự.
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Nội dung dặn dò / Lời nhắn từ Quản lý:</label>
              <textarea
                rows={3}
                className="form-control"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 20,
                padding: "8px 12px",
                borderRadius: 8,
                background: "#f8fafc",
              }}
            >
              <input
                type="checkbox"
                id="sendEmailCheck"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <label
                htmlFor="sendEmailCheck"
                style={{
                  fontSize: 13,
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "#334155",
                  userSelect: "none",
                }}
              >
                Gửi thông báo qua email (SMTP) đến tất cả nhân viên có ca trực
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowPublishModal(false)}
                className="btn btn-secondary btn-sm"
                disabled={publishing}
              >
                Hủy
              </button>
              <button
                onClick={handlePublishSchedule}
                className="btn btn-primary btn-sm"
                disabled={publishing}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Send size={15} />
                {publishing ? "Đang gửi email..." : "Xác Nhận Xuất Bản"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SchedulePage;
