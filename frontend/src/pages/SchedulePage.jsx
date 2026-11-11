import { KpiLeaderboardModal } from "../components/KpiLeaderboardModal";
import { BulkAbsenceModal } from "../components/BulkAbsenceModal";
import { ClassScheduleModal } from "../components/ClassScheduleModal";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { SHIFTS } from "../constants/shifts";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import {
  Clock, CalendarX2, GraduationCap, Send, Mail, CheckCircle2, AlertCircle, PlusCircle, Trash2,
  ChevronLeft, ChevronRight, LayoutGrid, CalendarRange, UserCheck,
  UserPlus, ArrowLeftRight, Hourglass, Check, X, ShieldAlert, Calendar, ArrowRight,
  Users, Plus, ChevronDown, ChevronUp, Sparkles, Tag, Eye, Info, UserX,
  Lock, AlertTriangle, FileSpreadsheet, Upload, Download, Trophy, CheckSquare, CheckCheck, RotateCcw, Repeat
} from "lucide-react";

// Format a Date object as YYYY-MM-DD using local time (prevents UTC date-shift bugs)
function formatLocalDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Parse YYYY-MM-DD as local date safely set to noon to avoid any timezone/DST shift
function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  }
  return new Date(dateStr);
}

function getMonday(d) {
  const date = parseLocalDate(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  // In ISO weeks (Monday to Saturday):
  // Sunday (0) -> -6 days
  // Monday (1) -> 0 days
  // Tuesday (2) -> -1 day
  // Wednesday (3) -> -2 days
  // Thursday (4) -> -3 days
  // Friday (5) -> -4 days
  // Saturday (6) -> -5 days
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff, 12, 0, 0);
  return formatLocalDate(monday);
}

function getDaysOfWeek(mondayStr) {
  const monday = parseLocalDate(mondayStr);
  const days = [];
  const dayNames = [
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7"
  ];
  const todayStr = formatLocalDate(new Date());

  for (let i = 0; i < 6; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12, 0, 0);
    const dateStr = formatLocalDate(d);
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

// Kiểm tra sự kiện có diễn ra vào ngày dateStr hay không (1 ngày, trong 1 tuần, cả tháng)
function isEventActiveOnDate(e, dateStr) {
  if (!e) return false;
  if (!e.work_date) return true;
  if (e.end_date) {
    return e.work_date <= dateStr && dateStr <= e.end_date;
  }
  return e.work_date === dateStr;
}

// Kiểm tra sự kiện có hoạt động trong tuần đang xem hay không
function isEventActiveInWeek(e, weekDays) {
  if (!e) return false;
  if (!e.work_date) return true;
  if (!weekDays || weekDays.length === 0) return true;
  const startWeek = weekDays[0].dateStr;
  const endWeek = weekDays[weekDays.length - 1].dateStr;
  if (e.end_date) {
    return e.work_date <= endWeek && e.end_date >= startWeek;
  }
  return weekDays.some((d) => d.dateStr === e.work_date);
}

export function SchedulePage() {
  const { user, canManageSchedule, isLeader, isManager } = useAuth();
  const { fetchUnreadCount } = useNotifications();
  const isAdmin = user?.role === "admin" || user?.role === "leader" || user?.role === "manager" || isLeader || isManager || Boolean(user?.username && user.username.toLowerCase().includes("leader")) || Boolean(canManageSchedule);
  const isStrictAdmin = isAdmin;
  const todayStr = formatLocalDate(new Date());

  const [viewMode, setViewMode] = useState("week"); // 'week' | 'day' | 'my'
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    return formatLocalDate(d);
  });
  const [mondayDate, setMondayDate] = useState(() => getMonday(new Date()));
  const [weekDays, setWeekDays] = useState(() => getDaysOfWeek(getMonday(new Date())));

  // Tự động bỏ qua Chủ nhật (phòng trường hợp chọn hoặc tính toán rơi vào Chủ nhật)
  useEffect(() => {
    if (currentDate) {
      const d = parseLocalDate(currentDate);
      if (d.getDay() === 0) {
        d.setDate(d.getDate() + 1);
        const fixed = formatLocalDate(d);
        setCurrentDate(fixed);
        setActiveDay(fixed);
        const newMon = getMonday(d);
        if (newMon !== mondayDate) setMondayDate(newMon);
      }
    }
  }, [currentDate, mondayDate]);

  const [schedule, setSchedule] = useState([]);
  const [events, setEvents] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [allMembers, setAllMembers] = useState([]);
  const [showDetailedStats, setShowDetailedStats] = useState(false);

  // Nhân sự được chọn để xem lịch (mặc định là chính user đang đăng nhập)
  const [filterUserId, setFilterUserId] = useState(() => user?.id || null);

  useEffect(() => {
    if (user?.id && filterUserId === null) {
      setFilterUserId(user.id);
    }
  }, [user?.id]);

  const activeUserId = filterUserId === "all" ? null : (filterUserId || user?.id);
  const effectiveUser = useMemo(() => {
    if (!activeUserId) return user;
    return allMembers.find((m) => m.id === activeUserId) || user;
  }, [activeUserId, allMembers, user]);

  // Expanded Day state & Table Scroll
  const [expandedDay, setExpandedDay] = useState(null);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const tableScrollRef = React.useRef(null);
  const [activeDay, setActiveDay] = useState(() => {
    return formatLocalDate(new Date());
  });

  const scrollToDay = (dateStr) => {
    setActiveDay(dateStr);
    if (viewMode === "day") {
      setCurrentDate(dateStr);
    } else {
      const colElem = document.getElementById(`day-col-${dateStr}`);
      if (colElem && tableScrollRef.current) {
        const stickyWidth = window.innerWidth <= 768 ? 95 : 115;
        const targetPos = Math.max(0, colElem.offsetLeft - stickyWidth);
        tableScrollRef.current.scrollTo({ left: targetPos, behavior: "smooth" });
      }
    }
  };

  useEffect(() => {
    const todayStr = formatLocalDate(new Date());
    const isTodayInWeek = weekDays.some((d) => d.dateStr === todayStr);
    if (isTodayInWeek && tableScrollRef.current && viewMode === "week") {
      const timer = setTimeout(() => {
        const colElem = document.getElementById(`day-col-${todayStr}`);
        if (colElem && tableScrollRef.current) {
          const stickyWidth = window.innerWidth <= 768 ? 95 : 115;
          tableScrollRef.current.scrollTo({
            left: Math.max(0, colElem.offsetLeft - stickyWidth),
            behavior: "smooth"
          });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [mondayDate, viewMode, weekDays]);

  // Roster Modal: Shows all members for a clicked shift
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

  // Create Event Modal (Hỗ trợ chọn nhiều shift cùng lúc hoặc Cả ngày)
    // Modal chỉnh giờ làm thực tế trong ca (Đi muộn / Về sớm / Thiếu giờ)
  const [editingHoursModal, setEditingHoursModal] = useState({
    open: false,
    member: null,
    shift: null,
    day: null,
    actual_hours: 1.5,
    time_note: "",
  });

  const [createEventModal, setCreateEventModal] = useState({
    open: false,
    selected_shifts: [0], // [0] = cả ngày, hoặc [1, 2, 3], hoặc [7, 8]...
    shift_id: 0,
    work_date: "",
    end_date: "",
    duration_type: "day", // "day" (1 ngày) | "week" (Trong 1 tuần) | "month" (Cả tháng) | "custom" (Khoảng ngày)
    title: "",
    description: "",
    event_type: "meeting",
    all_shifts: true,
  });

  // Modal xác nhận xóa sự kiện định kỳ (chỉ xóa buổi này hay toàn bộ chuỗi)
  const [deleteRecurringModal, setDeleteRecurringModal] = useState({
    open: false,
    event: null,
  });

  // Modal xem và quản lý toàn bộ sự kiện tuần / định kỳ
  const [allEventsModal, setAllEventsModal] = useState({
    open: false,
    tab: "week", // "week" | "recurring" | "all"
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
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [showBulkAbsenceModal, setShowBulkAbsenceModal] = useState(false);
  const [bulkAbsenceMode, setBulkAbsenceMode] = useState("absence");
  const [bulkAbsenceDate, setBulkAbsenceDate] = useState(null);
  const [showClassScheduleModal, setShowClassScheduleModal] = useState(false);
  const [classConflicts, setClassConflicts] = useState([]);
  const LAB_KPI_TARGET = 20.0;
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

  const fetchMembers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setAllMembers(data || []);
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
    fetchMembers();
    if (isAdmin) {
      fetchPendingRequests();
    }
    fetchEvents();
  }, [isAdmin, fetchPendingRequests, fetchEvents, fetchMembers]);

  const showToast = useCallback((text, type = "success") => {
    setActionMsg({ text, type });
    setTimeout(() => setActionMsg({ text: "", type: "success" }), 4000);
  }, []);

  const totalMembers = allMembers.length;

  const fetchSchedule = useCallback(async () => {
    try {
      // Luôn tải đầy đủ lịch cả tuần (T2 - T7) để đảm bảo số liệu KPI và lịch tuần luôn chính xác, không bị cắt vụn khi xem theo ngày
      const days = getDaysOfWeek(mondayDate);
      const start = days[0].dateStr;
      const end = days[days.length - 1].dateStr;
      const [data, evData, conflictData] = await Promise.all([
        api.getSchedule(start, end),
        api.getShiftEvents(),
        api.getClassScheduleConflicts(start, end).catch(() => []),
      ]);
      setSchedule(data || []);
      setEvents(evData || []);
      setClassConflicts(conflictData || []);
      fetchMembers();
      if (isAdmin) {
        fetchPendingRequests();
      }
    } catch (err) {
      showToast("Lỗi khi tải dữ liệu: " + (err.message || ""), "danger");
    }
  }, [mondayDate, isAdmin, fetchPendingRequests, showToast]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Tự động đồng bộ lịch mới nhất khi người dùng chuyển lại tab mà không cần reload
  useEffect(() => {
    const handleFocus = () => {
      fetchSchedule();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchSchedule]);

  // Open Roster Modal (All Members)
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
      showToast("Lỗi khi tải danh sách thành viên: " + (err.message || ""), "danger");
      setRosterModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Open Report Absence Modal
  const openReportAbsence = (shift, day, targetUser = null) => {
    if (day?.dateStr && day.dateStr < todayStr) {
      showToast("Không thể nộp đơn báo vắng cho ca trực trong quá khứ! Nếu nhân viên bỏ ca, Quản lý vui lòng dùng chức năng 'Đánh dấu vắng' trong bảng điểm danh.", "warning");
      return;
    }
    const finalTarget = targetUser || user;
    if (finalTarget) {
      const existing = schedule.find(
        (s) => s.shift_id === shift.id && s.work_date === day.dateStr && s.user_id === finalTarget.id
      );
      if (existing?.attendance_status === "pending_absence") {
        showToast("Bạn đã nộp đơn báo vắng cho ca trực này rồi và đang chờ Quản lý phê duyệt. Không thể gửi trùng lặp!", "warning");
        return;
      }
      if (existing?.attendance_status === "absent") {
        showToast("Ca trực này đã được Quản lý phê duyệt vắng mặt rồi, không cần gửi lại đơn!", "warning");
        return;
      }
    }

    setReportAbsenceModal({
      open: true,
      shiftId: shift.id,
      workDate: day.dateStr,
      shiftName: shift.name,
      shiftLabel: shift.label,
      targetUser: finalTarget,
      reason: "",
      submitting: false,
    });
  };

  // Handle Admin Approve or Reject Absence
    // Admin đánh dấu nhân sự vắng mặt / bỏ ca trực tiếp
    // Mở modal chỉnh giờ làm thực tế
  const openEditHours = (member) => {
    const stdHours = 1.5;
    const curHours = (member.actual_hours !== null && member.actual_hours !== undefined)
      ? member.actual_hours
      : stdHours;
    setEditingHoursModal({
      open: true,
      member,
      shift: rosterModal.shift,
      day: rosterModal.day,
      actual_hours: curHours,
      time_note: member.time_note || "",
    });
  };

  // Lưu giờ làm thực tế
  const handleSaveActualHours = async (e) => {
    e.preventDefault();
    try {
      const newHours = editingHoursModal.actual_hours !== "" ? Number(editingHoursModal.actual_hours) : null;
      const newNote = editingHoursModal.time_note?.trim() || null;
      await api.updateActualHours({
        user_id: editingHoursModal.member.user_id,
        shift_id: editingHoursModal.shift.id,
        work_date: editingHoursModal.day.dateStr,
        actual_hours: newHours,
        time_note: newNote,
      });
      showToast(`Đã lưu số giờ thực tế (${editingHoursModal.actual_hours}h) cho ${editingHoursModal.member.full_name}!`);
      setEditingHoursModal((prev) => ({ ...prev, open: false }));

      // Cập nhật tức thời vào roster modal
      setRosterModal((prev) => ({
        ...prev,
        rosterList: (prev.rosterList || []).map((m) =>
          m.user_id === editingHoursModal.member.user_id
            ? {
                ...m,
                actual_hours: newHours,
                time_note: newNote,
                attendance_status: (newHours !== null && newHours <= 0) ? "absent" : "present",
              }
            : m
        ),
      }));

      const data = await api.getShiftRoster(editingHoursModal.shift.id, editingHoursModal.day.dateStr);
      if (data) {
        setRosterModal((prev) => ({ ...prev, rosterList: data }));
      }
      fetchSchedule();
    } catch (err) {
      showToast("Lỗi khi lưu giờ làm: " + (err.message || ""), "danger");
    }
  };

  const handleAdminMarkAbsent = async (member) => {
    if (!window.confirm(`Xác nhận đánh dấu ${member.full_name} VẮNG MẶT / BỎ CA trong ca này? Hành động này sẽ trừ giờ KPI của nhân sự.`)) {
      return;
    }
    try {
      await api.toggleAttendance({
        user_id: member.user_id,
        shift_id: rosterModal.shift.id,
        work_date: rosterModal.day.dateStr,
        attendance_status: "absent",
      });
      showToast(`Đã đánh dấu ${member.full_name} vắng mặt trong ca này!`);
      const data = await api.getShiftRoster(rosterModal.shift.id, rosterModal.day.dateStr);
      setRosterModal((prev) => ({ ...prev, rosterList: data || [] }));
      fetchSchedule();
    } catch (err) {
      showToast("Lỗi khi cập nhật: " + (err.message || ""), "danger");
    }
  };

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
    if (reportAbsenceModal.workDate && reportAbsenceModal.workDate < todayStr) {
      showToast("Không thể nộp đơn báo vắng cho ca trực trong quá khứ! Vui lòng chỉ báo vắng cho ca hôm nay hoặc tương lai.", "warning");
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

  // Quick restore all absent shifts in current week for logged-in user
  const handleQuickRestoreWeek = async () => {
    if (!window.confirm(`Bạn có chắc muốn khôi phục toàn bộ ${myKpiStats.absentCount} ca đang vắng trong tuần này về trạng thái Có Mặt để bảo toàn chỉ tiêu 20.0h KPI tuần?`)) return;
    try {
      const dates = weekDays.map((d) => d.dateStr);
      await api.cancelAbsenceBulk({
        dates,
        shift_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        user_id: user?.id,
      });
      showToast("Đã khôi phục toàn bộ ca trực về Có Mặt (đã bảo toàn tiến độ KPI 20h tuần)!");
      await fetchSchedule();
    } catch (err) {
      showToast("Lỗi khi khôi phục: " + (err.message || ""), "danger");
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

  // Open Create Event Modal (Hỗ trợ cả ngày hoặc theo ca, tổ chức 1 ngày, trong 1 tuần hoặc cả tháng)
  const openCreateEventModal = (shiftId = 0, workDate = "") => {
    const todayStr = formatLocalDate(new Date());
    const initialDate = workDate || todayStr;
    const isAll = shiftId === undefined || shiftId === null || Number(shiftId) === 0;
    const initialShifts = isAll ? [0] : [Number(shiftId)];

    setCreateEventModal({
      open: true,
      selected_shifts: initialShifts,
      shift_id: initialShifts[0],
      work_date: initialDate,
      end_date: initialDate,
      duration_type: "day",
      title: "",
      description: "",
      event_type: "meeting",
      all_shifts: isAll,
    });
  };

  // Helper tính chuỗi xem trước thời lượng diễn ra của sự kiện (1 ngày, trong 1 tuần, cả tháng)
  const getDurationEventPreview = (modal) => {
    if (!modal.work_date) return null;
    const start = modal.work_date;
    const end = modal.end_date || start;
    if (start === end) {
      return `📌 Diễn ra vào ngày ${start} (1 ngày duy nhất)`;
    }
    const d1 = parseLocalDate(start);
    const d2 = parseLocalDate(end);
    const diff = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);

    if (modal.duration_type === "week" || diff === 7) {
      return `🗓️ Tổ chức trong 1 tuần: Từ ${start} đến ${end} (7 ngày)`;
    }
    if (modal.duration_type === "month") {
      return `📅 Tổ chức cả tháng: Từ ${start} đến ${end} (${diff} ngày)`;
    }
    return `⏳ Diễn ra trong ${diff} ngày: Từ ${start} đến ${end}`;
  };

  // Toggle shift selection for event modal
  const handleToggleShiftSelection = (sId) => {
    setCreateEventModal((prev) => {
      let current = [...(prev.selected_shifts || [])];
      if (sId === 0) {
        return { ...prev, selected_shifts: [0], shift_id: 0, all_shifts: true };
      }
      if (current.includes(0)) {
        return { ...prev, selected_shifts: [sId], shift_id: sId, all_shifts: false };
      }
      if (current.includes(sId)) {
        const next = current.filter((id) => id !== sId);
        return {
          ...prev,
          selected_shifts: next.length > 0 ? next : [],
          shift_id: next.length > 0 ? next[0] : 0,
          all_shifts: false,
        };
      } else {
        const next = [...current, sId].sort((a, b) => a - b);
        return { ...prev, selected_shifts: next, shift_id: next[0], all_shifts: false };
      }
    });
  };

  const handleSelectShiftPreset = (presetShifts) => {
    setCreateEventModal((prev) => ({
      ...prev,
      selected_shifts: presetShifts,
      shift_id: presetShifts[0] || 0,
      all_shifts: false,
    }));
  };

  // Handle Create Event Submit (Hỗ trợ 1 ngày, trong 1 tuần, hoặc cả tháng theo chuẩn iPhone Calendar)
  const handleCreateEventSubmit = async (e) => {
    e.preventDefault();
    if (!createEventModal.title.trim()) {
      showToast("Vui lòng nhập tiêu đề sự kiện!", "danger");
      return;
    }

    const shifts = createEventModal.all_shifts
      ? [0]
      : (createEventModal.selected_shifts && createEventModal.selected_shifts.length > 0)
      ? createEventModal.selected_shifts
      : [0];

    let start = createEventModal.work_date || formatLocalDate(new Date());
    let end = createEventModal.end_date || start;

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    let durationType = "day";
    if (start !== end) {
      const mon = formatLocalDate(getMonday(start));
      const sunObj = parseLocalDate(mon);
      sunObj.setDate(sunObj.getDate() + 6);
      const sun = formatLocalDate(sunObj);

      const d = parseLocalDate(start);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      const mStart = `${y}-${String(m).padStart(2, "0")}-01`;
      const mEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      if (start === mon && end === sun) {
        durationType = "week";
      } else if (start === mStart && end === mEnd) {
        durationType = "month";
      } else {
        durationType = "custom";
      }
    } else {
      durationType = "day";
      end = null;
    }

    try {
      const res = await api.createShiftEvent({
        shift_id: shifts.includes(0) ? 0 : shifts[0],
        shift_ids: shifts.includes(0) ? [0] : shifts,
        work_date: start,
        end_date: end,
        duration_type: durationType,
        title: createEventModal.title.trim(),
        description: createEventModal.description?.trim() || "",
        event_type: createEventModal.event_type || "general",
      });

      showToast(res.message || "Đã thêm sự kiện thành công!");

      setCreateEventModal({
        open: false,
        selected_shifts: [0],
        shift_id: 0,
        work_date: "",
        end_date: "",
        duration_type: "day",
        title: "",
        description: "",
        event_type: "meeting",
        all_shifts: true,
      });
      fetchEvents();
      if (eventModal.open) {
        setEventModal((prev) => ({ ...prev, open: false }));
      }
    } catch (err) {
      showToast("Lỗi khi tạo sự kiện: " + (err.message || ""), "danger");
    }
  };

  // Handle Delete Event (Xóa sự kiện 1 ngày, trong 1 tuần, hoặc cả tháng)
  const handleDeleteEvent = async (evOrId) => {
    const eventObj = typeof evOrId === "object" ? evOrId : events.find((e) => e.id === evOrId);
    const eventId = typeof evOrId === "object" ? evOrId.id : evOrId;

    const label = eventObj?.duration_type === "month"
      ? "sự kiện cả tháng"
      : eventObj?.duration_type === "week"
      ? "sự kiện trong 1 tuần"
      : "sự kiện";

    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${label} "${eventObj?.title || ''}"?`)) {
      return;
    }

    try {
      const res = await api.deleteShiftEvent(eventId, false);
      showToast(res.message || "Đã xóa sự kiện thành công!");
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
      if (eventModal.open) {
        setEventModal((prev) => ({
          ...prev,
          eventList: prev.eventList.filter((ev) => ev.id !== eventId),
        }));
      }
      setDeleteRecurringModal({ open: false, event: null });
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

  // Handle Approve All or Selected Pending Requests
  const handleApproveAll = async (targetIds = null) => {
    const validRequests = pendingRequests.filter(
      (r) => isStrictAdmin || r.attendance_status !== "pending_absence"
    );
    const countToApprove = targetIds && targetIds.length > 0 ? targetIds.length : validRequests.length;

    if (countToApprove === 0) {
      showToast("Không có yêu cầu hợp lệ nào để phê duyệt!", "warning");
      return;
    }

    const confirmMsg =
      targetIds && targetIds.length < validRequests.length
        ? `Xác nhận phê duyệt ${targetIds.length} yêu cầu đã chọn?`
        : `Xác nhận PHÊ DUYỆT TẤT CẢ ${validRequests.length} yêu cầu đang chờ xét duyệt?`;

    if (!window.confirm(confirmMsg)) return;

    setIsBulkApproving(true);
    try {
      const res = await api.approveAllRequests(targetIds && targetIds.length > 0 ? targetIds : null);
      showToast(res.message || `Đã phê duyệt thành công ${countToApprove} yêu cầu!`);
      setSelectedPendingIds([]);
      fetchSchedule();
      fetchPendingRequests();
      if (rosterModal.open && rosterModal.shift) {
        const data = await api.getShiftRoster(rosterModal.shift.id, rosterModal.day.dateStr);
        setRosterModal((prev) => ({ ...prev, rosterList: data || [] }));
      }
    } catch (err) {
      showToast("Lỗi khi phê duyệt hàng loạt: " + (err.message || ""), "danger");
    } finally {
      setIsBulkApproving(false);
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
    const todayStr = formatLocalDate(new Date());
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
    const d = parseLocalDate(mondayDate);
    d.setDate(d.getDate() + weeks * 7);
    setMondayDate(formatLocalDate(d));
  };

  const handleDayChange = (days) => {
    const d = parseLocalDate(currentDate);
    d.setDate(d.getDate() + days);
    // Bỏ qua Chủ nhật (getDay() === 0):
    // Tiến tới từ Thứ 7 -> tự động nhảy sang Thứ 2 của tuần tiếp theo (+1 thêm 1 ngày nữa)
    // Lùi lại từ Thứ 2 -> tự động nhảy về Thứ 7 của tuần trước đó (-1 thêm 1 ngày nữa)
    if (d.getDay() === 0) {
      d.setDate(d.getDate() + (days > 0 ? 1 : -1));
    }
    const newDateStr = formatLocalDate(d);
    setCurrentDate(newDateStr);
    setActiveDay(newDateStr);
    const newMonday = getMonday(d);
    if (newMonday !== mondayDate) {
      setMondayDate(newMonday);
    }
  };

  const toggleExpandDay = (dateStr) => {
    setExpandedDay((prev) => (prev === dateStr ? null : dateStr));
    setActiveDay(dateStr);
    setTimeout(() => {
      const colElem = document.getElementById(`day-col-${dateStr}`);
      if (colElem && tableScrollRef.current) {
        const stickyWidth = window.innerWidth <= 768 ? 95 : 115;
        const leftPos = Math.max(0, colElem.offsetLeft - stickyWidth);
        tableScrollRef.current.scrollTo({ left: leftPos, behavior: "smooth" });
      }
    }, 60);
  };

  const scrollTable = (direction) => {
    if (tableScrollRef.current) {
      const offset = direction === "right" ? 340 : -340;
      tableScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const myShiftsInWeek = useMemo(() => {
    const weekDateStrs = weekDays.map((d) => d.dateStr);
    const uId = activeUserId || user?.id;
    return schedule.filter((s) => s.user_id === uId && (!s.work_date || weekDateStrs.includes(s.work_date)));
  }, [schedule, activeUserId, user?.id, weekDays]);

  // Ca làm của user trong ngày đang chọn (currentDate)
  const myShiftsToday = useMemo(() => {
    const uId = activeUserId || user?.id;
    return schedule.filter((s) => s.user_id === uId && s.work_date === currentDate);
  }, [schedule, activeUserId, user?.id, currentDate]);

  const myTodayHours = useMemo(() => {
    return myShiftsToday.reduce((sum, s) => {
      if (s.attendance_status === "absent" || s.attendance_status === "pending_absence") return sum;
      const shiftDuration = 1.5;
      const dur = s.actual_hours != null && Number(s.actual_hours) >= 0 ? Number(s.actual_hours) : shiftDuration;
      return sum + dur;
    }, 0);
  }, [myShiftsToday]);

  // Tổng số giờ làm việc thực tế được xếp lịch của người dùng trong tuần (mỗi ca chuẩn 1.5 tiếng)
  const myActualAssignedHours = useMemo(() => {
    return myShiftsInWeek.reduce((sum, s) => {
      if (s.attendance_status === "absent" || s.attendance_status === "pending_absence") return sum;
      const shiftDuration = 1.5;
      const dur = s.actual_hours != null && Number(s.actual_hours) >= 0 ? Number(s.actual_hours) : shiftDuration;
      return sum + dur;
    }, 0);
  }, [myShiftsInWeek]);

  // KPI analysis for current user: Chuẩn 20.0h / tuần (tính lũy kế cả tuần 7 ngày)
  const myKpiStats = useMemo(() => {
    let absentHours = 0;
    let absentCount = 0;
    let explicitAssignedHours = 0;

    myShiftsInWeek.forEach((s) => {
      const standardDuration = 1.5;
      const isAbsent = s.attendance_status === "absent" || s.attendance_status === "pending_absence";
      if (isAbsent) {
        absentHours += standardDuration;
        absentCount += 1;
        explicitAssignedHours += standardDuration;
      } else {
        const dur = s.actual_hours != null && Number(s.actual_hours) >= 0 ? Number(s.actual_hours) : standardDuration;
        explicitAssignedHours += dur;
      }
    });

    const totalAssignedHours = explicitAssignedHours > 0 ? explicitAssignedHours : (myShiftsInWeek.length === 0 ? 0 : LAB_KPI_TARGET);
    const validKpiHours = Math.max(0, totalAssignedHours - absentHours);
    const kpiPercent = Math.min(100, Math.round((validKpiHours / LAB_KPI_TARGET) * 100));

    return {
      totalAssignedHours,
      absentHours,
      absentCount,
      validKpiHours,
      kpiPercent,
    };
  }, [myShiftsInWeek]);

  const totalHours = myActualAssignedHours;

  // Lọc sự kiện theo tuần hiện tại đang xem (hỗ trợ sự kiện 1 ngày, trong 1 tuần, hoặc cả tháng)
  const weekEvents = useMemo(() => {
    return events.filter((e) => isEventActiveInWeek(e, weekDays));
  }, [events, weekDays]);

  // Các sự kiện tổ chức theo tuần hoặc cả tháng đang hoạt động trong tuần đang xem
  const longEventsInWeek = useMemo(() => {
    return weekEvents.filter((e) => e.duration_type === "week" || e.duration_type === "month" || (e.end_date && e.end_date !== e.work_date));
  }, [weekEvents]);

  // Tất cả các sự kiện kéo dài (trong 1 tuần, cả tháng, khoảng ngày)
  const multiDayEvents = useMemo(() => {
    return events.filter((e) => e.duration_type === "week" || e.duration_type === "month" || (e.end_date && e.end_date !== e.work_date));
  }, [events]);

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
          <h1 style={{ fontSize: "clamp(18px, 3.5vw, 24px)",
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
              {totalMembers > 0 ? `Đội Ngũ ${totalMembers} Thành Viên` : "Đội Ngũ Thành Viên"}
            </span>
          </h1>
          <p className="page-subtitle-mobile-hide" style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, lineHeight: 1.4 }}>
            Ô ca hiển thị gọn <strong>{totalMembers > 0 ? `${totalMembers} người` : "danh sách"}</strong> (nhấn vào để xem đầy đủ ai có mặt, ai vắng
            mặt kèm lý do). Nhân viên vắng phải báo vắng kèm lý do cho Quản lý.
          </p>
        </div>

        <div className="schedule-action-bar">
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
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>Chờ Duyệt ({pendingRequests.length})</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => openCreateEventModal(0, formatLocalDate(new Date()))}
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
              <Plus size={16} style={{ flexShrink: 0 }} />
              <span>+ Thêm Sự Kiện (Ngày / Ca)</span>
            </button>
          )}

          

          <button
            onClick={() => setShowKpiModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#f0fdf4",
              border: "1.5px solid #86efac",
              color: "#15803d",
              padding: "8px 14px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(21, 128, 61, 0.1)",
            }}
            title="Xem bảng xếp hạng và tiến độ chỉ tiêu 20 giờ/tuần của từng nhân sự"
          >
            <Trophy size={16} style={{ flexShrink: 0 }} />
            <span>Bảng KPI 20h</span>
          </button>

          <button
            onClick={() => setShowClassScheduleModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#fff1f2",
              border: "1.5px solid #fecdd3",
              color: "#be123c",
              padding: "8px 14px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(190, 18, 60, 0.12)",
              transition: "all 0.2s ease"
            }}
            title="Nhập và quản lý thời khóa biểu học tập (CSV/Excel) để cảnh báo trùng lịch trực"
          >
            <GraduationCap size={16} style={{ flexShrink: 0 }} />
            <span>TKB Học Tập (CSV)</span>
          </button>

          <button
            onClick={() => {
              setBulkAbsenceMode("absence");
              setShowBulkAbsenceModal(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#ef4444",
              border: "2px solid #dc2626",
              color: "#ffffff",
              padding: "8px 14px",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 3px 8px rgba(239, 68, 68, 0.35)",
              transition: "all 0.2s ease"
            }}
            title="Báo vắng nhiều ca làm việc hoặc báo vắng cả tuần"
          >
            <CalendarX2 size={16} style={{ flexShrink: 0 }} />
            <span>Báo Vắng Tuần / Nhiều Ca</span>
          </button>

          <button
            onClick={() => {
              setBulkAbsenceDate(null);
              setBulkAbsenceMode("restore");
              setShowBulkAbsenceModal(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#f0fdf4",
              border: "1.5px solid #bbf7d0",
              color: "#166534",
              padding: "8px 14px",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(22, 101, 52, 0.08)",
              transition: "all 0.2s ease"
            }}
            title="Khôi phục có mặt hàng loạt cho cả tuần hoặc nhiều ca đã báo vắng"
          >
            <RotateCcw size={16} style={{ flexShrink: 0 }} />
            <span>Khôi Phục Có Mặt Tuần / Ca</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowPublishModal(true)}
              className="btn btn-primary"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Send size={16} style={{ flexShrink: 0 }} />
              <span>Xuất Bản Lịch & Gửi Mail</span>
            </button>
          )}
        </div>
      </div>

      {/* SUMMARY STATS (4 DIRECT CARDS) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div className="card" style={{ padding: 14, borderLeft: "4px solid #3b82f6" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
            Quy chuẩn đội ngũ
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", marginTop: 4 }}>
            {totalMembers} <span style={{ fontSize: 13, fontWeight: 500 }}>thành viên</span>
          </div>
        </div>

        <div
          className="card"
          style={{
            padding: 14,
            borderLeft: myKpiStats.validKpiHours >= 20 ? "4px solid #10b981" : (myKpiStats.absentCount > 0 ? "4px solid #ef4444" : "4px solid #3b82f6"),
            background: myKpiStats.validKpiHours >= 20 ? "#f0fdf4" : ((myKpiStats.absentCount > 0 && myKpiStats.validKpiHours < 20) ? "#fef2f2" : undefined),
          }}
        >
          <div style={{ fontSize: 12, color: (myKpiStats.absentCount > 0 && myKpiStats.validKpiHours < 20) ? "#991b1b" : "var(--text-muted)", fontWeight: 600 }}>
            {viewMode === "day" ? "Ca trực ngày & KPI tuần" : "Ca trực & Quỹ KPI tuần này"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: myKpiStats.validKpiHours >= 20 ? "#10b981" : ((myKpiStats.absentCount > 0 && myKpiStats.validKpiHours < 20) ? "#dc2626" : "#1e293b"), marginTop: 4 }}>
            {myKpiStats.validKpiHours.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>/ 20.0 giờ tuần</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
            {viewMode === "day" ? (
              <span>Hôm nay: <strong>{myShiftsToday.length} ca ({myTodayHours.toFixed(1)}h)</strong> • Tuần: {myShiftsInWeek.length - myKpiStats.absentCount}/{myShiftsInWeek.length} ca</span>
            ) : (
              <span>Đã hoàn thành <strong>{myShiftsInWeek.length - myKpiStats.absentCount}/{myShiftsInWeek.length} ca</strong> trong tuần</span>
            )}
          </div>
          {myKpiStats.absentCount > 0 && myKpiStats.validKpiHours < 20 && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c", marginTop: 4 }}>
              ⚠️ Đã trừ: -{myKpiStats.absentHours.toFixed(1)}h KPI ({myKpiStats.absentCount} ca vắng)
            </div>
          )}
          {myKpiStats.absentCount > 0 && (
            <button
              onClick={handleQuickRestoreWeek}
              style={{
                marginTop: 6,
                background: "#ffffff",
                border: "1.5px solid #86efac",
                borderRadius: 6,
                padding: "3px 9px",
                fontSize: 11,
                fontWeight: 700,
                color: "#15803d",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
              title="Khôi phục toàn bộ ca vắng trong tuần về Có Mặt để bảo toàn KPI tuần"
            >
              <RotateCcw size={12} />
              <span>Khôi phục các ca vắng tuần này</span>
            </button>
          )}
        </div>

        <div
          className="card"
          onClick={() => setAllEventsModal({ open: true, tab: "week" })}
          style={{
            padding: 14,
            borderLeft: "4px solid #8b5cf6",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Bấm để xem danh sách chi tiết các sự kiện ca trực và chuỗi định kỳ (hàng tuần / hàng tháng)"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
              Sự kiện các ca trực
            </div>
            <span style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 700 }}>
              Chi tiết ›
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#8b5cf6", marginTop: 4 }}>
            {weekEvents.length} <span style={{ fontSize: 13, fontWeight: 500 }}>sự kiện tuần này</span>
          </div>
        </div>

        <div
          className="card"
          onClick={() => setShowKpiModal(true)}
          style={{
            padding: 14,
            borderLeft: "4px solid #059669",
            cursor: "pointer",
            background: myKpiStats.validKpiHours >= 20 ? "#f0fdf4" : "#ffffff",
            transition: "all 0.15s"
          }}
          title="Click để xem chi tiết Bảng xếp hạng KPI 20h của toàn bộ nhân sự"
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>
              🎯 Tiến Độ KPI Tuần (Chuẩn 20h/tuần)
            </div>
            <span style={{ fontSize: 11, background: myKpiStats.validKpiHours >= 20 ? "#dcfce7" : ((myKpiStats.absentCount > 0 && myKpiStats.validKpiHours < 20) ? "#fee2e2" : "#fef3c7"), color: myKpiStats.validKpiHours >= 20 ? "#15803d" : ((myKpiStats.absentCount > 0 && myKpiStats.validKpiHours < 20) ? "#b91c1c" : "#b45309"), padding: "2px 8px", borderRadius: 12, fontWeight: 700 }}>
              {myKpiStats.validKpiHours >= 20 ? "Đạt chuẩn 100%" : `${myKpiStats.kpiPercent}%`}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 4 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: myKpiStats.validKpiHours >= 20 ? "#059669" : ((myKpiStats.absentCount > 0 && myKpiStats.validKpiHours < 20) ? "#dc2626" : "#0f172a") }}>
              {myKpiStats.validKpiHours.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>/ 20.0 giờ</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
              {myKpiStats.validKpiHours >= 20 ? (
                <span style={{ color: "#16a34a", fontWeight: 700 }}>✅ Đã đạt mục tiêu 20h tuần!</span>
              ) : myKpiStats.absentCount > 0 ? (
                <span style={{ color: "#dc2626" }}>Còn thiếu {(20 - myKpiStats.validKpiHours).toFixed(1)}h (đã trừ {myKpiStats.absentHours.toFixed(1)}h vắng)</span>
              ) : (
                <span>Còn thiếu {(20 - myKpiStats.validKpiHours).toFixed(1)}h trong tuần</span>
              )}
            </div>
          </div>

          <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden", marginTop: 6 }}>
            <div
              style={{
                height: "100%",
                width: `${myKpiStats.kpiPercent}%`,
                background: myKpiStats.validKpiHours >= 20 ? "#10b981" : ((myKpiStats.absentCount > 0 && myKpiStats.validKpiHours < 20) ? "#ef4444" : "#f59e0b"),
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
            <span>Lũy kế cả tuần 7 ngày (~3.3h/ngày)</span>
            <span style={{ color: "#059669", fontWeight: 600 }}>Xem bảng xếp hạng →</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION BAR & VIEW SWITCHER */}
      <div
        className="card schedule-controls-card"
        style={{
          padding: "12px 16px",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div className="schedule-view-tabs">
          <button
            onClick={() => setViewMode("week")}
            className={`btn ${viewMode === "week" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <LayoutGrid size={15} style={{ flexShrink: 0 }} />
            <span className="tab-label-full">Lịch 1 Tuần (9 Ca)</span>
            <span className="tab-label-mobile">Tuần</span>
          </button>
          <button
            onClick={() => setViewMode("day")}
            className={`btn ${viewMode === "day" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <CalendarRange size={15} style={{ flexShrink: 0 }} />
            <span className="tab-label-full">Chi Tiết Theo 1 Ngày</span>
            <span className="tab-label-mobile">Theo Ngày</span>
          </button>
          <button
            onClick={() => setViewMode("my")}
            className={`btn ${viewMode === "my" ? "btn-primary" : "btn-secondary"}`}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <UserCheck size={15} style={{ flexShrink: 0 }} />
            <span className="tab-label-full">Ca Trực Của Tôi ({myShiftsInWeek.length})</span>
            <span className="tab-label-mobile">Của Tôi ({myShiftsInWeek.length})</span>
          </button>

          {isAdmin && allMembers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>
                👤 Xem lịch:
              </span>
              <select
                value={filterUserId ?? user?.id ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilterUserId(val === "all" ? "all" : (val ? Number(val) : null));
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 7,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: "#ffffff",
                  color: "#0f172a",
                  cursor: "pointer",
                  outline: "none",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
                title="Chọn nhân sự để chỉ hiện các ca vắng của riêng nhân sự đó"
              >
                <option value={user?.id}>-- Tôi ({user?.full_name || user?.username}) --</option>
                <option value="all">🌐 Toàn bộ đội ngũ (Tổng quan {totalMembers} người)</option>
                {allMembers
                  .filter((m) => m.id !== user?.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name || m.username} (@{m.username})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Date Controls */}
        <div className="schedule-date-controls" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {viewMode === "week" && (
            <>
              <button
                onClick={() => handleWeekChange(-1)}
                className="btn btn-secondary btn-sm"
                title="Tuần trước"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontWeight: 700, fontSize: 13, minWidth: 160, textAlign: "center" }}>
                Tuần: {weekDays[0]?.displayDate} - {weekDays[weekDays.length - 1]?.displayDate}/2026
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
                title="Ngày trước (Thứ 2 - Thứ 7)"
              >
                <ChevronLeft size={16} />
              </button>
              <input
                type="date"
                value={currentDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const chosen = parseLocalDate(val);
                  if (chosen.getDay() === 0) {
                    // Chủ nhật không có lịch trực -> tự động nhảy sang Thứ Hai
                    chosen.setDate(chosen.getDate() + 1);
                    const fixed = formatLocalDate(chosen);
                    setCurrentDate(fixed);
                    setActiveDay(fixed);
                    const newMon = getMonday(chosen);
                    if (newMon !== mondayDate) setMondayDate(newMon);
                  } else {
                    setCurrentDate(val);
                    setActiveDay(val);
                    const newMon = getMonday(chosen);
                    if (newMon !== mondayDate) setMondayDate(newMon);
                  }
                }}
                style={{
                  padding: "4px 8px",
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
                title="Ngày sau (Thứ 2 - Thứ 7)"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => {
                  const d = new Date();
                  if (d.getDay() === 0) {
                    d.setDate(d.getDate() + 1);
                  }
                  const today = formatLocalDate(d);
                  setCurrentDate(today);
                  setActiveDay(today);
                  const newMon = getMonday(d);
                  if (newMon !== mondayDate) setMondayDate(newMon);
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 12 }}
              >
                Hôm nay
              </button>
            </>
          )}
        </div>
      </div>

      {/* Banner hiển thị sự kiện tổ chức theo tuần hoặc cả tháng đang diễn ra */}
      {longEventsInWeek.length > 0 && (
        <div
          style={{
            background: "linear-gradient(135deg, #f5f3ff 0%, #eff6ff 100%)",
            border: "1.5px solid #ddd6fe",
            borderRadius: 14,
            padding: "12px 18px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "linear-gradient(135deg, #7c3aed, #6366f1)",
                color: "#ffffff",
                padding: "5px 12px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
              }}
            >
              <Sparkles size={14} />
              <span>SỰ KIỆN TUẦN / THÁNG</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {longEventsInWeek.map((ev) => {
                const isMonth = ev.duration_type === "month";
                return (
                  <div
                    key={ev.id}
                    onClick={() => setAllEventsModal({ open: true, tab: "multiday" })}
                    style={{
                      background: "#ffffff",
                      border: isMonth ? "1.5px solid #93c5fd" : "1.5px solid #c4b5fd",
                      borderRadius: 10,
                      padding: "6px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        background: isMonth ? "#eff6ff" : "#f5f3ff",
                        color: isMonth ? "#1d4ed8" : "#7c3aed",
                        padding: "2px 6px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {isMonth ? "📅 Cả tháng" : "🗓️ Trong 1 tuần"}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                      {ev.title}
                    </span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      ({ev.work_date?.slice(5).replace("-", "/")} → {ev.end_date?.slice(5).replace("-", "/")})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAllEventsModal({ open: true, tab: "multiday" })}
            style={{
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#475569",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Xem tất cả ›
          </button>
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
            className="schedule-table-wrap"
          >
            <table
              className="schedule-table"
              style={{
                width: "100%",
                minWidth: expandedDay ? 1500 : 1180,
                borderCollapse: "separate",
                borderSpacing: 0,
                textAlign: "left",
                transition: "min-width 0.25s ease",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #cbd5e1" }}>
                  <th
                    className="schedule-shift-col"
                    style={{
                      padding: "14px 10px",
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
                        className={`schedule-day-col ${isExpanded ? "expanded" : ""}`}
                        style={{
                          padding: "12px 8px",
                          textAlign: "center",
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
                          {day.isToday ? (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 800,
                                background: "#2563eb",
                                color: "#ffffff",
                                padding: "1px 6px",
                                borderRadius: 10,
                              }}
                            >
                              Hôm nay
                            </span>
                          ) : (
                            <Calendar
                              size={12}
                              color={isExpanded ? "#2563eb" : "#94a3b8"}
                            />
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: isExpanded ? "#1d4ed8" : day.isToday ? "#2563eb" : "var(--text-muted)",
                            marginTop: 2,
                            fontWeight: 600,
                          }}
                        >
                          {day.displayDate}
                        </div>
                        <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                          {isExpanded ? (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 8,
                                background: "#2563eb",
                                color: "#ffffff",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                              }}
                            >
                              ✕ Thu gọn
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                color: "#64748b",
                                padding: "1px 6px",
                                borderRadius: 6,
                                background: "#f1f5f9",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 2,
                              }}
                            >
                              ▾ Mở rộng
                            </span>
                          )}
                          {isAdmin && (
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
                                borderRadius: 5,
                                padding: "1px 5px",
                                cursor: "pointer",
                                fontWeight: 700,
                              }}
                              title="Tạo sự kiện riêng cho ngày này"
                            >
                              + Sự kiện
                            </button>
                          )}
                        </div>
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
                      className="schedule-shift-col"
                      style={{
                        padding: "10px 8px",
                        verticalAlign: "top",
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
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: "#2563eb",
                          marginTop: 3,
                          background: "#eff6ff",
                          padding: "2px 5px",
                          borderRadius: 4,
                          display: "inline-block",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {shift.label}
                      </div>
                      {shift.description && (
                        <div style={{ fontSize: 9.5, color: "#64748b", marginTop: 4 }}>
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
                      const conflictsInSlot = classConflicts.filter(
                        (c) => c.shift_id === shift.id && c.work_date === day.dateStr
                      );
                      const customizedInSlot = schedule.filter(
                        (s) =>
                          s.shift_id === shift.id &&
                          s.work_date === day.dateStr &&
                          s.actual_hours !== null &&
                          s.actual_hours !== undefined
                      );
                      const targetRegInSlot = activeUserId
                        ? schedule.find(
                            (s) => s.shift_id === shift.id && s.work_date === day.dateStr && s.user_id === activeUserId
                          )
                        : null;
                      const isTargetPending = targetRegInSlot?.attendance_status === "pending_absence";
                      const isTargetAbsent = targetRegInSlot?.attendance_status === "absent";
                      const absentCount = absentInSlot.length;
                      const slotTotal = totalMembers > 0 ? totalMembers : 21;
                      const presentCount = Math.max(0, slotTotal - absentCount);

                      // CHỈ HIỆN ĐỎ KHI NHÂN SỰ ĐANG XEM (HOẶC ĐƯỢC CHỌN) BỊ VẮNG TRONG CA NÀY
                      // Nếu chọn xem "all", chỉ đỏ khi ca hoàn toàn không có ai trực (0 người)
                      const hasAbsence = filterUserId === "all" ? (presentCount === 0) : Boolean(isTargetAbsent);
                      const hasPending = filterUserId === "all" ? (pendingInSlot.length > 0) : Boolean(isTargetPending);
                      const eventsInThisSlot = events.filter(
                        (e) =>
                          (!e.shift_id || e.shift_id === 0 || e.shift_id === shift.id) &&
                          isEventActiveOnDate(e, day.dateStr)
                      );

                      return (
                        <td
                          key={day.dateStr}
                          className={`schedule-day-col ${isExpanded ? "expanded" : ""}`}
                          style={{
                            padding: isExpanded ? "8px 10px" : "6px",
                            verticalAlign: "top",
                            borderLeft: isExpanded ? "2px solid #60a5fa" : "1px solid #f1f5f9",
                            borderRight: isExpanded ? "2px solid #60a5fa" : "none",
                            borderBottom: "1px solid #e2e8f0",
                            background: isExpanded
                              ? "#f0f7ff"
                              : day.isToday
                                ? "#f8faff"
                                : "#ffffff",
                            position: "relative",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div
                            className={`schedule-slot-card ${hasAbsence ? "has-absence" : hasPending ? "has-pending" : ""} ${day.isToday ? "is-today" : ""}`}
                            onClick={() => openRosterModal(shift, day)}
                            title={
                              absentCount > 0
                                ? `Có mặt: ${presentCount}/${slotTotal} người (${absentCount} người vắng mặt) • Bấm để xem danh sách & điểm danh`
                                : `Bấm để xem danh sách ${slotTotal} thành viên & điểm danh`
                            }
                          >
                            {/* Dòng 1: Đội ngũ & Nút thao tác nhanh (luôn ghi ngang cố định, nút hover nổi tuyệt đối không chiếm diện tích) */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 22, position: "relative", width: "100%" }}>
                              <div
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4.5,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: isTargetAbsent ? "#dc2626" : "#1e293b",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}
                              >
                                <Users
                                  size={13}
                                  color={isTargetAbsent ? "#dc2626" : "#2563eb"}
                                  style={{ flexShrink: 0 }}
                                />
                                <span style={{ whiteSpace: "nowrap" }}>{slotTotal > 0 ? `${presentCount} người` : "Điểm danh"}</span>
                                {filterUserId === "all" && absentCount > 0 && (
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      color: isTargetAbsent ? "#b91c1c" : "#64748b",
                                      background: isTargetAbsent ? "#fee2e2" : "#f1f5f9",
                                      border: `1px solid ${isTargetAbsent ? "#fca5a5" : "#e2e8f0"}`,
                                      padding: "1px 5px",
                                      borderRadius: 4,
                                      fontWeight: 600,
                                      whiteSpace: "nowrap",
                                      flexShrink: 0,
                                    }}
                                    title={`Có ${absentCount} người vắng mặt trong ca này`}
                                  >
                                    ({absentCount} vắng)
                                  </span>
                                )}
                              </div>

                              {/* Hover Quick Actions */}
                              <div
                                className="schedule-cell-actions"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {(() => {
                                  if (isTargetPending) {
                                    return (
                                      <button
                                        onClick={() => handleCancelAbsence(shift.id, day.dateStr, effectiveUser?.id)}
                                        style={{
                                          background: "#fef3c7",
                                          border: "1px solid #fde68a",
                                          borderRadius: 4,
                                          padding: "2px 6px",
                                          fontSize: 9.5,
                                          fontWeight: 700,
                                          color: "#92400e",
                                          cursor: "pointer",
                                          whiteSpace: "nowrap",
                                        }}
                                        title="Đơn vắng đang chờ Quản lý duyệt. Nhấn để hủy đơn và có mặt lại."
                                      >
                                        🟡 Chờ duyệt
                                      </button>
                                    );
                                  }
                                  if (isTargetAbsent) {
                                    const isClassConflict = targetRegInSlot?.absence_reason?.includes("lịch học") || targetRegInSlot?.time_note?.includes("Trùng TKB");
                                    const shiftDurLabel = "-1.5h KPI";
                                    return (
                                      <div style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                        <span
                                          style={{
                                            background: isClassConflict ? "#f5f3ff" : "#fee2e2",
                                            border: `1px solid ${isClassConflict ? "#c4b5fd" : "#fca5a5"}`,
                                            borderRadius: 4,
                                            padding: "2px 5px",
                                            fontSize: 9,
                                            fontWeight: 700,
                                            color: isClassConflict ? "#6d28d9" : "#991b1b",
                                            whiteSpace: "nowrap",
                                          }}
                                          title="Vắng mặt (Đã trừ KPI ca này)"
                                        >
                                          {isClassConflict ? `🎓 Trùng TKB (${shiftDurLabel})` : `🔴 Đã nghỉ (${shiftDurLabel})`}
                                        </span>
                                        {(isAdmin || effectiveUser?.id === user?.id) && (
                                          <button
                                            onClick={() => handleCancelAbsence(shift.id, day.dateStr, effectiveUser?.id)}
                                            style={{
                                              background: "#dcfce7",
                                              border: "1px solid #86efac",
                                              borderRadius: 4,
                                              padding: "2px 5px",
                                              fontSize: 9,
                                              fontWeight: 700,
                                              color: "#166534",
                                              cursor: "pointer",
                                              whiteSpace: "nowrap",
                                            }}
                                            title="Khôi phục có mặt lại"
                                          >
                                            🔄
                                          </button>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (day.dateStr < todayStr) {
                                    return null;
                                  }
                                  return (
                                    <button
                                      onClick={() => openReportAbsence(shift, day, effectiveUser)}
                                      style={{
                                        background: "#fee2e2",
                                        border: "1px solid #fca5a5",
                                        borderRadius: 4,
                                        padding: "2px 6px",
                                        fontSize: 9.5,
                                        fontWeight: 700,
                                        color: "#b91c1c",
                                        cursor: "pointer",
                                        whiteSpace: "nowrap",
                                      }}
                                      title={effectiveUser?.id === user?.id ? "Báo vắng ca này" : `Báo vắng ca này cho ${effectiveUser?.full_name || effectiveUser?.username}`}
                                    >
                                      Báo vắng
                                    </button>
                                  );
                                })()}
                                {isAdmin && (
                                  <button
                                    onClick={() => openCreateEventModal(shift.id, day.dateStr)}
                                    style={{
                                      background: "#f3e8ff",
                                      border: "1px solid #d8b4fe",
                                      borderRadius: 4,
                                      padding: "2px 5px",
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      color: "#7e22ce",
                                      cursor: "pointer",
                                      lineHeight: 1,
                                    }}
                                    title="Thêm sự kiện vào ca này"
                                  >
                                    +
                                  </button>
                                )}
                              </div>
                            </div>


                            {customizedInSlot.length > 0 && (
                              <div style={{ marginTop: 2 }}>
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    background: "#f0fdf4",
                                    color: "#15803d",
                                    border: "1px solid #86efac",
                                    padding: "1px 5px",
                                    borderRadius: 10,
                                  }}
                                  title={customizedInSlot
                                    .map((c) => `${c.full_name}: ${c.actual_hours}h${c.time_note ? ` (${c.time_note})` : ''}`)
                                    .join("\n")}
                                >
                                  ⏱️ {customizedInSlot.length}
                                </span>
                              </div>
                            )}

                            {/* Expanded details (absent list) */}
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
                                    <span style={{ fontSize: 9, fontStyle: "italic", opacity: 0.85 }}>
                                      Vắng mặt
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Expanded details: only absences, no TKB yellow list */}

                            {/* Events list: ONLY rendered when events actually exist! */}
                            {eventsInThisSlot.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 2, borderTop: "1px dashed #e2e8f0", paddingTop: 4 }}>
                                {!isExpanded && eventsInThisSlot.length > 1 ? (
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEventModal(shift, day, eventsInThisSlot);
                                    }}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 4,
                                      padding: "2.5px 7px",
                                      borderRadius: 5,
                                      background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                                      border: "1px solid #c084fc",
                                      color: "#6b21a8",
                                      fontSize: 9.5,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      boxShadow: "0 1px 2px rgba(126, 34, 206, 0.08)",
                                      transition: "all 0.15s ease",
                                    }}
                                    title={`Có ${eventsInThisSlot.length} sự kiện trong ca:\n` + eventsInThisSlot.map((e, idx) => `${idx + 1}. ${(!e.shift_id || e.shift_id === 0) ? "[CẢ NGÀY] " : ""}${e.title}${e.description ? ` (${e.description})` : ""}`).join("\n") + "\n\n👉 Bấm để xem chi tiết tất cả sự kiện"}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
                                      <Sparkles size={11} color="#9333ea" style={{ flexShrink: 0 }} />
                                      <span style={{ whiteSpace: "nowrap" }}>{eventsInThisSlot.length} sự kiện</span>
                                    </div>
                                    <span style={{ fontSize: 9.5, opacity: 0.75, fontWeight: 800, flexShrink: 0 }}>›</span>
                                  </div>
                                ) : (
                                  eventsInThisSlot.map((ev) => {
                                    const badge = getEventTypeBadge(ev.event_type);
                                    return (
                                      <div
                                        key={ev.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEventModal(shift, day, eventsInThisSlot);
                                        }}
                                        style={{
                                          display: "flex",
                                          flexDirection: isExpanded ? "column" : "row",
                                          alignItems: isExpanded ? "flex-start" : "center",
                                          gap: 3,
                                          padding: isExpanded ? "4px 7px" : "2px 5px",
                                          borderRadius: 4,
                                          background: badge.bg,
                                          border: `1px solid ${badge.border}`,
                                          color: badge.color,
                                          fontSize: 9.5,
                                          fontWeight: 600,
                                          cursor: "pointer",
                                        }}
                                        title={`${ev.title}${ev.description ? ` - ${ev.description}` : ""}`}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: 4, width: "100%" }}>
                                          <span style={{ fontSize: 9 }}>{badge.icon}</span>
                                          {(!ev.shift_id || ev.shift_id === 0) && (
                                            <span style={{ fontSize: 8, fontWeight: 800, padding: "1px 4px", borderRadius: 3, background: "#7e22ce", color: "#fff", flexShrink: 0 }}>
                                              CẢ NGÀY
                                            </span>
                                          )}
                                          {ev.duration_type === "week" ? (
                                            <span
                                              title={ev.repeat_rule || "Sự kiện tổ chức trong 1 tuần"}
                                              style={{
                                                fontSize: 8,
                                                fontWeight: 800,
                                                padding: "1px 4px",
                                                borderRadius: 3,
                                                background: "#ede9fe",
                                                color: "#6d28d9",
                                                border: "1px solid #ddd6fe",
                                                flexShrink: 0,
                                              }}
                                            >
                                              🗓️ 1 tuần
                                            </span>
                                          ) : ev.duration_type === "month" ? (
                                            <span
                                              title={ev.repeat_rule || "Sự kiện tổ chức cả tháng"}
                                              style={{
                                                fontSize: 8,
                                                fontWeight: 800,
                                                padding: "1px 4px",
                                                borderRadius: 3,
                                                background: "#dbeafe",
                                                color: "#1d4ed8",
                                                border: "1px solid #bfdbfe",
                                                flexShrink: 0,
                                              }}
                                            >
                                              📅 Cả tháng
                                            </span>
                                          ) : ev.duration_type === "custom" ? (
                                            <span
                                              title={ev.repeat_rule || `Từ ${ev.work_date} đến ${ev.end_date}`}
                                              style={{
                                                fontSize: 8,
                                                fontWeight: 800,
                                                padding: "1px 4px",
                                                borderRadius: 3,
                                                background: "#fef3c7",
                                                color: "#b45309",
                                                border: "1px solid #fde68a",
                                                flexShrink: 0,
                                              }}
                                            >
                                              ⏳ Đợt
                                            </span>
                                          ) : null}
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
                                  })
                                )}
                              </div>
                            )}
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
                Chi Tiết 9 Ca Làm Việc: {(() => {
                  const d = new Date(currentDate);
                  const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
                  const dStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                  return `${dayNames[d.getDay()] || ""} (${dStr})`;
                })()}
              </h2>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span>Xem danh sách thành viên trong từng ca trực (Thứ 2 đến Thứ 7, Chủ nhật nghỉ).</span>
                <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 8px", borderRadius: 10, fontWeight: 600, fontSize: 11 }}>
                  💡 KPI 20h là tổng lũy kế cả tuần (Thứ 2 - Thứ 7, ~3.3h/ngày), không phải mỗi ngày 20 tiếng
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(isAdmin || currentDate >= todayStr) && (
                <button
                  onClick={() => {
                    setBulkAbsenceDate(currentDate);
                    setBulkAbsenceMode("restore");
                    setShowBulkAbsenceModal(true);
                  }}
                  className="btn btn-sm"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#f0fdf4",
                    border: "1px solid #86efac",
                    color: "#166534",
                    fontWeight: 700,
                  }}
                  title="Khôi phục có mặt cho các ca trong ngày này"
                >
                  <RotateCcw size={14} /> Khôi Phục Có Mặt Ngày Này
                </button>
              )}
              <button
                onClick={() => setViewMode("week")}
                className="btn btn-secondary btn-sm"
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <ArrowLeftRight size={14} /> Quay về Lịch 1 Tuần
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SHIFTS.map((shift) => {
              const curD = new Date(currentDate);
              const curDayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
              const dayObj = {
                dateStr: currentDate,
                displayDate: `${String(curD.getDate()).padStart(2, "0")}/${String(curD.getMonth() + 1).padStart(2, "0")}`,
                dayName: curDayNames[curD.getDay()] || "Hôm nay",
              };
              const absentInShift = schedule.filter(
                (s) =>
                  s.shift_id === shift.id &&
                  s.work_date === currentDate &&
                  s.attendance_status === "absent"
              );
              const pendingInShift = schedule.filter(
                (s) =>
                  s.shift_id === shift.id &&
                  s.work_date === currentDate &&
                  s.attendance_status === "pending_absence"
              );
              const eventsInShift = events.filter(
                (e) =>
                  (!e.shift_id || e.shift_id === 0 || e.shift_id === shift.id) &&
                  isEventActiveOnDate(e, currentDate)
              );

              const targetDayReg = activeUserId
                ? schedule.find(
                    (s) => s.shift_id === shift.id && s.work_date === currentDate && s.user_id === activeUserId
                  )
                : null;
              const isDayTargetPending = targetDayReg?.attendance_status === "pending_absence";
              const isDayTargetAbsent = targetDayReg?.attendance_status === "absent";
              const dayHasAbsence = filterUserId === "all" ? (absentInShift.length >= (totalMembers || 21)) : Boolean(isDayTargetAbsent);
              const dayHasPending = filterUserId === "all" ? (pendingInShift.length > 0) : Boolean(isDayTargetPending);

              return (
                <div
                  key={shift.id}
                  className="card"
                  style={{
                    padding: 16,
                    borderLeft: dayHasAbsence ? "4px solid #ef4444" : dayHasPending ? "4px solid #f59e0b" : "4px solid #3b82f6",
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
                      {(() => {
                        if (isDayTargetPending) {
                          return (
                            <button
                              onClick={() => handleCancelAbsence(shift.id, currentDate, effectiveUser?.id)}
                              style={{
                                background: "#fef3c7",
                                border: "1px solid #fde68a",
                                color: "#92400e",
                                borderRadius: 6,
                                padding: "6px 12px",
                                fontWeight: 700,
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                              title="Đơn báo vắng đang chờ Quản lý duyệt. Nhấn để hủy đơn và có mặt lại."
                            >
                              🟡 Chờ Duyệt (Hủy Đơn)
                            </button>
                          );
                        }
                        if (isDayTargetAbsent) {
                          if (currentDate < todayStr) {
                            return (
                              <span
                                style={{
                                  background: "#fee2e2",
                                  border: "1px solid #fca5a5",
                                  color: "#991b1b",
                                  borderRadius: 6,
                                  padding: "6px 12px",
                                  fontWeight: 700,
                                  fontSize: 12,
                                }}
                              >
                                🔴 Đã nghỉ
                              </span>
                            );
                          }
                          return (
                            <button
                              onClick={() => handleCancelAbsence(shift.id, currentDate, effectiveUser?.id)}
                              className="btn btn-primary btn-sm"
                              title="Đã duyệt vắng mặt. Nhấn để xác nhận có mặt lại."
                            >
                              Xác Nhận Có Mặt Lại
                            </button>
                          );
                        }
                        if (currentDate < todayStr) {
                          return null;
                        }
                        return (
                          <button
                            onClick={() => openReportAbsence(shift, dayObj, effectiveUser)}
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
                        );
                      })()}
                      <button
                        onClick={() => openRosterModal(shift, dayObj)}
                        className="btn btn-primary btn-sm"
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <Users size={14} /> {totalMembers > 0 ? `Xem ${Math.max(0, totalMembers - absentInShift.length)}/${totalMembers} Người (Điểm danh)` : "Điểm danh"}
                      </button>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>
                      👥 Đội ngũ: <strong>{Math.max(0, totalMembers - absentInShift.length)} người có mặt</strong> ({Math.max(0, totalMembers - absentInShift.length)}/{totalMembers}) •{" "}
                      {isAdmin ? (
                        <>
                          {absentInShift.length > 0 ? (
                            <span style={{ color: "#dc2626", fontWeight: 700 }}>
                              🔴 {absentInShift.length} người vắng mặt
                            </span>
                          ) : (
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>
                              🟢 Đủ {totalMembers} người có mặt
                            </span>
                          )}
                          {pendingInShift.length > 0 && (
                            <span style={{ color: "#d97706", fontWeight: 700, marginLeft: 8 }}>
                              • 🟡 {pendingInShift.length} chờ duyệt vắng
                            </span>
                          )}
                        </>
                      ) : (
                        isMyAbsentInDay ? (
                          <span style={{ color: "#dc2626", fontWeight: 700 }}>
                            🔴 Bạn đã được duyệt nghỉ ca này
                          </span>
                        ) : isMyPendingInDay ? (
                          <span style={{ color: "#d97706", fontWeight: 700 }}>
                            🟡 Đơn xin vắng của bạn đang chờ duyệt
                          </span>
                        ) : (
                          <span style={{ color: "#16a34a", fontWeight: 700 }}>
                            🟢 Bạn có mặt trong ca này
                          </span>
                        )
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      📅 {eventsInShift.length} sự kiện trong ca
                    </div>
                  </div>

                  {/* Hiển thị chi tiết danh tính người vắng trong ca (Chỉ cho Quản lý) */}
                  {isAdmin && (absentInShift.length > 0 || pendingInShift.length > 0) && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 8, borderTop: "1px dashed #fecaca" }}>
                      {absentInShift.map((a) => (
                        <span
                          key={a.id}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: "#fee2e2",
                            color: "#991b1b",
                            border: "1px solid #fca5a5",
                            padding: "3px 8px",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          🔴 {a.full_name || a.username} (Vắng mặt)
                        </span>
                      ))}
                      {pendingInShift.map((p) => (
                        <span
                          key={p.id}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: "#fef3c7",
                            color: "#92400e",
                            border: "1px solid #fde68a",
                            padding: "3px 8px",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          🟡 {p.full_name || p.username} xin vắng: "{p.absence_reason || "Đang xin nghỉ"}" (Chờ duyệt)
                        </span>
                      ))}
                    </div>
                  )}
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
            {weekDays[weekDays.length - 1]?.displayDate})
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
                const isPending = shift.attendance_status === "pending_absence";
                return (
                  <div
                    key={shift.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 14,
                      borderRadius: 10,
                      background: isAbsent ? "#fef2f2" : isPending ? "#fffbeb" : "#f8fafc",
                      border: isAbsent ? "1.5px solid #ef4444" : isPending ? "1.5px solid #f59e0b" : "1px solid #e2e8f0",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: isAbsent ? "#991b1b" : isPending ? "#b45309" : "#0f172a",
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
                            🔴 VẮNG MẶT (ĐÃ DUYỆT)
                          </span>
                        ) : isPending ? (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              background: "#f59e0b",
                              color: "#fff",
                              padding: "1px 6px",
                              borderRadius: 4,
                            }}
                          >
                            🟡 ĐƠN CHỜ QUẢN LÝ DUYỆT
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
                      {isPending && shift.absence_reason && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#b45309",
                            fontStyle: "italic",
                            marginTop: 3,
                          }}
                        >
                          Lý do xin vắng (Chờ duyệt): "{shift.absence_reason}"
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isAbsent ? (
                        (shift.work_date >= todayStr || isAdmin) ? (
                          <button
                            onClick={() => handleCancelAbsence(shift.shift_id, shift.work_date, user?.id)}
                            className="btn btn-primary btn-sm"
                          >
                            Xác Nhận Có Mặt Lại
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#991b1b" }}>Đã nghỉ</span>
                        )
                      ) : isPending ? (
                        <button
                          onClick={() => handleCancelAbsence(shift.shift_id, shift.work_date, user?.id)}
                          style={{
                            background: "#fef3c7",
                            border: "1px solid #fde68a",
                            color: "#92400e",
                            borderRadius: 6,
                            padding: "6px 12px",
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                          title="Hủy đơn xin nghỉ này và xác nhận có mặt lại"
                        >
                          Hủy Đơn Vắng
                        </button>
                      ) : shift.work_date >= todayStr ? (
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
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL: DANH SÁCH TOÀN BỘ THÀNH VIÊN & ĐIỂM DANH (ROSTER MODAL) ================= */}
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
                  Danh Sách Thành Viên Ca Trực ({(() => {
                    const total = rosterModal.rosterList.length || totalMembers;
                    const absent = rosterModal.rosterList.filter(m => m.attendance_status === 'absent').length;
                    const present = Math.max(0, total - absent);
                    return `${present}/${total} Người Có Mặt`;
                  })()})
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
              {(() => {
                const total = rosterModal.rosterList.length || totalMembers;
                const absent = rosterModal.rosterList.filter(m => m.attendance_status === 'absent').length;
                const present = Math.max(0, total - absent);
                return (
                  <>
                    💡 <strong>Điểm danh ca trực:</strong> Hiện có <strong>{present}/{total} người có mặt</strong>
                    {absent > 0 ? (
                      <span style={{ color: "#dc2626", fontWeight: 700 }}> (⚠️ {absent} người vắng mặt)</span>
                    ) : (
                      <span style={{ color: "#16a34a", fontWeight: 700 }}> (đầy đủ tất cả thành viên)</span>
                    )}.
                  </>
                );
              })()}
            </div>

            {/* List of members */}
            {rosterModal.loading ? (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b" }}>
                Đang tải danh sách thành viên...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {rosterModal.rosterList.map((m, idx) => {
                  const isMe = m.user_id === user?.id;
                  const isPending = m.attendance_status === "pending_absence";
                  const isAbsent = m.attendance_status === "absent";
                  const isPresent = !isPending && !isAbsent;
                  const memberConflict = classConflicts.find(
                    (c) =>
                      c.shift_id === rosterModal.shift?.id &&
                      c.work_date === rosterModal.day?.dateStr &&
                      c.user_id === m.user_id
                  );

                  let tkbLabel = null;
                  if (memberConflict) {
                    const code = memberConflict.course_code || memberConflict.class_name || "LỚP";
                    const time = (memberConflict.class_time || `${memberConflict.start_time} - ${memberConflict.end_time}`).replace("-", "–");
                    tkbLabel = `🎓 TRÙNG TKB (${code}: ${time})`;
                  } else if (m.absence_reason && (m.absence_reason.includes("Trùng lịch học") || m.absence_reason.toLowerCase().includes("lịch học") || m.absence_reason.includes("TKB"))) {
                    const codeMatch = m.absence_reason.match(/Trùng lịch học:\s*([A-Za-z0-9_-]+)/);
                    const timeMatch = m.absence_reason.match(/\((\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2})\)/);
                    const code = codeMatch ? codeMatch[1].trim() : (m.time_note ? m.time_note.replace(/[^A-Za-z0-9]/g, "") : "TKB");
                    const time = timeMatch ? timeMatch[1].replace("-", "–").trim() : (rosterModal.shift?.label ? rosterModal.shift.label.replace("-", "–") : "08:00 – 09:30");
                    tkbLabel = `🎓 TRÙNG TKB (${code}: ${time})`;
                  } else if (m.time_note && m.time_note.includes("TKB")) {
                    const codeMatch = m.time_note.match(/Trùng TKB\s*([A-Za-z0-9_-]+)/);
                    const code = codeMatch ? codeMatch[1].trim() : "TKB";
                    const time = rosterModal.shift?.label ? rosterModal.shift.label.replace("-", "–") : "08:00 – 09:30";
                    tkbLabel = `🎓 TRÙNG TKB (${code}: ${time})`;
                  }

                  const isTkb = Boolean(tkbLabel);

                  let cardBg = "#ffffff";
                  let cardBorder = "1px solid #e2e8f0";
                  let cardShadow = "none";
                  let avatarBg = "#dbeafe";
                  let avatarColor = "#1d4ed8";

                  if (isTkb) {
                    // Đăng ký TKB lịch học -> khung đỏ bỰ (giống vắng)
                    cardBg = "#fef2f2";
                    cardBorder = "3px solid #ef4444";
                    cardShadow = "0 4px 16px rgba(239, 68, 68, 0.25)";
                    avatarBg = "#fee2e2";
                    avatarColor = "#dc2626";
                  } else if (isPending) {
                    // Báo vắng chờ duyệt -> khung cam bự
                    cardBg = "#fff1f2";
                    cardBorder = "3px solid #f97316";
                    cardShadow = "0 4px 16px rgba(249, 115, 22, 0.25)";
                    avatarBg = "#ffedd5";
                    avatarColor = "#c2410c";
                  } else if (isAbsent) {
                    // Vắng mặt đã duyệt -> khung đỏ BỰ rõ ràng
                    cardBg = "#fef2f2";
                    cardBorder = "3px solid #ef4444";
                    cardShadow = "0 4px 16px rgba(239, 68, 68, 0.30)";
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
                                color: (isAbsent || isTkb) ? "#991b1b" : isPending ? "#92400e" : "#0f172a",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                flexWrap: "wrap",
                              }}
                            >
                              <span>
                                {m.full_name} {isMe && "(Tôi)"}
                              </span>

                              {/* 1. Badge Trùng TKB - đỏ */}
                              {isTkb && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: "#ef4444",
                                    color: "#ffffff",
                                    border: "none",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    boxShadow: "0 1px 3px rgba(239,68,68,0.3)",
                                  }}
                                >
                                  {tkbLabel}
                                </span>
                              )}

                              {/* 2. Badge Trạng thái Có Mặt */}
                              {(isTkb || isPresent) && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: "#dcfce7",
                                    color: "#166534",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  🟢 Có mặt
                                </span>
                              )}

                              {!isTkb && isPending && (
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
                              {!isTkb && isAbsent && (
                                <>
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
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 800,
                                      background: "#fee2e2",
                                      color: "#991b1b",
                                      border: "1px solid #fca5a5",
                                      padding: "2px 8px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    ⏱️ 0h / 1.5h (-1.5h KPI)
                                  </span>
                                </>
                              )}
                              {isPresent && !isTkb && m.actual_hours !== null && m.actual_hours !== undefined && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    background: Number(m.actual_hours) < 1.5 ? "#fff7ed" : "#f0fdf4",
                                    color: Number(m.actual_hours) < 1.5 ? "#c2410c" : "#15803d",
                                    border: `1.5px solid ${Number(m.actual_hours) < 1.5 ? "#fdba74" : "#86efac"}`,
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4
                                  }}
                                  title={m.time_note ? `Ghi chú: ${m.time_note}` : ""}
                                >
                                  ⏱️ {Number(m.actual_hours)}h / 1.5h
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              {m.department || "Tổ Trực Kỹ Thuật"} • {m.phone || m.email || "0364560410"}
                              {isAbsent && m.approved_by_name && (
                                <span style={{ marginLeft: 6, color: "#b91c1c", fontWeight: 600 }}>
                                  • Đã duyệt bởi: <strong>{m.approved_by_name}</strong>
                                </span>
                              )}
                              {!isTkb && m.time_note && (!m.absence_reason || !m.absence_reason.includes(m.time_note)) && (
                                <div style={{ color: "#d97706", fontWeight: 700, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                  💬 <span>Ghi chú giờ: {m.time_note}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons based on Role */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* 1. If Staff is current logged-in user and PRESENT -> button to report absence */}
                          {isMe && isPresent && rosterModal.day?.dateStr >= todayStr && (
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

                          {/* 1b. If Admin and user is PRESENT -> button to Mark Absent / Missed Shift */}
                          {isStrictAdmin && isPresent && (
                            <button
                              onClick={() => handleAdminMarkAbsent(m)}
                              style={{
                                background: "#fff1f2",
                                border: "1px solid #fecaca",
                                color: "#b91c1c",
                                borderRadius: 6,
                                padding: "5px 10px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              title="Đánh dấu nhân viên này không đi làm / bỏ ca trực (sẽ trừ KPI)"
                            >
                              ❌ Đánh dấu vắng
                            </button>
                          )}
                          {isAdmin && isPresent && (
                            <button
                              type="button"
                              onClick={() => openEditHours(m)}
                              style={{
                                background: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                color: "#1d4ed8",
                                borderRadius: 6,
                                padding: "5px 10px",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                              title="Chỉnh sửa số giờ làm thực tế nếu nhân viên đi muộn, về sớm hoặc làm thiếu giờ"
                            >
                              ⏱️ Chỉnh giờ làm
                            </button>
                          )}

                          {/* 2. If Staff has PENDING request */}
                          {isPending && (
                            <>
                              {/* Manager: Approve or Reject buttons - CHỈ ADMIN MỚI ĐƯỢC DUYỆT VẮNG */}
                              {isStrictAdmin ? (
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
                              ) : (
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fef3c7", padding: "4px 8px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  ⏳ Chờ Quản trị viên / Leader duyệt vắng
                                </span>
                              )}

                              {/* Staff themselves: Cancel their request */}
                              {isMe && !isStrictAdmin && (
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
                                <div style={{ display: "flex", gap: 6 }}>
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
                                  <button
                                    type="button"
                                    onClick={() => openEditHours(m)}
                                    style={{
                                      background: "#eff6ff",
                                      border: "1px solid #bfdbfe",
                                      color: "#1d4ed8",
                                      borderRadius: 6,
                                      padding: "5px 10px",
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                    title="Chỉnh sửa số giờ làm thực tế nếu nhân viên có đi làm một phần"
                                  >
                                    ⏱️ Chỉnh giờ
                                  </button>
                                </div>
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
              maxWidth: 560,
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
                <div style={{ fontSize: 12, color: "#991b1b", fontWeight: 700 }}>Nhân viên xin nghỉ vắng:</div>
                {isAdmin ? (
                  <div style={{ marginTop: 4 }}>
                    <select
                      value={reportAbsenceModal.targetUser?.id || ""}
                      onChange={(e) => {
                        const selId = Number(e.target.value);
                        const sel = allMembers.find((m) => m.id === selId) || user;
                        setReportAbsenceModal((prev) => ({ ...prev, targetUser: sel }));
                      }}
                      className="form-control"
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: "#991b1b",
                        background: "#ffffff",
                        borderColor: "#fca5a5",
                        borderRadius: 6,
                        padding: "6px 10px",
                        width: "100%",
                      }}
                    >
                      {allMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name || m.username} (@{m.username}) {m.id === user?.id ? "— (Quản trị viên)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#7f1d1d", marginTop: 2 }}>
                    {reportAbsenceModal.targetUser?.full_name || user?.full_name}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#991b1b", marginTop: 6 }}>
                  Ca: <strong>{reportAbsenceModal.shiftName}</strong> (
                  {reportAbsenceModal.shiftLabel}) • Ngày:{" "}
                  <strong>{reportAbsenceModal.workDate}</strong>
                </div>
                <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 6, fontStyle: "italic" }}>
                  💡 Đơn xin nghỉ chỉ áp dụng cho riêng nhân sự này. Các nhân sự khác trong ca vẫn làm việc bình thường.
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
                            {ev.duration_type === "week" ? (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "#ede9fe",
                                  color: "#6d28d9",
                                  border: "1px solid #ddd6fe",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                🗓️ {ev.repeat_rule || "Trong 1 tuần"}
                              </span>
                            ) : ev.duration_type === "month" ? (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "#dbeafe",
                                  color: "#1d4ed8",
                                  border: "1px solid #bfdbfe",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                📅 {ev.repeat_rule || "Cả tháng"}
                              </span>
                            ) : ev.duration_type === "custom" ? (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "#fef3c7",
                                  color: "#b45309",
                                  border: "1px solid #fde68a",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                ⏳ {ev.repeat_rule || `${ev.work_date} → ${ev.end_date}`}
                              </span>
                            ) : null}
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteEvent(ev)}
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
            {/* ================= MODAL CHỈNH GIỜ LÀM THỰC TẾ ================= */}
      {editingHoursModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10003,
            padding: 16,
          }}
          onClick={() => setEditingHoursModal((prev) => ({ ...prev, open: false }))}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #e2e8f0",
              maxWidth: 460,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
              animation: "fadeIn 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
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
                ⏱️ Ghi Nhận Giờ Làm Thực Tế
              </h3>
              <button
                onClick={() => setEditingHoursModal((prev) => ({ ...prev, open: false }))}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveActualHours}>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
                <div><strong>Nhân sự:</strong> {editingHoursModal.member?.full_name} (@{editingHoursModal.member?.username})</div>
                <div style={{ marginTop: 3 }}><strong>Ca làm việc:</strong> {editingHoursModal.shift?.name} ({editingHoursModal.shift?.label})</div>
                <div style={{ marginTop: 3 }}><strong>Ngày trực:</strong> {editingHoursModal.day?.dateStr}</div>
                <div style={{ marginTop: 3, color: "#2563eb" }}>
                  <strong>Thời lượng chuẩn của ca:</strong> 1.5 giờ (90 phút)
                </div>
              </div>

              {/* Quick choices */}
              <div style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, display: "block" }}>
                  Chọn nhanh số giờ làm thực tế:
                </label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setEditingHoursModal((prev) => ({ ...prev, actual_hours: 1.5, time_note: "" }))}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: Number(editingHoursModal.actual_hours) === 1.5 ? "#16a34a" : "#cbd5e1",
                      background: Number(editingHoursModal.actual_hours) === 1.5 ? "#dcfce7" : "#ffffff",
                      color: Number(editingHoursModal.actual_hours) === 1.5 ? "#15803d" : "#334155",
                    }}
                  >
                    Đủ ca (1.5h)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingHoursModal((prev) => ({ ...prev, actual_hours: 1.0, time_note: "Đi muộn hoặc về sớm 30 phút" }))}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: Number(editingHoursModal.actual_hours) === 1.0 ? "#ea580c" : "#cbd5e1",
                      background: Number(editingHoursModal.actual_hours) === 1.0 ? "#fff7ed" : "#ffffff",
                      color: Number(editingHoursModal.actual_hours) === 1.0 ? "#c2410c" : "#334155",
                    }}
                  >
                    1.0h (Thiếu 30p)
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingHoursModal((prev) => ({ ...prev, actual_hours: 0.5, time_note: "Chỉ trực 30 phút" }))}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: Number(editingHoursModal.actual_hours) === 0.5 && editingHoursModal.shift?.id !== 8 ? "#ea580c" : "#cbd5e1",
                      background: Number(editingHoursModal.actual_hours) === 0.5 && editingHoursModal.shift?.id !== 8 ? "#fff7ed" : "#ffffff",
                      color: Number(editingHoursModal.actual_hours) === 0.5 && editingHoursModal.shift?.id !== 8 ? "#c2410c" : "#334155",
                    }}
                  >
                    0.5h (Thiếu 1h)
                  </button>
                </div>
              </div>

              {/* Number Input */}
              <div style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Số giờ làm thực tế được ghi nhận (*):
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    required
                    value={editingHoursModal.actual_hours}
                    onChange={(e) => setEditingHoursModal((prev) => ({ ...prev, actual_hours: e.target.value }))}
                    className="form-control"
                    style={{ fontWeight: 700, width: 120 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>giờ (h)</span>
                  {Number(editingHoursModal.actual_hours) < 1.5 && (
                    <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>
                      ⚠️ Trực thiếu {(1.5 - Number(editingHoursModal.actual_hours)).toFixed(1)}h
                    </span>
                  )}
                </div>
              </div>

              {/* Reason / Note input */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: 12 }}>
                  Lý do / Ghi chú (tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Vào muộn 30p do kẹt xe, Về sớm 15p..."
                  value={editingHoursModal.time_note}
                  onChange={(e) => setEditingHoursModal((prev) => ({ ...prev, time_note: e.target.value }))}
                  className="form-control"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingHoursModal((prev) => ({ ...prev, open: false }))}
                  className="btn btn-secondary btn-sm"
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
                  ✓ Lưu Giờ Làm Thực Tế
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: THÊM SỰ KIỆN MỚI (PHONG CÁCH APPLE IPHONE CALENDAR) ================= */}
      {createEventModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.4)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: "16px 12px",
          }}
          onClick={() => setCreateEventModal((prev) => ({ ...prev, open: false }))}
        >
          <div
            style={{
              background: "#f2f2f7",
              borderRadius: 22,
              border: "1px solid rgba(0, 0, 0, 0.08)",
              maxWidth: 520,
              width: "100%",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.2) inset",
              display: "flex",
              flexDirection: "column",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* iOS NAVIGATION BAR */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "0.5px solid rgba(60, 60, 67, 0.18)",
                background: "rgba(242, 242, 247, 0.95)",
                position: "sticky",
                top: 0,
                zIndex: 10,
                backdropFilter: "blur(10px)",
              }}
            >
              <button
                type="button"
                onClick={() => setCreateEventModal((prev) => ({ ...prev, open: false }))}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#007aff",
                  fontSize: 17,
                  fontWeight: 400,
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                Hủy
              </button>

              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: 17, fontWeight: 600, color: "#000000" }}>
                  Sự kiện mới
                </span>
              </div>

              <button
                type="button"
                onClick={handleCreateEventSubmit}
                disabled={!createEventModal.title.trim()}
                style={{
                  background: "transparent",
                  border: "none",
                  color: createEventModal.title.trim() ? "#007aff" : "#8e8e93",
                  fontSize: 17,
                  fontWeight: 600,
                  cursor: createEventModal.title.trim() ? "pointer" : "default",
                  padding: 0,
                  opacity: createEventModal.title.trim() ? 1 : 0.45,
                  transition: "color 0.15s, opacity 0.15s",
                }}
              >
                Thêm
              </button>
            </div>

            <form onSubmit={handleCreateEventSubmit} style={{ padding: "16px 16px 24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* GROUP 1: TIÊU ĐỀ & PHÂN LOẠI */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                  overflow: "hidden",
                }}
              >
                {/* Tiêu đề */}
                <div style={{ padding: "12px 16px" }}>
                  <input
                    type="text"
                    required
                    placeholder="Tiêu đề"
                    value={createEventModal.title}
                    onChange={(e) => setCreateEventModal((prev) => ({ ...prev, title: e.target.value }))}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      fontSize: 17,
                      fontWeight: 500,
                      color: "#000000",
                      background: "transparent",
                      boxSizing: "border-box",
                    }}
                    autoFocus
                  />
                </div>

                <div style={{ height: "0.5px", background: "#e5e5ea", marginLeft: 16 }} />

                {/* Phân loại sự kiện (iOS tag selector) */}
                <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontSize: 15, color: "#000000" }}>Phân loại</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[
                      { key: "meeting", label: "Họp", color: "#7c3aed", bg: "#f5f3ff" },
                      { key: "task", label: "Nhiệm vụ", color: "#0284c7", bg: "#f0f9ff" },
                      { key: "maintenance", label: "Bảo trì", color: "#ea580c", bg: "#fff7ed" },
                      { key: "handover", label: "Bàn giao", color: "#059669", bg: "#ecfdf5" },
                      { key: "general", label: "Chung", color: "#475569", bg: "#f8fafc" },
                    ].map((type) => {
                      const isSelected = createEventModal.event_type === type.key;
                      return (
                        <button
                          key={type.key}
                          type="button"
                          onClick={() => setCreateEventModal((prev) => ({ ...prev, event_type: type.key }))}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 9px",
                            borderRadius: 16,
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 500,
                            border: isSelected ? `1.5px solid ${type.color}` : "1.5px solid transparent",
                            background: isSelected ? type.bg : "#f2f2f7",
                            color: isSelected ? type.color : "#636366",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: type.color,
                            }}
                          />
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* GROUP 2: THỜI GIAN (CẢ NGÀY, BẮT ĐẦU, KẾT THÚC, GỢI Ý NHANH) */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                  overflow: "hidden",
                }}
              >
                {/* Hàng 1: Switch Cả ngày */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                  }}
                >
                  <span style={{ fontSize: 16, color: "#000000" }}>Cả ngày</span>
                  {/* Apple iOS Switch Toggle */}
                  <div
                    onClick={() => {
                      setCreateEventModal((prev) => {
                        const nextAll = !prev.all_shifts;
                        return {
                          ...prev,
                          all_shifts: nextAll,
                          selected_shifts: nextAll ? [0] : [1],
                          shift_id: nextAll ? 0 : 1,
                        };
                      });
                    }}
                    style={{
                      width: 50,
                      height: 30,
                      borderRadius: 30,
                      background: createEventModal.all_shifts ? "#34c759" : "#e5e5ea",
                      cursor: "pointer",
                      position: "relative",
                      transition: "background 0.25s ease",
                      boxShadow: "inset 0 0 1px rgba(0,0,0,0.2)",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 2,
                        left: createEventModal.all_shifts ? 22 : 2,
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: "#ffffff",
                        boxShadow: "0 2px 5px rgba(0,0,0,0.25)",
                        transition: "left 0.25s ease",
                      }}
                    />
                  </div>
                </div>

                <div style={{ height: "0.5px", background: "#e5e5ea", marginLeft: 16 }} />

                {/* Hàng 2: Bắt đầu */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                  }}
                >
                  <span style={{ fontSize: 16, color: "#000000" }}>Bắt đầu</span>
                  <input
                    type="date"
                    value={createEventModal.work_date || ""}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setCreateEventModal((prev) => {
                        let newEnd = prev.end_date;
                        if (!newEnd || newEnd < newStart) newEnd = newStart;
                        return { ...prev, work_date: newStart, end_date: newEnd };
                      });
                    }}
                    style={{
                      border: "none",
                      background: "rgba(118, 118, 128, 0.12)",
                      color: "#007aff",
                      padding: "5px 10px",
                      borderRadius: 8,
                      fontSize: 15,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ height: "0.5px", background: "#e5e5ea", marginLeft: 16 }} />

                {/* Hàng 3: Kết thúc */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 16px",
                  }}
                >
                  <span style={{ fontSize: 16, color: "#000000" }}>Kết thúc</span>
                  <input
                    type="date"
                    value={createEventModal.end_date || createEventModal.work_date || ""}
                    min={createEventModal.work_date || ""}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setCreateEventModal((prev) => ({
                        ...prev,
                        end_date: newEnd >= prev.work_date ? newEnd : prev.work_date,
                      }));
                    }}
                    style={{
                      border: "none",
                      background: "rgba(118, 118, 128, 0.12)",
                      color: "#007aff",
                      padding: "5px 10px",
                      borderRadius: 8,
                      fontSize: 15,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ height: "0.5px", background: "#e5e5ea", marginLeft: 16 }} />

                {/* Hàng 4: Gợi ý thời lượng (1 ngày, trong 1 tuần, cả tháng) */}
                <div style={{ padding: "10px 16px", background: "rgba(242, 242, 247, 0.4)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.4 }}>
                    Gợi ý thời lượng
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {/* Hôm nay */}
                    <button
                      type="button"
                      onClick={() => {
                        const today = formatLocalDate(new Date());
                        setCreateEventModal((prev) => ({
                          ...prev,
                          work_date: today,
                          end_date: today,
                          duration_type: "day",
                        }));
                      }}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        background: (createEventModal.work_date === createEventModal.end_date) ? "#e8f2ff" : "#ffffff",
                        color: (createEventModal.work_date === createEventModal.end_date) ? "#007aff" : "#1c1c1e",
                        cursor: "pointer",
                      }}
                    >
                      1 ngày (Hôm nay)
                    </button>

                    {/* Trong 1 tuần (Thứ 2 - Chủ nhật) */}
                    <button
                      type="button"
                      onClick={() => {
                        const base = createEventModal.work_date ? parseLocalDate(createEventModal.work_date) : new Date();
                        const mon = getMonday(base);
                        const sunObj = parseLocalDate(mon);
                        sunObj.setDate(sunObj.getDate() + 6);
                        const sun = formatLocalDate(sunObj);
                        setCreateEventModal((prev) => ({
                          ...prev,
                          work_date: mon,
                          end_date: sun,
                          duration_type: "week",
                        }));
                      }}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        background: (createEventModal.duration_type === "week") ? "#e8f2ff" : "#ffffff",
                        color: (createEventModal.duration_type === "week") ? "#007aff" : "#1c1c1e",
                        cursor: "pointer",
                      }}
                    >
                      🗓️ Trong 1 tuần (T2 - CN)
                    </button>

                    {/* Tuần tiếp theo */}
                    <button
                      type="button"
                      onClick={() => {
                        const base = createEventModal.work_date ? parseLocalDate(createEventModal.work_date) : new Date();
                        const mon = parseLocalDate(getMonday(base));
                        mon.setDate(mon.getDate() + 7);
                        const nextMon = formatLocalDate(mon);
                        const sunObj = parseLocalDate(nextMon);
                        sunObj.setDate(sunObj.getDate() + 6);
                        const nextSun = formatLocalDate(sunObj);
                        setCreateEventModal((prev) => ({
                          ...prev,
                          work_date: nextMon,
                          end_date: nextSun,
                          duration_type: "week",
                        }));
                      }}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        background: "#ffffff",
                        color: "#1c1c1e",
                        cursor: "pointer",
                      }}
                    >
                      Tuần sau
                    </button>

                    {/* Cả tháng này */}
                    <button
                      type="button"
                      onClick={() => {
                        const base = createEventModal.work_date ? parseLocalDate(createEventModal.work_date) : new Date();
                        const y = base.getFullYear();
                        const m = base.getMonth() + 1;
                        const lastDay = new Date(y, m, 0).getDate();
                        const mStart = `${y}-${String(m).padStart(2, "0")}-01`;
                        const mEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                        setCreateEventModal((prev) => ({
                          ...prev,
                          work_date: mStart,
                          end_date: mEnd,
                          duration_type: "month",
                        }));
                      }}
                      style={{
                        padding: "5px 11px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        border: "1px solid rgba(0, 0, 0, 0.08)",
                        background: (createEventModal.duration_type === "month") ? "#e8f2ff" : "#ffffff",
                        color: (createEventModal.duration_type === "month") ? "#007aff" : "#1c1c1e",
                        cursor: "pointer",
                      }}
                    >
                      📅 Cả tháng (Tháng ${createEventModal.work_date ? parseLocalDate(createEventModal.work_date).getMonth() + 1 : new Date().getMonth() + 1})
                    </button>
                  </div>
                </div>
              </div>

              {/* GROUP 3: PHẠM VI CA LÀM VIỆC (NẾU KHÔNG PHẢI CẢ NGÀY) */}
              {!createEventModal.all_shifts && (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: 12,
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                    padding: "12px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#000000" }}>Chọn các ca áp dụng</span>
                    <div style={{ display: "flex", gap: 5 }}>
                      {[
                        { label: "Sáng (1-3)", shifts: [1, 2, 3] },
                        { label: "Chiều (4-6)", shifts: [4, 5, 6] },
                        { label: "Tối (7-9)", shifts: [7, 8, 9] },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleSelectShiftPreset(preset.shifts)}
                          style={{
                            fontSize: 12,
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "1px solid #d1d1d6",
                            background: "#f2f2f7",
                            color: "#007aff",
                            cursor: "pointer",
                            fontWeight: 500,
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Danh sách 9 ca */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                    {SHIFTS.map((s) => {
                      const isSel = createEventModal.selected_shifts?.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleToggleShiftSelection(s.id)}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: isSel ? 600 : 500,
                            border: isSel ? "1.5px solid #007aff" : "1px solid #e5e5ea",
                            background: isSel ? "#e8f2ff" : "#f9f9fb",
                            color: isSel ? "#007aff" : "#1c1c1e",
                            cursor: "pointer",
                            textAlign: "center",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GROUP 4: GHI CHÚ */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                  overflow: "hidden",
                }}
              >
                <textarea
                  placeholder="Ghi chú thêm..."
                  value={createEventModal.description}
                  onChange={(e) => setCreateEventModal((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    padding: "12px 16px",
                    fontSize: 16,
                    color: "#000000",
                    background: "transparent",
                    resize: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* FOOTER PREVIEW SUMMARY */}
              {getDurationEventPreview(createEventModal) && (
                <div style={{ textAlign: "center", padding: "0 8px" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#8e8e93", lineHeight: 1.4 }}>
                    {getDurationEventPreview(createEventModal)}
                    {createEventModal.all_shifts
                      ? " • Toàn bộ ca trong ngày"
                      : ` • Ca: ${createEventModal.selected_shifts?.join(", ") || "Chưa chọn"}`}
                  </p>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CHỌN HÌNH THỨC XÓA SỰ KIỆN ĐỊNH KỲ ================= */}
      {deleteRecurringModal.open && deleteRecurringModal.event && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
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
              maxWidth: 480,
              width: "100%",
              padding: "24px 26px",
              boxShadow: "0 20px 40px -10px rgba(15, 23, 42, 0.25)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#dc2626",
                  fontSize: 22,
                }}
              >
                🗑️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>
                  Xóa sự kiện định kỳ
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b", marginTop: 2 }}>
                  Sự kiện: <strong style={{ color: "#1e293b" }}>{deleteRecurringModal.event.title}</strong>
                </p>
              </div>
            </div>

            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 18,
                fontSize: 13,
                color: "#92400e",
                lineHeight: 1.5,
              }}
            >
              Đây là sự kiện nằm trong chuỗi lặp lại ({deleteRecurringModal.event.repeat_rule || (deleteRecurringModal.event.repeat_type === "weekly" ? "Hàng tuần" : "Hàng tháng")}). Bạn muốn áp dụng thay đổi này như thế nào?
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => handleDeleteEvent(deleteRecurringModal.event, false, true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  background: "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#94a3b8";
                  e.currentTarget.style.background = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                    🗓️ Chỉ xóa ngày này ({deleteRecurringModal.event.work_date || "Hôm nay"})
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Các sự kiện ở các ngày khác trong chuỗi định kỳ vẫn được giữ nguyên
                  </div>
                </div>
                <span style={{ fontSize: 18, color: "#94a3b8" }}>›</span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteEvent(deleteRecurringModal.event, true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "1.5px solid #fca5a5",
                  background: "#fef2f2",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#ef4444";
                  e.currentTarget.style.background = "#fee2e2";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#fca5a5";
                  e.currentTarget.style.background = "#fef2f2";
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#dc2626" }}>
                    🔁 Xóa toàn bộ chuỗi sự kiện định kỳ
                  </div>
                  <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>
                    Xóa tất cả các lần lặp của sự kiện này ở quá khứ và tương lai
                  </div>
                </div>
                <span style={{ fontSize: 18, color: "#dc2626" }}>›</span>
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setDeleteRecurringModal({ open: false, event: null })}
                style={{
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Đóng / Giữ lại sự kiện
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: TỔNG QUAN SỰ KIỆN & CHUỖI ĐỊNH KỲ ================= */}
      {allEventsModal.open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
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
              maxWidth: 720,
              width: "100%",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #7c3aed, #6366f1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                  }}
                >
                  <Calendar size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                    Quản Lý Sự Kiện Ca Trực
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                    Theo dõi sự kiện trong tuần & quản lý các chuỗi sự kiện định kỳ
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setAllEventsModal({ open: false, tab: "week" });
                      openCreateEventModal(currentDate);
                    }}
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #6366f1)",
                      color: "#ffffff",
                      border: "none",
                      padding: "6px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                    }}
                  >
                    <Plus size={14} />
                    Tạo sự kiện
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAllEventsModal({ open: false, tab: "week" })}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#64748b",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f8fafc", padding: "0 24px" }}>
              <button
                type="button"
                onClick={() => setAllEventsModal((prev) => ({ ...prev, tab: "week" }))}
                style={{
                  padding: "12px 18px",
                  fontSize: 13,
                  fontWeight: allEventsModal.tab === "week" ? 800 : 600,
                  color: allEventsModal.tab === "week" ? "#7c3aed" : "#64748b",
                  borderBottom: allEventsModal.tab === "week" ? "2px solid #7c3aed" : "2px solid transparent",
                  background: "transparent",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>📅 Sự kiện tuần này</span>
                <span
                  style={{
                    background: allEventsModal.tab === "week" ? "#ede9fe" : "#e2e8f0",
                    color: allEventsModal.tab === "week" ? "#6d28d9" : "#64748b",
                    padding: "1px 7px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {weekEvents.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAllEventsModal((prev) => ({ ...prev, tab: "multiday" }))}
                style={{
                  padding: "12px 18px",
                  fontSize: 13,
                  fontWeight: allEventsModal.tab === "multiday" ? 800 : 600,
                  color: allEventsModal.tab === "multiday" ? "#7c3aed" : "#64748b",
                  borderBottom: allEventsModal.tab === "multiday" ? "2px solid #7c3aed" : "2px solid transparent",
                  background: "transparent",
                  borderTop: "none",
                  borderLeft: "none",
                  borderRight: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>🗓️ Sự kiện 1 tuần & cả tháng</span>
                <span
                  style={{
                    background: allEventsModal.tab === "multiday" ? "#ede9fe" : "#e2e8f0",
                    color: allEventsModal.tab === "multiday" ? "#6d28d9" : "#64748b",
                    padding: "1px 7px",
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {multiDayEvents.length}
                </span>
              </button>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              {allEventsModal.tab === "week" && (
                <>
                  {weekEvents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                      <Calendar size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>
                        Không có sự kiện nào trong tuần này
                      </div>
                      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                        Tuần làm việc diễn ra bình thường theo lịch trực đã phân bổ
                      </div>
                    </div>
                  ) : (
                    weekEvents.map((ev) => {
                      const badge = getEventTypeBadge(ev.event_type);
                      const shiftName = ev.shift_id === 0 ? "Toàn bộ ca trong ngày" : `Ca ${ev.shift_id}`;
                      return (
                        <div
                          key={ev.id}
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: 12,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 12,
                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  background: badge.bg,
                                  color: badge.color,
                                  border: `1px solid ${badge.border}`,
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {badge.icon} {badge.label}
                              </span>

                              <span
                                style={{
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                📅 {ev.work_date || "Toàn tuần"} • {shiftName}
                              </span>

                              {ev.duration_type === "week" ? (
                                <span
                                  style={{
                                    background: "#ede9fe",
                                    color: "#6d28d9",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  🗓️ Trong 1 tuần
                                </span>
                              ) : ev.duration_type === "month" ? (
                                <span
                                  style={{
                                    background: "#dbeafe",
                                    color: "#1d4ed8",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  📅 Cả tháng
                                </span>
                              ) : ev.duration_type === "custom" ? (
                                <span
                                  style={{
                                    background: "#fef3c7",
                                    color: "#b45309",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  ⏳ Khoảng ngày
                                </span>
                              ) : null}
                            </div>

                            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                              {ev.title}
                            </div>

                            {ev.description && (
                              <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.4 }}>
                                {ev.description}
                              </div>
                            )}
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(ev)}
                              title="Xóa sự kiện này"
                              style={{
                                background: "#fef2f2",
                                color: "#dc2626",
                                border: "1px solid #fee2e2",
                                borderRadius: 8,
                                padding: "6px 10px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 12,
                                fontWeight: 700,
                                flexShrink: 0,
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Trash2 size={13} />
                              Xóa
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {allEventsModal.tab === "multiday" && (
                <>
                  {multiDayEvents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                      <Calendar size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
                      <div style={{ fontSize: 15, fontWeight: 700, color: "#334155" }}>
                        Chưa có sự kiện nào diễn ra trong 1 tuần hoặc cả tháng
                      </div>
                      <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                        Khi tạo sự kiện mới, bạn có thể chọn tab "Trong 1 tuần" hoặc "Cả tháng"
                      </div>
                    </div>
                  ) : (
                    multiDayEvents.map((ev) => {
                      const badge = getEventTypeBadge(ev.event_type);
                      const isMonth = ev.duration_type === "month";
                      const isWeek = ev.duration_type === "week";
                      return (
                        <div
                          key={ev.id}
                          style={{
                            background: "#ffffff",
                            border: isMonth ? "1.5px solid #bfdbfe" : "1.5px solid #ddd6fe",
                            borderRadius: 12,
                            padding: "16px 18px",
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 14,
                            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.03)",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span
                                style={{
                                  background: isMonth ? "#eff6ff" : "#f5f3ff",
                                  color: isMonth ? "#1d4ed8" : "#6d28d9",
                                  border: `1px solid ${isMonth ? "#bfdbfe" : "#ddd6fe"}`,
                                  padding: "3px 9px",
                                  borderRadius: 8,
                                  fontSize: 11.5,
                                  fontWeight: 800,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                {isMonth ? "📅 Cả tháng" : isWeek ? "🗓️ Trong 1 tuần" : "⏳ Khoảng ngày"}
                              </span>

                              <span
                                style={{
                                  background: badge.bg,
                                  color: badge.color,
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                }}
                              >
                                {badge.icon} {badge.label}
                              </span>

                              <span
                                style={{
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {ev.shift_id === 0 ? "🌟 Áp dụng cả ngày" : `Ca ${ev.shift_id}`}
                              </span>
                            </div>

                            <div style={{ fontSize: 15, fontWeight: 800, color: "#1e293b" }}>
                              {ev.title}
                            </div>

                            {ev.description && (
                              <div style={{ fontSize: 12.5, color: "#64748b", lineHeight: 1.4 }}>
                                {ev.description}
                              </div>
                            )}

                            <div style={{ fontSize: 12, color: isMonth ? "#2563eb" : "#7c3aed", marginTop: 4, fontWeight: 600 }}>
                              🗓️ Thời gian diễn ra: Từ {ev.work_date} đến {ev.end_date || ev.work_date}
                            </div>
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(ev)}
                              style={{
                                background: "#fef2f2",
                                color: "#dc2626",
                                border: "1.5px solid #fecaca",
                                borderRadius: 8,
                                padding: "8px 12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                                fontWeight: 800,
                                flexShrink: 0,
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Trash2 size={14} />
                              Xóa sự kiện
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "14px 24px",
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setAllEventsModal({ open: false, tab: "week" })}
                style={{
                  background: "#ffffff",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  padding: "8px 20px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Đóng
              </button>
            </div>
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
                {/* TOOLBAR PHÊ DUYỆT TẤT CẢ / CHỌN HÀNG LOẠT */}
                {(() => {
                  const validRequests = pendingRequests.filter(r => isStrictAdmin || r.attendance_status !== "pending_absence");
                  const isAllSelected = validRequests.length > 0 && selectedPendingIds.length === validRequests.length;

                  return (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                        padding: "12px 16px",
                        background: "linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%)",
                        borderRadius: 10,
                        border: "1.5px solid #86efac",
                        boxShadow: "0 2px 6px rgba(16, 185, 129, 0.12)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        {validRequests.length > 0 && (
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              cursor: "pointer",
                              fontSize: 13,
                              fontWeight: 800,
                              color: "#0f172a",
                              userSelect: "none",
                              background: "#ffffff",
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: "1px solid #cbd5e1",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPendingIds(validRequests.map(r => r.id));
                                } else {
                                  setSelectedPendingIds([]);
                                }
                              }}
                              style={{ width: 17, height: 17, cursor: "pointer", accentColor: "#10b981" }}
                            />
                            <span>Chọn tất cả ({validRequests.length})</span>
                          </label>
                        )}
                        <span style={{ fontSize: 13, color: "#334155" }}>
                          Đang chờ: <strong style={{ color: "#0f172a" }}>{pendingRequests.length}</strong> yêu cầu
                          {validRequests.length > 0 && (
                            <> (Hợp lệ: <strong style={{ color: "#16a34a" }}>{validRequests.length}</strong>)</>
                          )}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {selectedPendingIds.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleApproveAll(selectedPendingIds)}
                            disabled={isBulkApproving}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              background: "#10b981",
                              border: "none",
                              color: "#ffffff",
                              fontWeight: 800,
                              fontSize: 13,
                              padding: "8px 16px",
                              borderRadius: 8,
                              boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)",
                              cursor: isBulkApproving ? "not-allowed" : "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            <CheckCheck size={17} />
                            {isBulkApproving ? "Đang phê duyệt..." : `Duyệt các mục đã chọn (${selectedPendingIds.length})`}
                          </button>
                        ) : validRequests.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleApproveAll(null)}
                            disabled={isBulkApproving}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              border: "none",
                              color: "#ffffff",
                              fontWeight: 800,
                              fontSize: 13,
                              padding: "8px 18px",
                              borderRadius: 8,
                              boxShadow: "0 3px 10px rgba(16, 185, 129, 0.4)",
                              cursor: isBulkApproving ? "not-allowed" : "pointer",
                              transition: "all 0.15s ease",
                            }}
                            title="Phê duyệt nhanh toàn bộ danh sách yêu cầu đang chờ duyệt mà không cần bấm từng mục"
                          >
                            <CheckCheck size={18} />
                            {isBulkApproving ? "Đang phê duyệt tất cả..." : `⚡ Phê Duyệt Tất Cả (${validRequests.length})`}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
                {(() => {
                  const todayStr = formatLocalDate(new Date());
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
                          Phát hiện <strong>{expiredCount}</strong> yêu cầu đã qua ngày ca trực. Bạn có thể Phê duyệt hoặc Từ chối từng ca, hoặc bấm chuyển tất cả sang Từ Chối.
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
                  const todayStr = formatLocalDate(new Date());
                  const isExpired = Boolean(req.is_expired || (req.work_date && req.work_date < todayStr));
                  const isCancel = req.status === "pending_cancel";
                  const isAbsence = req.attendance_status === "pending_absence";
                  const isSelected = selectedPendingIds.includes(req.id);
                  return (
                    <div
                      key={req.id}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: isSelected ? "#f0fdf4" : (isCancel ? "#fef2f2" : "#fffbeb"),
                        border: isSelected ? "2px solid #10b981" : (isCancel ? "1px solid #fecaca" : "1px solid #fde68a"),
                        boxShadow: isSelected ? "0 4px 12px rgba(16, 185, 129, 0.15)" : "none",
                        transition: "all 0.15s ease",
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {(isStrictAdmin || !isAbsence) && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPendingIds(prev => [...prev, req.id]);
                                } else {
                                  setSelectedPendingIds(prev => prev.filter(id => id !== req.id));
                                }
                              }}
                              style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#10b981" }}
                              title="Chọn để duyệt theo lô"
                            />
                          )}
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
                          isStrictAdmin ? (
                            <>
                              <button
                                onClick={() => handleApproveAbsence(req.shift_id, req.work_date, req.user_id, true, req.full_name)}
                                className="btn btn-primary btn-sm"
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  background: "#10b981",
                                  borderColor: "#10b981",
                                  fontWeight: 700,
                                }}
                              >
                                <Check size={14} /> Phê Duyệt Cho Vắng
                              </button>
                              <button
                                onClick={() => handleApproveAbsence(req.shift_id, req.work_date, req.user_id, false, req.full_name, isExpired ? "Từ chối do quá hạn ngày ca làm" : "")}
                                className="btn btn-danger btn-sm"
                                style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}
                              >
                                <X size={14} /> Từ Chối
                              </button>
                            </>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#d97706", background: "#fef3c7", padding: "4px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              ⏳ Đang chờ Quản trị viên / Leader xét duyệt
                            </span>
                          )
                        ) : (
                          <>
                            <button
                              onClick={() => handleAdminApprove(req.id, req.full_name, req.work_date)}
                              className="btn btn-primary btn-sm"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                background: "#10b981",
                                borderColor: "#10b981",
                                fontWeight: 700,
                              }}
                            >
                              <Check size={14} /> Phê Duyệt Ngay
                            </button>
                            <button
                              onClick={() => openRejectModal(req)}
                              className="btn btn-danger btn-sm"
                              style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 700 }}
                            >
                              <X size={14} /> Từ Chối
                            </button>
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
              đến {weekDays[weekDays.length - 1]?.displayDate}) đến từng nhân sự.
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
    
      

            {/* CLASS SCHEDULE MODAL (TKB SINH VIÊN & CẢNH BÁO TRÙNG LỊCH) */}
      <ClassScheduleModal
        isOpen={showClassScheduleModal}
        onClose={() => setShowClassScheduleModal(false)}
        currentUser={user}
        allMembers={allMembers}
        weekDays={weekDays}
        onSuccess={async (targetDate) => {
          try {
            await api.syncClassScheduleKpi();
          } catch (e) {
            console.error(e);
          }
          if (targetDate) {
            const d = new Date(targetDate + "T00:00:00");
            if (!isNaN(d.getTime())) {
              const dayOfWeek = d.getDay();
              const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
              const monday = new Date(d);
              monday.setDate(d.getDate() + diffToMonday);
              setMondayDate(monday);
              setActiveDay(targetDate);
            }
          }
          await fetchSchedule();
        }}
        showToast={showToast}
      />

      {/* BULK ABSENCE & RESTORE MODAL */}
      <BulkAbsenceModal
        isOpen={showBulkAbsenceModal}
        onClose={() => {
          setShowBulkAbsenceModal(false);
          setBulkAbsenceDate(null);
        }}
        currentUser={user}
        allMembers={allMembers}
        weekDays={weekDays}
        schedule={schedule}
        initialMode={bulkAbsenceMode}
        initialDate={bulkAbsenceDate}
        onSuccess={(msg) => {
          showToast(msg);
          fetchSchedule();
          if (isAdmin) fetchPendingRequests();
        }}
      />

      {/* KPI LEADERBOARD MODAL */}
      <KpiLeaderboardModal
        isOpen={showKpiModal}
        onClose={() => setShowKpiModal(false)}
        allMembers={allMembers}
        schedule={schedule}
        weekDays={weekDays}
        kpiTarget={20.0}
      />



    </div>
  );
}

export default SchedulePage;
