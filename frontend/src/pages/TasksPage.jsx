import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  CheckSquare,
  ListTodo,
  Clock,
  User,
  Users,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Send,
  Award,
  X,
  ChevronRight,
  Check,
  RotateCcw,
  PauseCircle,
  Edit3
} from "lucide-react";

function formatDeadline(deadlineStr) {
  if (!deadlineStr) return "Không có";
  try {
    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) return deadlineStr;
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${hours}:${minutes} • ${day}/${month}/${year}`;
  } catch {
    return deadlineStr;
  }
}

export function TasksPage() {
  const { user, isAdmin, isCore, isLeader, canManageTasks, canCreateRootTask, canManageSubtasks } = useAuth();
  const hasAdminRights = canCreateRootTask !== undefined ? canCreateRootTask : isAdmin;
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'my_tasks', 'needs_review', 'finished'
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [allMembers, setAllMembers] = useState([]);

  // Modals
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskDetail, setTaskDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showAddSubtaskModal, setShowAddSubtaskModal] = useState(false);
  const [reviewModalSubtask, setReviewModalSubtask] = useState(null); // { id, title, cp_points, mode: 'review' | 'penalty_direct' }
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPenaltyPoints, setReviewPenaltyPoints] = useState(1);
  const [reviewActionMode, setReviewActionMode] = useState("approve"); // 'approve' | 'rework' | 'penalty' 
  const [rejectModalSubtask, setRejectModalSubtask] = useState(null); // { id, title }
  const [editingSubtask, setEditingSubtask] = useState(null); // subtask object to edit
  const [editingTask, setEditingTask] = useState(null); // root task object to edit
  const [editTaskCpModal, setEditTaskCpModal] = useState(null); // { id, title, total_cp, ... }
  const [postponeModalTask, setPostponeModalTask] = useState(null);
  const [postponeReason, setPostponeReason] = useState("");
  const [toast, setToast] = useState({ text: "", type: "success" });

  const canEditTask = (t) => {
    if (!t) return false;
    return hasAdminRights || Boolean(user?.can_manage_tasks) || Number(t.leader_id) === Number(user?.id);
  };

  const showToast = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "success" }), 4000);
  };

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (activeTab === "my_tasks") params.filter = "my_tasks";
      else if (activeTab === "needs_review") params.filter = "needs_review";
      else if (activeTab === "finished") params.status = "FINISHED";
      else if (activeTab === "all") {
        // all
      }

      if (typeFilter !== "all") params.task_type = typeFilter;
      if (search.trim()) params.search = search.trim();

      const data = await api.getTasks(params);
      setTasks(data || []);
    } catch (err) {
      showToast("Lỗi khi tải danh sách nhiệm vụ: " + (err.message || ""), "danger");
    } finally {
      setLoading(false);
    }
  }, [activeTab, typeFilter, search]);

  // Fetch members for leader and assignees
  const fetchMembers = async () => {
    try {
      const data = await api.getUsers();
      setAllMembers(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchMembers();
  }, []);

  // Fetch detail of a task
  const openTaskDetail = async (task) => {
    setSelectedTask(task);
    setDetailLoading(true);
    try {
      const res = await api.getTaskDetail(task.id);
      setTaskDetail(res);
    } catch (err) {
      showToast("Lỗi tải chi tiết nhiệm vụ: " + (err.message || ""), "danger");
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshTaskDetail = async (taskId) => {
    try {
      const res = await api.getTaskDetail(taskId);
      setTaskDetail(res);
      if (res?.task) {
        setSelectedTask(res.task);
      }
      fetchTasks();
    } catch (err) {
      console.error(err);
    }
  };

  // Metrics
  const totalCount = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "OPEN").length;
  const needsReviewCount = tasks.reduce((sum, t) => sum + (t.review_subtasks_count || 0), 0);
  const finishedCount = tasks.filter((t) => t.status === "FINISHED").length;

  const getTypeBadge = (type) => {
    switch (type) {
      case "LAB_MAINTENANCE":
        return { label: "Bảo trì Lab", bg: "#ecfdf5", color: "#059669", border: "#a7f3d0" };
      case "EVENT":
        return { label: "Sự kiện / Workshop", bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" };
      case "INDUSTRY":
        return { label: "Dự án Doanh nghiệp", bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" };
      case "RESEARCH":
        return { label: "Nghiên cứu AI / Lab", bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" };
      default:
        return { label: "Khác", bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "OPEN":
        return { label: "Mới khởi tạo", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
      case "IN_PROGRESS":
        return { label: "Đang thực hiện", bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
      case "FINISHED":
        return { label: "Đã hoàn thành", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
      case "POSTPONED":
        return { label: "Tạm hoãn", bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" };
      default:
        return { label: status, bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
    }
  };

  // Actions
  const handleFinishTask = async (taskId) => {
    if (!window.confirm("Bạn có chắc chắn muốn nghiệm thu và kết thúc toàn bộ nhiệm vụ này?")) return;
    try {
      const res = await api.finishTask(taskId);
      showToast(res.message || "Đã hoàn thành nhiệm vụ thành công!");
      refreshTaskDetail(taskId);
    } catch (err) {
      showToast(err.message || "Không thể hoàn thành nhiệm vụ.", "danger");
    }
  };

  const handlePostponeTask = async () => {
    if (!postponeReason.trim()) {
      showToast("Vui lòng nhập lý do tạm hoãn!", "danger");
      return;
    }
    try {
      const res = await api.postponeTask(postponeModalTask.id, postponeReason.trim());
      showToast(res.message || "Đã tạm hoãn nhiệm vụ.");
      setPostponeModalTask(null);
      setPostponeReason("");
      fetchTasks();
      if (selectedTask?.id === postponeModalTask.id) {
        refreshTaskDetail(postponeModalTask.id);
      }
    } catch (err) {
      showToast(err.message || "Lỗi khi tạm hoãn nhiệm vụ.", "danger");
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("CẢNH BÁO: Xóa nhiệm vụ sẽ xóa toàn bộ các mục checklist và phân công liên quan. Bạn có chắc chắn?")) return;
    try {
      const res = await api.deleteTask(taskId);
      showToast(res.message || "Đã xóa nhiệm vụ thành công.");
      setSelectedTask(null);
      setTaskDetail(null);
      fetchTasks();
    } catch (err) {
      showToast(err.message || "Lỗi khi xóa nhiệm vụ.", "danger");
    }
  };

  const handleSubmitSubtask = async (subtaskId) => {
    try {
      const res = await api.submitSubtask(subtaskId);
      showToast(res.message || "Đã nộp duyệt mục việc thành công!");
      if (taskDetail) refreshTaskDetail(taskDetail.task.id);
    } catch (err) {
      showToast(err.message || "Lỗi khi nộp duyệt.", "danger");
    }
  };

  const handleAcceptSubtask = async (subtaskId) => {
    try {
      const res = await api.acceptSubtask(subtaskId);
      showToast(res.message || "Đã tiếp nhận mục việc thành công! Trạng thái chuyển sang Đang thực hiện.");
      if (taskDetail) refreshTaskDetail(taskDetail.task.id);
      fetchTasks();
    } catch (err) {
      showToast(err.message || "Lỗi khi tiếp nhận mục việc.", "danger");
    }
  };

  const handleRejectSubtask = async (subtaskId, reason) => {
    try {
      const res = await api.rejectSubtask(subtaskId, reason);
      showToast(res.message || "Đã từ chối nhận mục việc và gửi phản hồi đến Trưởng nhóm!");
      setRejectModalSubtask(null);
      if (taskDetail) refreshTaskDetail(taskDetail.task.id);
      fetchTasks();
    } catch (err) {
      showToast(err.message || "Lỗi khi từ chối nhận mục việc.", "danger");
    }
  };

  const handleReviewSubtask = async (actionType) => {
    // actionType: 'approve' | 'rework' | 'penalty'
    if ((actionType === 'rework' || actionType === 'penalty') && !reviewComment.trim()) {
      showToast(actionType === 'penalty' ? "Vui lòng nhập lý do đánh giá không đạt / phạt trừ điểm!" : "Vui lòng nhập nhận xét / lý do yêu cầu làm lại!", "danger");
      return;
    }
    try {
      const isApprove = actionType === 'approve';
      const isPenalty = actionType === 'penalty';
      const res = await api.reviewSubtask(
        reviewModalSubtask.id,
        isApprove,
        reviewComment.trim(),
        1.0,
        isPenalty,
        Number(reviewPenaltyPoints) || 0
      );
      showToast(res.message || "Đã cập nhật mục việc thành công!");
      setReviewModalSubtask(null);
      setReviewComment("");
      setReviewPenaltyPoints(1);
      setReviewActionMode("approve");
      if (taskDetail) refreshTaskDetail(taskDetail.task.id);
    } catch (err) {
      showToast(err.message || "Lỗi khi xử lý mục việc.", "danger");
    }
  };

  const handleReopenSubtask = async (subtaskId) => {
    if (!window.confirm("Bạn có muốn cho phép thành viên làm lại mục việc này và xóa điểm phạt?")) return;
    try {
      const res = await api.reviewSubtask(subtaskId, false, "Cho phép làm lại mục việc", 1.0, false, 0);
      showToast(res.message || "Đã chuyển mục việc về trạng thái Đang làm.");
      if (taskDetail) refreshTaskDetail(taskDetail.task.id);
    } catch (err) {
      showToast(err.message || "Lỗi khi mở lại mục việc.", "danger");
    }
  };

  const handleDeleteSubtask = async (subtaskId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa mục checklist này?")) return;
    try {
      const res = await api.deleteSubtask(subtaskId);
      showToast(res.message || "Đã xóa mục checklist.");
      if (taskDetail) refreshTaskDetail(taskDetail.task.id);
    } catch (err) {
      showToast(err.message || "Lỗi khi xóa mục checklist.", "danger");
    }
  };

  return (
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "16px 12px", boxSizing: "border-box" }}>
      {/* TOAST ALERT */}
      {toast.text && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            background: toast.type === "danger" ? "#ef4444" : "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "slideIn 0.2s ease",
          }}
        >
          {toast.type === "danger" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
              }}
            >
              <CheckSquare size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: "clamp(17px, 3.5vw, 22px)", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
                Nhiệm Vụ & Phân Công Dự Án (Tasks & Checklist)
              </h1>
              <p style={{ margin: "2px 0 0 0", fontSize: 13, color: "#64748b" }}>
                Quản lý các đề tài nghiên cứu, bảo trì phòng Lab, chuẩn bị sự kiện và quy trình nghiệm thu checklist 3 cấp
              </p>
            </div>
          </div>
        </div>

        {/* CREATE TASK BUTTON */}
        {hasAdminRights && (
          <button
            onClick={() => setShowCreateTaskModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              padding: "10px 18px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#2563eb")}
          >
            <Plus size={18} />
            <span>Tạo Nhiệm Vụ Mới</span>
          </button>
        )}
      </div>

      {/* METRIC CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Tất cả nhiệm vụ</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ListTodo size={15} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>{totalCount}</div>
        </div>

        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Đang triển khai</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fffbeb", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={15} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#d97706", marginTop: 4 }}>{inProgressCount}</div>
        </div>

        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Checklist Chờ Duyệt</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#fef3c7", color: "#b45309", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={15} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#b45309", marginTop: 4 }}>{needsReviewCount}</div>
        </div>

        <div style={{ background: "#ffffff", padding: "12px 14px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>Đã nghiệm thu</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#059669", marginTop: 4 }}>{finishedCount}</div>
        </div>
      </div>

      {/* FILTER CONTROLS & TABS */}
      <div
        style={{
          background: "#ffffff",
          padding: "12px 14px",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          marginBottom: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        }}
      >
        {/* HORIZONTAL TOUCH PILL TABS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflowX: "auto",
            paddingBottom: 8,
            marginBottom: 10,
            WebkitOverflowScrolling: "touch",
            whiteSpace: "nowrap",
            scrollbarWidth: "none",
          }}
        >
          {[
            { id: "all", label: "Tất cả", count: totalCount, icon: ListTodo },
            { id: "my_tasks", label: "Việc của tôi", icon: User },
            { id: "needs_review", label: "Cần duyệt", count: needsReviewCount, icon: AlertCircle },
            { id: "finished", label: "Đã hoàn thành", count: finishedCount, icon: CheckCircle2 },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 20,
                  fontSize: 12.5,
                  fontWeight: isActive ? 800 : 600,
                  cursor: "pointer",
                  border: isActive ? "1.5px solid #2563eb" : "1.5px solid #e2e8f0",
                  background: isActive ? "#2563eb" : "#ffffff",
                  color: isActive ? "#ffffff" : "#475569",
                  boxShadow: isActive ? "0 3px 8px rgba(37,99,235,0.25)" : "none",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
              >
                <Icon size={14} color={isActive ? "#ffffff" : "#64748b"} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    style={{
                      background: isActive ? "rgba(255,255,255,0.25)" : "#f1f5f9",
                      color: isActive ? "#ffffff" : (tab.id === "needs_review" ? "#d97706" : "#64748b"),
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: 10,
                      marginLeft: 2,
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* SEARCH & TYPE FILTER (FULL WIDTH FLEX) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%" }}>
          <div style={{ position: "relative", flex: "1 1 180px" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Tìm kiếm theo tiêu đề nhiệm vụ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px 8px 30px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                outline: "none",
                background: "#ffffff",
                boxSizing: "border-box",
              }}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              flex: "0 1 auto",
              minWidth: 140,
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              background: "#ffffff",
              color: "#334155",
              fontWeight: 600,
              outline: "none",
              cursor: "pointer",
              boxSizing: "border-box",
            }}
          >
            <option value="all">Mọi loại nhiệm vụ</option>
            <option value="LAB_MAINTENANCE">Bảo trì Lab</option>
            <option value="EVENT">Sự kiện / Workshop</option>
            <option value="INDUSTRY">Dự án Doanh nghiệp</option>
            <option value="RESEARCH">Nghiên cứu AI / Lab</option>
            <option value="OTHER">Khác</option>
          </select>
        </div>
      </div>

      {/* TASKS LIST / GRID */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
          <Clock size={36} style={{ animation: "spin 1.5s linear infinite", color: "#2563eb", marginBottom: 12 }} />
          <div style={{ fontWeight: 600 }}>Đang tải danh sách nhiệm vụ...</div>
        </div>
      ) : tasks.length === 0 ? (
        <div
          style={{
            background: "#ffffff",
            padding: "60px 20px",
            borderRadius: 14,
            border: "1.5px dashed #cbd5e1",
            textAlign: "center",
          }}
        >
          <CheckSquare size={44} style={{ color: "#94a3b8", marginBottom: 12 }} />
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: 0 }}>Không có nhiệm vụ nào phù hợp</h3>
          <p style={{ fontSize: 13, color: "#64748b", margin: "6px 0 16px 0" }}>
            Hãy chọn bộ lọc khác hoặc Quản trị viên có thể bấm "Tạo Nhiệm Vụ Mới" ở trên.
          </p>
          {hasAdminRights && (
            <button
              onClick={() => setShowCreateTaskModal(true)}
              style={{
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                padding: "8px 16px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              ➕ Khởi tạo nhiệm vụ đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 20 }}>
          {tasks.map((task) => {
            const typeBadge = getTypeBadge(task.task_type);
            const statusBadge = getStatusBadge(task.status);
            const totalSub = task.subtasks_count || 0;
            const finishedSub = task.finished_subtasks_count || 0;
            const percent = totalSub > 0 ? Math.round((finishedSub / totalSub) * 100) : 0;
            const isMeLeader = task.leader_id === user?.id;

            return (
              <div
                key={task.id}
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  padding: 20,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.2s ease",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#93c5fd";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(37,99,235,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.03)";
                }}
              >
                <div>
                  {/* BADGES & TYPE */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: 6,
                          background: typeBadge.bg,
                          color: typeBadge.color,
                          border: `1px solid ${typeBadge.border}`,
                        }}
                      >
                        {typeBadge.label}
                      </span>
                      {task.total_cp > 0 ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "#f5f3ff",
                            color: "#7c3aed",
                            border: "1px solid #ddd6fe",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                          title={`Tổng quỹ điểm: ${task.total_cp} CP`}
                        >
                          🏆 {task.total_cp} CP
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "#f8fafc",
                            color: "#94a3b8",
                            border: "1px solid #e2e8f0",
                          }}
                          title="Chưa thiết lập quỹ CP tổng"
                        >
                          🏆 0 CP
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 9px",
                        borderRadius: 6,
                        background: statusBadge.bg,
                        color: statusBadge.color,
                        border: `1px solid ${statusBadge.border}`,
                      }}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* TITLE & DESCRIPTION */}
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#0f172a",
                      margin: "0 0 8px 0",
                      lineHeight: 1.4,
                      cursor: "pointer",
                    }}
                    onClick={() => openTaskDetail(task)}
                    title="Bấm để xem chi tiết và danh sách checklist"
                  >
                    {task.title}
                  </h3>

                  {task.description && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#64748b",
                        margin: "0 0 14px 0",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {task.description}
                    </p>
                  )}

                  {/* META: DEADLINE & LOCATION */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16, fontSize: 12, color: "#475569" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Clock size={14} color="#64748b" />
                      <span>
                        Hạn chót: <strong>{formatDeadline(task.deadline)}</strong>
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <User size={14} color="#64748b" />
                      <span>
                        Trưởng nhóm phụ trách: <strong>{task.leader_name || "Chưa gán"}</strong> {isMeLeader && "(Tôi)"}
                      </span>
                    </div>
                  </div>

                  {/* CHECKLIST PROGRESS BAR */}
                  <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: 10, border: "1px solid #f1f5f9", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: "#334155" }}>
                        Tiến độ Checklist: {finishedSub}/{totalSub} mục
                      </span>
                      <span style={{ fontWeight: 800, color: percent === 100 ? "#059669" : "#2563eb" }}>{percent}%</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${percent}%`,
                          height: "100%",
                          background: percent === 100 ? "#10b981" : "#2563eb",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* BOTTOM ACTIONS */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 12, flexWrap: "wrap", gap: 8 }}>
                  <button
                    onClick={() => openTaskDetail(task)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1px solid #bfdbfe",
                      padding: "7px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>Xem Checklist & Chi Tiết</span>
                    <ChevronRight size={14} />
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {canEditTask(task) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTask(task);
                        }}
                        style={{
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          color: "#1d4ed8",
                          padding: "6px 10px",
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        title="Chỉnh sửa thông tin nhiệm vụ lớn"
                      >
                        <Edit3 size={12} />
                        <span>Sửa</span>
                      </button>
                    )}

                    {canEditTask(task) && task.status !== "POSTPONED" && task.status !== "FINISHED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPostponeModalTask(task);
                          setPostponeReason("");
                        }}
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          color: "#64748b",
                          padding: "6px 10px",
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                        title="Tạm hoãn nhiệm vụ"
                      >
                        Tạm hoãn
                      </button>
                    )}

                    {(hasAdminRights || task.leader_id === user?.id) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        style={{
                          background: "#fff1f2",
                          border: "1px solid #fecdd3",
                          color: "#e11d48",
                          padding: "6px 8px",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                        title="Xóa nhiệm vụ"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: TASK DETAIL & CHECKLIST WORKFLOW ================= */}
      {selectedTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => {
            setSelectedTask(null);
            setTaskDetail(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              width: "95%",
              maxWidth: 1200,
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #cbd5e1",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "#f8fafc",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                position: "sticky",
                top: 0,
                zIndex: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckSquare size={22} color="#2563eb" />
                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                  {taskDetail ? taskDetail.task.title : selectedTask.title}
                </h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {canEditTask(taskDetail?.task || selectedTask) && (
                  <button
                    onClick={() => setEditingTask(taskDetail?.task || selectedTask)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1px solid #bfdbfe",
                      padding: "7px 14px",
                      borderRadius: 8,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title="Chỉnh sửa thông tin nhiệm vụ lớn"
                  >
                    <Edit3 size={14} />
                    <span>Chỉnh Sửa Nhiệm Vụ</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    setTaskDetail(null);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                    padding: 6,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* MODAL BODY */}
            {detailLoading || !taskDetail ? (
              <div style={{ padding: "80px 0", textAlign: "center", color: "#64748b" }}>
                <Clock size={36} style={{ animation: "spin 1.5s linear infinite", color: "#2563eb", marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Đang tải chi tiết nhiệm vụ và danh sách checklist...</div>
              </div>
            ) : (() => {
              const subtasks = taskDetail.subtasks || [];
              const totalSub = subtasks.length;
              const finishedSub = subtasks.filter((s) => s.status === "FINISHED").length;
              const percent = totalSub === 0 ? 0 : Math.round((finishedSub / totalSub) * 100);
              const isTaskAssignee = Number(taskDetail.task.leader_id) === Number(user?.id);
              const canManageTaskSubtasks = isAdmin || isLeader || isTaskAssignee || Boolean(user?.can_manage_tasks);
              const taskTotalCp = Number(taskDetail.task.total_cp) || 0;
              const allocatedCp = subtasks.reduce((sum, s) => sum + (Number(s.cp_points) || 0), 0);
              const remainingCp = taskTotalCp - allocatedCp;
              const cpPercent = taskTotalCp > 0 ? Math.round((allocatedCp / taskTotalCp) * 100) : 0;

              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
                    gap: 24,
                    padding: 24,
                    alignItems: "start",
                  }}
                >
                  {/* ================= LEFT COLUMN: TASK METADATA & CONTROLS ================= */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* TYPE & STATUS BADGES */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 6,
                          background: getTypeBadge(taskDetail.task.task_type).bg,
                          color: getTypeBadge(taskDetail.task.task_type).color,
                          border: `1px solid ${getTypeBadge(taskDetail.task.task_type).border}`,
                        }}
                      >
                        {getTypeBadge(taskDetail.task.task_type).label}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: "3px 10px",
                          borderRadius: 6,
                          background: getStatusBadge(taskDetail.task.status).bg,
                          color: getStatusBadge(taskDetail.task.status).color,
                          border: `1px solid ${getStatusBadge(taskDetail.task.status).border}`,
                        }}
                      >
                        {getStatusBadge(taskDetail.task.status).label}
                      </span>
                    </div>

                    {/* TITLE & DESCRIPTION */}
                    <div>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                        <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: 0, lineHeight: 1.4, flex: 1 }}>
                          {taskDetail.task.title}
                        </h3>
                        {canEditTask(taskDetail.task) && (
                          <button
                            onClick={() => setEditingTask(taskDetail.task)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              color: "#1d4ed8",
                              padding: "4px 9px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                            title="Chỉnh sửa thông tin nhiệm vụ lớn"
                          >
                            <Edit3 size={12} />
                            <span>Sửa</span>
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: "#475569", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                        {taskDetail.task.description || "Không có mô tả chi tiết."}
                      </p>
                    </div>

                    {/* METADATA LIST (LIST GROUP) */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: 14,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#64748b" }}>Trưởng nhóm:</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong style={{ color: "#0f172a" }}>@{taskDetail.task.leader_name}</strong>
                          {taskDetail.task.leader_id === user?.id && (
                            <span style={{ background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", padding: "1px 6px", borderRadius: 4, fontSize: 10.5, fontWeight: 700 }}>
                              ⭐ Bạn là Trưởng nhóm
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#64748b" }}>Ngày dự kiến:</span>
                        <strong style={{ color: "#334155" }}>{taskDetail.task.planned_date || "Chưa đặt"}</strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#64748b" }}>Hạn chót:</span>
                        <strong style={{ color: "#dc2626", fontWeight: 800 }}>{taskDetail.task.deadline || "Không có"}</strong>
                      </div>
                    </div>

                    {/* POSTPONED REASON BANNER */}
                    {taskDetail.task.status === "POSTPONED" && taskDetail.task.postponed_reason && (
                      <div
                        style={{
                          padding: "10px 14px",
                          background: "#fef2f2",
                          border: "1px solid #fecdd3",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "#991b1b",
                        }}
                      >
                        <strong style={{ display: "block", marginBottom: 4 }}>⚠️ Lý do tạm hoãn:</strong>
                        {taskDetail.task.postponed_reason}
                      </div>
                    )}

                    {/* OVERALL CHECKLIST PROGRESS BAR */}
                    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                        <span style={{ color: "#475569" }}>Tiến độ checklist:</span>
                        <span style={{ color: percent === 100 ? "#059669" : "#2563eb" }}>
                          {finishedSub}/{totalSub} ({percent}%)
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: "100%",
                            background: percent === 100 ? "#10b981" : "#2563eb",
                            borderRadius: 999,
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>

                    {/* CP BUDGET & ALLOCATION PROGRESS BAR */}
                    <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#475569" }}>
                          <span>🏆 Quỹ Điểm CP:</span>
                          <strong style={{ color: "#7c3aed", fontSize: 13 }}>{taskTotalCp} CP</strong>
                          {isAdmin && (
                            <button
                              onClick={() => setEditTaskCpModal(taskDetail.task)}
                              style={{
                                background: "#f3e8ff",
                                border: "1px solid #d8b4fe",
                                color: "#7c3aed",
                                padding: "2px 7px",
                                borderRadius: 5,
                                fontSize: 10.5,
                                cursor: "pointer",
                                fontWeight: 700,
                              }}
                              title="Chỉnh sửa điểm CP tổng của nhiệm vụ"
                            >
                              ✏️ Sửa CP
                            </button>
                          )}
                        </div>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: taskTotalCp === 0 ? "#94a3b8" : remainingCp < 0 ? "#dc2626" : remainingCp === 0 ? "#059669" : "#7c3aed" }}>
                          {taskTotalCp === 0 
                            ? "Chưa đặt quỹ" 
                            : remainingCp < 0 
                              ? `⚠️ Vượt quá ${-remainingCp} CP!` 
                              : remainingCp === 0 
                                ? "✅ Đã chia 100%" 
                                : `Còn lại: ${remainingCp} CP`}
                        </span>
                      </div>

                      {taskTotalCp > 0 && (
                        <div>
                          <div style={{ width: "100%", height: 8, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${Math.min(100, cpPercent)}%`,
                                height: "100%",
                                background: remainingCp < 0 ? "#ef4444" : remainingCp === 0 ? "#10b981" : "linear-gradient(90deg, #7c3aed, #a855f7)",
                                borderRadius: 999,
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b", marginTop: 4 }}>
                            <span>Đã chia: <strong style={{ color: "#1e293b" }}>{allocatedCp} CP</strong> ({cpPercent}%)</span>
                            <span>Tổng quỹ: <strong style={{ color: "#7c3aed" }}>{taskTotalCp} CP</strong></span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ACTION BUTTONS (FINISH & POSTPONE & EDIT) */}
                    {canManageTaskSubtasks && (
                      <div style={{ display: "flex", gap: 10, marginTop: 4, borderTop: "1px solid #e2e8f0", paddingTop: 14, flexWrap: "wrap" }}>
                        {canEditTask(taskDetail.task) && (
                          <button
                            onClick={() => setEditingTask(taskDetail.task)}
                            style={{
                              flex: 1,
                              minWidth: 100,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              border: "1.5px solid #bfdbfe",
                              padding: "9px 12px",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                            title="Chỉnh sửa thông tin nhiệm vụ lớn"
                          >
                            <Edit3 size={15} />
                            <span>Chỉnh Sửa</span>
                          </button>
                        )}

                        {taskDetail.task.status !== "FINISHED" && (
                          <button
                            onClick={() => handleFinishTask(taskDetail.task.id)}
                            style={{
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              background: "#10b981",
                              color: "#ffffff",
                              border: "none",
                              padding: "9px 12px",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                              boxShadow: "0 2px 6px rgba(16, 185, 129, 0.25)",
                            }}
                          >
                            <Award size={15} />
                            <span>Hoàn Thành</span>
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteTask(taskDetail.task.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              background: "#fff1f2",
                              color: "#e11d48",
                              border: "1.5px solid #fecdd3",
                              padding: "9px 14px",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                            title="Xóa vĩnh viễn nhiệm vụ này"
                          >
                            <Trash2 size={15} />
                            <span>Xóa</span>
                          </button>
                        )}
                        {taskDetail.task.status !== "POSTPONED" && taskDetail.task.status !== "FINISHED" && (
                          <button
                            onClick={() => setPostponeModalTask(taskDetail.task)}
                            style={{
                              flex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              background: "#ffffff",
                              color: "#dc2626",
                              border: "1.5px solid #fca5a5",
                              padding: "9px 12px",
                              borderRadius: 8,
                              fontWeight: 700,
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            <PauseCircle size={15} />
                            <span>Tạm Hoãn</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ================= RIGHT COLUMN: SUBTASKS CHECKLIST ================= */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 14,
                      padding: 20,
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                  >
                    {/* CHECKLIST HEADER */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                      <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                          <span>📋</span> Mục Việc Checklist ({totalSub})
                        </h4>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0 0" }}>
                          Quy trình: Phân công → Thành viên nộp duyệt → Trưởng nhóm duyệt
                        </p>
                      </div>

                      {canManageTaskSubtasks && (
                        <button
                          onClick={() => setShowAddSubtaskModal(true)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: "#2563eb",
                            color: "#ffffff",
                            border: "none",
                            padding: "7px 14px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                          }}
                        >
                          <Plus size={15} />
                          <span>Thêm Mục Việc</span>
                        </button>
                      )}
                    </div>

                    {/* SUBTASKS LIST */}
                    {totalSub === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", border: "1.5px dashed #cbd5e1", borderRadius: 10, color: "#64748b" }}>
                        <CheckSquare size={32} style={{ color: "#94a3b8", marginBottom: 8 }} />
                        <div style={{ fontWeight: 600 }}>Nhiệm vụ này chưa có mục việc checklist nào.</div>
                        {canManageTaskSubtasks && (
                          <button
                            onClick={() => setShowAddSubtaskModal(true)}
                            style={{
                              marginTop: 10,
                              background: "#eff6ff",
                              border: "1px solid #bfdbfe",
                              color: "#1d4ed8",
                              padding: "6px 12px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            ➕ Thêm mục việc đầu tiên
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {subtasks.map((sub, idx) => {
                          const isAssignedToMe = sub.assignees?.some((a) => Number(a.user_id) === Number(user?.id));

                          let statusBadge = { label: "Đang làm", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
                          if (sub.status === "PENDING") {
                            statusBadge = { label: "⏳ Chờ tiếp nhận", bg: "#fef9c3", color: "#854d0e", border: "#fef08a" };
                          } else if (sub.status === "REJECTED") {
                            statusBadge = { label: "❌ Đã từ chối", bg: "#fef2f2", color: "#991b1b", border: "#fecaca" };
                          } else if (sub.status === "REVIEW") {
                            statusBadge = { label: "🟡 Chờ duyệt", bg: "#fffbeb", color: "#b45309", border: "#fde68a" };
                          } else if (sub.status === "FINISHED") {
                            statusBadge = { label: "🟢 Hoàn thành", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
                          } else if (sub.status === "FAILED") {
                            statusBadge = { label: "❌ Không đạt (Bị trừ CP)", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" };
                          }

                          return (
                            <div
                              key={sub.id}
                              style={{
                                padding: 14,
                                borderRadius: 10,
                                background: sub.status === "FINISHED" ? "#fcfdfd" : (sub.status === "FAILED" || sub.status === "REJECTED") ? "#fff5f5" : sub.status === "REVIEW" ? "#fffbeb" : sub.status === "PENDING" ? "#fffdf5" : "#ffffff",
                                border: (sub.status === "FAILED" || sub.status === "REJECTED") ? "1.5px solid #f87171" : sub.status === "REVIEW" ? "1.5px solid #f59e0b" : sub.status === "PENDING" ? "1.5px solid #fde047" : "1px solid #e2e8f0",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 240 }}>
                                  <div
                                    style={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: 6,
                                      background: sub.status === "FINISHED" ? "#10b981" : (sub.status === "FAILED" || sub.status === "REJECTED") ? "#ef4444" : sub.status === "PENDING" ? "#f59e0b" : "#e2e8f0",
                                      color: (sub.status === "FINISHED" || sub.status === "FAILED" || sub.status === "REJECTED") ? "#ffffff" : "#475569",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 800,
                                      fontSize: 12,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {sub.status === "FINISHED" ? <Check size={15} /> : (sub.status === "FAILED" || sub.status === "REJECTED") ? <X size={15} /> : idx + 1}
                                  </div>

                                  <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                      <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                                        {sub.title}
                                      </h5>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          fontWeight: 800,
                                          padding: "2px 7px",
                                          borderRadius: 4,
                                          background: statusBadge.bg,
                                          color: statusBadge.color,
                                          border: `1px solid ${statusBadge.border}`,
                                        }}
                                      >
                                        {statusBadge.label}
                                      </span>
                                      {sub.cp_points > 0 && (
                                        <span
                                          style={{
                                            fontSize: 10,
                                            fontWeight: 800,
                                            padding: "2px 7px",
                                            borderRadius: 4,
                                            background: sub.status === "FAILED" ? "#fef2f2" : "#eff6ff",
                                            color: sub.status === "FAILED" ? "#dc2626" : "#2563eb",
                                            border: `1px solid ${sub.status === "FAILED" ? "#fecaca" : "#bfdbfe"}`,
                                          }}
                                        >
                                          {sub.status === "FAILED" ? `-${sub.cp_points} CP (Phạt)` : `+${sub.cp_points} CP`}
                                        </span>
                                      )}
                                    </div>

                                    {sub.description && (
                                      <p style={{ margin: "4px 0 8px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                                        {sub.description}
                                      </p>
                                    )}

                                    {/* THÔNG BÁO CHO THÀNH VIÊN ĐƯỢC GIAO KHI Ở TRẠNG THÁI CHỜ TIẾP NHẬN */}
                                    {sub.status === "PENDING" && isAssignedToMe && (
                                      <div
                                        style={{
                                          margin: "6px 0 8px 0",
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          background: "#fefce8",
                                          border: "1px solid #fef08a",
                                          fontSize: 12,
                                          color: "#854d0e",
                                        }}
                                      >
                                        👉 <strong>Mục việc được giao cho bạn:</strong> Vui lòng bấm <strong>Chấp nhận</strong> để bắt đầu làm hoặc <strong>Từ chối</strong> nếu không thể nhận việc.
                                      </div>
                                    )}

                                    {/* LÝ DO TỪ CHỐI */}
                                    {sub.reject_reason && (
                                      <div
                                        style={{
                                          margin: "6px 0 8px 0",
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          background: "#fef2f2",
                                          borderLeft: "3px solid #ef4444",
                                          fontSize: 12,
                                          color: "#991b1b",
                                        }}
                                      >
                                        <strong>❌ Lý do từ chối nhận việc:</strong> {sub.reject_reason}
                                      </div>
                                    )}

                                    {sub.review_comment && (
                                      <div
                                        style={{
                                          margin: "4px 0 8px 0",
                                          padding: "5px 10px",
                                          borderRadius: 6,
                                          background: sub.status === "FAILED" ? "#fef2f2" : "#f8fafc",
                                          borderLeft: `3px solid ${sub.status === "FAILED" ? "#ef4444" : "#3b82f6"}`,
                                          fontSize: 12,
                                          color: sub.status === "FAILED" ? "#991b1b" : "#334155",
                                        }}
                                      >
                                        <strong>{sub.status === "FAILED" ? "⚠️ Lý do trừ điểm:" : "Nhận xét:"}</strong> {sub.review_comment}
                                      </div>
                                    )}

                                    {/* ASSIGNEES & DEADLINE */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, color: "#475569", flexWrap: "wrap", marginTop: 4 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                        <Users size={13} color="#64748b" />
                                        <span>
                                          Phụ trách:{" "}
                                          <strong style={{ color: "#2563eb" }}>
                                            {sub.assignees?.map((a) => `@${a.username || a.full_name}`).join(", ") || "Chưa giao"}
                                          </strong>
                                          {isAssignedToMe && " (Tôi)"}
                                        </span>
                                      </div>

                                      {sub.due_at && (
                                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                          <Clock size={13} color="#64748b" />
                                          <span>Hạn: {sub.due_at}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* WORKFLOW BUTTONS FOR THIS SUBTASK */}
                                <div style={{ display: "flex", alignItems: "center", gap: 6, alignSelf: "center", flexWrap: "wrap" }}>
                                  {/* 0. Member accepts or rejects when PENDING - ONLY assigned member can accept or reject */}
                                  {sub.status === "PENDING" && isAssignedToMe && (
                                    <>
                                      <button
                                        onClick={() => handleAcceptSubtask(sub.id)}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 5,
                                          background: "#ecfdf5",
                                          color: "#047857",
                                          border: "1.5px solid #a7f3d0",
                                          padding: "6px 14px",
                                          borderRadius: 999,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                          boxShadow: "0 1px 3px rgba(16, 185, 129, 0.2)",
                                        }}
                                        title="Tiếp nhận mục việc này"
                                      >
                                        <Check size={14} />
                                        <span>Chấp Nhận</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setRejectModalSubtask(sub);
                                        }}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 5,
                                          background: "#fef2f2",
                                          color: "#b91c1c",
                                          border: "1.5px solid #fecaca",
                                          padding: "6px 14px",
                                          borderRadius: 999,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                        title="Từ chối mục việc này"
                                      >
                                        <X size={14} />
                                        <span>Từ Chối</span>
                                      </button>
                                    </>
                                  )}

                                  {/* If PENDING and not assigned to current user, leader/admin can edit or reassign */}
                                  {sub.status === "PENDING" && !isAssignedToMe && canManageTaskSubtasks && (
                                    <button
                                      onClick={() => setEditingSubtask(sub)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        background: "#f8fafc",
                                        color: "#475569",
                                        border: "1px solid #cbd5e1",
                                        padding: "5px 12px",
                                        borderRadius: 999,
                                        fontSize: 11.5,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                      title="Chỉnh sửa hoặc phân công lại người khác"
                                    >
                                      <Edit3 size={12} />
                                      <span>Đổi người / Sửa</span>
                                    </button>
                                  )}

                                  {/* If REJECTED, leader/admin can reassign/edit */}
                                  {sub.status === "REJECTED" && canManageTaskSubtasks && (
                                    <button
                                      onClick={() => setEditingSubtask(sub)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        background: "#eff6ff",
                                        color: "#2563eb",
                                        border: "1.5px solid #bfdbfe",
                                        padding: "6px 14px",
                                        borderRadius: 999,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                      title="Giao lại cho thành viên khác hoặc sửa thông tin"
                                    >
                                      <RotateCcw size={13} />
                                      <span>Giao Lại / Đổi Người</span>
                                    </button>
                                  )}

                                  {/* 1. Member submits when in PROCESSING */}
                                  {sub.status === "PROCESSING" && (isAssignedToMe || canManageTaskSubtasks) && (
                                    <button
                                      onClick={() => handleSubmitSubtask(sub.id)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        background: "transparent",
                                        color: "#0d6efd",
                                        border: "1px solid #0d6efd",
                                        padding: "6px 14px",
                                        borderRadius: 999,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                      title="Nộp Duyệt (Thành Viên)"
                                    >
                                      <Send size={13} />
                                      <span>Nộp Duyệt</span>
                                    </button>
                                  )}

                                  {/* 2. Direct penalty button if member abandons or fails in PROCESSING */}
                                  {sub.status === "PROCESSING" && canManageTaskSubtasks && (
                                    <button
                                      onClick={() => {
                                        setReviewModalSubtask({ id: sub.id, title: sub.title, cp_points: sub.cp_points, mode: 'penalty_direct' });
                                        setReviewActionMode('penalty');
                                        setReviewPenaltyPoints(sub.cp_points || 1);
                                        setReviewComment("");
                                      }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        background: "#fff1f2",
                                        color: "#e11d48",
                                        border: "1px solid #fecdd3",
                                        padding: "6px 12px",
                                        borderRadius: 999,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                      title="Đánh giá không hoàn thành và phạt trừ điểm CP"
                                    >
                                      <AlertCircle size={13} />
                                      <span>Không Đạt / Trừ CP</span>
                                    </button>
                                  )}

                                  {/* 3. Leader reviews when in REVIEW */}
                                  {sub.status === "REVIEW" && canManageTaskSubtasks && (
                                    <button
                                      onClick={() => {
                                        setReviewModalSubtask({ id: sub.id, title: sub.title, cp_points: sub.cp_points, mode: 'review' });
                                        setReviewActionMode('approve');
                                        setReviewPenaltyPoints(sub.cp_points || 1);
                                        setReviewComment("");
                                      }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        background: "#198754",
                                        color: "#ffffff",
                                        border: "none",
                                        padding: "6px 14px",
                                        borderRadius: 999,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        boxShadow: "0 2px 4px rgba(25,135,84,0.2)",
                                      }}
                                    >
                                      <Search size={13} />
                                      <span>Nghiệm Thu (Trưởng Nhóm)</span>
                                    </button>
                                  )}

                                  {/* 4. Reopen if FAILED */}
                                  {sub.status === "FAILED" && canManageTaskSubtasks && (
                                    <button
                                      onClick={() => handleReopenSubtask(sub.id)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        background: "#eff6ff",
                                        color: "#2563eb",
                                        border: "1px solid #bfdbfe",
                                        padding: "6px 12px",
                                        borderRadius: 999,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                      title="Cho phép thành viên làm lại và gỡ bỏ điểm phạt"
                                    >
                                      <RotateCcw size={13} />
                                      <span>Cho Làm Lại</span>
                                    </button>
                                  )}

                                  {/* Edit subtask button */}
                                  {canManageTaskSubtasks && sub.status !== "FINISHED" && (
                                    <button
                                      onClick={() => setEditingSubtask(sub)}
                                      style={{
                                        background: "#f8fafc",
                                        border: "1px solid #cbd5e1",
                                        color: "#475569",
                                        padding: "6px 10px",
                                        borderRadius: 8,
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                      title="Sửa thông tin mục checklist"
                                    >
                                      ✏️ Sửa
                                    </button>
                                  )}

                                  {/* Delete subtask */}
                                  {canManageTaskSubtasks && (
                                    <button
                                      onClick={() => handleDeleteSubtask(sub.id)}
                                      style={{
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        color: "#94a3b8",
                                        padding: "6px 8px",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                      }}
                                      title="Xóa mục checklist"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE TASK ================= */}
      {showCreateTaskModal && (
        <CreateTaskModal
          isOpen={showCreateTaskModal}
          onClose={() => setShowCreateTaskModal(false)}
          allMembers={allMembers}
          onSuccess={() => {
            fetchTasks();
            showToast("Đã tạo nhiệm vụ mới thành công!");
          }}
        />
      )}

      {/* ================= MODAL: ADD SUBTASK ================= */}
      {showAddSubtaskModal && taskDetail && (
        <AddSubtaskModal
          isOpen={showAddSubtaskModal}
          onClose={() => setShowAddSubtaskModal(false)}
          taskId={taskDetail.task.id}
          taskDeadline={taskDetail.task.deadline}
          assignedLeader={{
            id: taskDetail.task.leader_id,
            name: taskDetail.task.leader_name
          }}
          allMembers={allMembers}
          totalCp={taskDetail.task.total_cp || 0}
          currentAllocatedCp={(taskDetail.subtasks || []).reduce((sum, s) => sum + (s.cp_points || 0), 0)}
          onSuccess={() => {
            refreshTaskDetail(taskDetail.task.id);
            fetchTasks();
            showToast("Đã thêm mục việc thành công!");
          }}
        />
      )}

      {/* ================= MODAL: REVIEW / PENALTY SUBTASK ================= */}
      {reviewModalSubtask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setReviewModalSubtask(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 520,
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                {reviewModalSubtask.mode === 'penalty_direct' ? (
                  <>
                    <span style={{ color: "#dc2626" }}>⚠️</span>
                    <span>Đánh Giá Không Đạt & Phạt Trừ CP</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>Nghiệm Thu: {reviewModalSubtask.title}</span>
                  </>
                )}
              </h3>
              <button onClick={() => setReviewModalSubtask(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            {reviewModalSubtask.mode === 'penalty_direct' ? (
              <div style={{ marginBottom: 16, padding: "12px 14px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca", fontSize: 13, color: "#991b1b", lineHeight: 1.5 }}>
                Mục việc này chưa nộp hoặc quá hạn / không hoàn thành. Đánh dấu <strong>Không Đạt</strong> sẽ trực tiếp <strong>trừ điểm CP</strong> của thành viên phụ trách!
              </div>
            ) : (
              reviewModalSubtask?.cp_points > 0 && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: 13, color: "#166534", lineHeight: 1.4 }}>
                  ⭐ Mục checklist này có định mức <strong>{reviewModalSubtask.cp_points} CP</strong>. Nếu duyệt Đạt sẽ cộng điểm CP, nếu đánh giá Không đạt sẽ trừ điểm tương ứng.
                </div>
              )
            )}

            {/* Ô NHẬP ĐIỂM PHẠT NẾU CHỌN PHẠT TRỪ ĐIỂM */}
            {(reviewModalSubtask.mode === 'penalty_direct' || reviewActionMode === 'penalty') && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#dc2626", marginBottom: 6 }}>
                  Số điểm CP muốn phạt trừ: <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={reviewPenaltyPoints}
                    onChange={(e) => setReviewPenaltyPoints(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      width: "120px",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1.5px solid #f87171",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#b91c1c",
                      boxSizing: "border-box",
                      background: "#fff5f5"
                    }}
                  />
                  <span style={{ fontSize: 13, color: "#64748b" }}>
                    (Mỗi thành viên phụ trách sẽ bị trừ điểm theo tỷ lệ phân công)
                  </span>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                {reviewModalSubtask.mode === 'penalty_direct' || reviewActionMode === 'penalty' ? (
                  <span>Lý do không đạt / phạt trừ điểm: <span style={{ color: "#ef4444" }}>*</span></span>
                ) : (
                  <span>Nhận xét / Góp ý nghiệm thu:</span>
                )}
              </label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={
                  reviewModalSubtask.mode === 'penalty_direct' || reviewActionMode === 'penalty'
                    ? "Nhập lý do không hoàn thành (VD: Quá hạn không thực hiện, bỏ dở công việc, chất lượng không đạt...)"
                    : "Nhập nhận xét hoặc nội dung hướng dẫn điều chỉnh..."
                }
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  outlineColor: "#93c5fd",
                }}
              />
            </div>

            {/* CÁC NÚT HÀNH ĐỘNG */}
            {reviewModalSubtask.mode === 'penalty_direct' ? (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setReviewModalSubtask(null)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => handleReviewSubtask('penalty')}
                  style={{
                    background: "#dc2626",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 22px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(220,38,38,0.25)",
                  }}
                >
                  Xác Nhận Phạt Trừ CP
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (reviewActionMode !== 'penalty') {
                      setReviewActionMode('penalty');
                    } else {
                      handleReviewSubtask('penalty');
                    }
                  }}
                  style={{
                    background: "#fff1f2",
                    color: "#b91c1c",
                    border: "1.5px solid #fca5a5",
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {reviewActionMode === 'penalty' ? "Xác Nhận Phạt Trừ CP" : "❌ Không Đạt (Trừ CP)"}
                </button>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => handleReviewSubtask('rework')}
                    style={{
                      background: "#f8fafc",
                      color: "#475569",
                      border: "1px solid #cbd5e1",
                      padding: "8px 16px",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    Yêu Cầu Sửa Lại
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewSubtask('approve')}
                    style={{
                      background: "#16a34a",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 20px",
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(22,163,74,0.25)",
                    }}
                  >
                    Duyệt Đạt (+CP)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: POSTPONE TASK ================= */}
      {postponeModalTask && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setPostponeModalTask(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#dc2626", margin: 0 }}>
                Tạm Hoãn Nhiệm Vụ
              </h3>
              <button onClick={() => setPostponeModalTask(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                Lý do tạm hoãn (Bắt buộc):
              </label>
              <textarea
                rows={3}
                required
                value={postponeReason}
                onChange={(e) => setPostponeReason(e.target.value)}
                placeholder="Nhập chi tiết lý do tạm hoãn nhiệm vụ này..."
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  outlineColor: "#93c5fd",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setPostponeModalTask(null)}
                style={{
                  background: "#52525b",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 24px",
                  borderRadius: 999,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handlePostponeTask}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 24px",
                  borderRadius: 999,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Xác Nhận Tạm Hoãn
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================= MODAL: REJECT SUBTASK ================= */}
      {rejectModalSubtask && (
        <RejectSubtaskModal
          isOpen={!!rejectModalSubtask}
          onClose={() => setRejectModalSubtask(null)}
          subtask={rejectModalSubtask}
          onSuccess={(msg) => {
            showToast(msg);
            if (taskDetail) refreshTaskDetail(taskDetail.task.id);
            fetchTasks();
          }}
        />
      )}

      {/* ================= MODAL: EDIT / REASSIGN SUBTASK ================= */}
      {editingSubtask && (
        <EditSubtaskModal
          isOpen={!!editingSubtask}
          onClose={() => setEditingSubtask(null)}
          subtask={editingSubtask}
          taskDeadline={taskDetail?.task?.deadline}
          allMembers={allMembers}
          totalCp={taskDetail?.task?.total_cp || 0}
          currentAllocatedCp={(taskDetail?.subtasks || []).reduce((sum, s) => s.id === editingSubtask.id ? sum : sum + (s.cp_points || 0), 0)}
          onSuccess={(msg) => {
            showToast(msg || "Đã cập nhật mục việc thành công!");
            if (taskDetail) refreshTaskDetail(taskDetail.task.id);
            fetchTasks();
          }}
        />
      )}

      {/* ================= MODAL: EDIT TASK CP ================= */}
      {editTaskCpModal && (
        <EditTaskCpModal
          isOpen={!!editTaskCpModal}
          onClose={() => setEditTaskCpModal(null)}
          task={editTaskCpModal}
          currentAllocatedCp={(taskDetail?.subtasks || []).reduce((sum, s) => sum + (s.cp_points || 0), 0)}
          onSuccess={(msg) => {
            showToast(msg || "Đã cập nhật điểm CP tổng của nhiệm vụ!");
            if (taskDetail) refreshTaskDetail(taskDetail.task.id);
            fetchTasks();
          }}
        />
      )}

      {/* ================= MODAL: EDIT ROOT TASK ================= */}
      {editingTask && (
        <EditTaskModal
          isOpen={!!editingTask}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          allMembers={allMembers}
          currentAllocatedCp={(taskDetail?.task?.id === editingTask.id ? (taskDetail?.subtasks || []) : []).reduce((sum, s) => sum + (s.cp_points || 0), 0)}
          onSuccess={(msg) => {
            showToast(msg || "Đã cập nhật thông tin nhiệm vụ thành công!");
            if (selectedTask?.id === editingTask.id || taskDetail?.task?.id === editingTask.id) {
              refreshTaskDetail(editingTask.id);
            }
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}

/* ================= MODAL COMPONENT: CREATE TASK (TIẾNG VIỆT CHUẨN - 2-COLUMN GROUPED) ================= */
function CreateTaskModal({ isOpen, onClose, allMembers, onSuccess }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("RESEARCH");
  const [plannedDate, setPlannedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deadline, setDeadline] = useState("");
  // Chỉ lọc thành viên có vai trò Trưởng nhóm (Leader)
  const leaderMembers = useMemo(() => {
    return (allMembers || []).filter((m) => m.role === "leader");
  }, [allMembers]);

  const [leaderId, setLeaderId] = useState(() => (allMembers || []).filter((m) => m.role === "leader")[0]?.id || "");
  const [totalCp, setTotalCp] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (leaderMembers.length > 0) {
      if (!leaderId || !leaderMembers.some((m) => String(m.id) === String(leaderId))) {
        setLeaderId(leaderMembers[0].id);
      }
    } else {
      setLeaderId("");
    }
  }, [leaderMembers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập Tiêu đề nhiệm vụ!");
      return;
    }
    if (!leaderId) {
      setError("Vui lòng chọn Trưởng nhóm (Leader) chịu trách nhiệm cho nhiệm vụ này!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.createTask({
        title: title.trim(),
        description: description.trim(),
        task_type: taskType,
        planned_date: plannedDate,
        deadline: deadline ? deadline.replace("T", " ") : "",
        location: "",
        customer_info: "",
        leader_id: parseInt(leaderId),
        total_cp: Math.max(0, parseInt(totalCp) || 0),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Lỗi khi tạo nhiệm vụ.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "24px 28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 10px rgba(37, 99, 235, 0.25)"
              }}
            >
              <CheckSquare size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Tạo Nhiệm Vụ Mới
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0 0" }}>
                Khởi tạo công việc và phân công trưởng nhóm phụ trách
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              transition: "all 0.15s"
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: 10, fontSize: 13, color: "#991b1b", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* KHỐI 1: THÔNG TIN CỐT LÕI */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
              <span>📋 1. Thông tin chung</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                Tiêu đề nhiệm vụ <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Nghiên cứu tối ưu mô hình mạng nơ-ron, nâng cấp hệ thống..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  outline: "none"
                }}
              />
            </div>

            {/* QUY DIEM CP TONG */}
            <div>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🏆 Điểm CP tổng của nhiệm vụ (Quỹ điểm thưởng CP):</span>
                </span>
                <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>
                  {totalCp > 0 ? `Quỹ: ${totalCp} CP` : "Chưa đặt quỹ"}
                </span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="VD: 50, 100, 200... (Điểm này sẽ chia cho các subtask nhỏ)"
                value={totalCp}
                onChange={(e) => setTotalCp(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  outlineColor: "#a855f7",
                }}
              />
              <small style={{ fontSize: 11.5, color: "#64748b", marginTop: 4, display: "block" }}>
                💡 Nhập tổng điểm CP cho nhiệm vụ lớn. Sau đó các mục việc nhỏ (subtask) sẽ được chia điểm từ quỹ điểm tổng này.
              </small>
            </div>

            <div className="task-modal-grid-2col">
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Loại nhiệm vụ
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: "#ffffff"
                  }}
                >
                  <option value="RESEARCH">🔬 Nghiên cứu (Research)</option>
                  <option value="INDUSTRY">🏢 Dự án doanh nghiệp (Industry)</option>
                  <option value="OTHER">📁 Khác (Other)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Giao nhiệm vụ cho Trưởng nhóm (Leader) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: "#ffffff"
                  }}
                >
                  {leaderMembers.length === 0 ? (
                    <option value="">-- Chưa có tài khoản nào có vai trò Leader --</option>
                  ) : (
                    leaderMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} (@{m.username}) — [⭐ Trưởng nhóm (Leader)]
                      </option>
                    ))
                  )}
                </select>
                {leaderMembers.length === 0 && (
                  <div style={{ fontSize: 11.5, color: "#e11d48", marginTop: 4 }}>
                    ⚠️ Chưa có tài khoản nào được phân vai trò Trưởng nhóm (Leader). Quản trị viên vui lòng gán vai trò Leader trong Quản lý nhân viên.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* KHỐI 2: KẾ HOẠCH & THỜI HẠN */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
              <span>⏱️ 2. Kế hoạch & Thời hạn</span>
            </div>

            <div className="task-modal-grid-2col">
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Ngày dự kiến bắt đầu
                </label>
                <input
                  type="date"
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: "#ffffff"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Hạn chót hoàn thành (Deadline)
                </label>
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: "#ffffff"
                  }}
                />
              </div>
            </div>
          </div>

          {/* KHOI 3: MO TA NHIEM VU */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
              <span>📝 3. Mô tả nhiệm vụ</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                Mô tả chi tiết nhiệm vụ
              </label>
              <textarea
                rows={4}
                placeholder="Nhập nội dung, yêu cầu kỹ thuật và mục tiêu cần đạt được..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  resize: "vertical"
                }}
              />
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #e2e8f0",
                padding: "10px 20px",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#ffffff",
                border: "none",
                padding: "10px 24px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s ease"
              }}
            >
              <CheckSquare size={16} />
              {loading ? "Đang lưu..." : "Lưu Nhiệm Vụ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ================= MODAL COMPONENT: ADD SUBTASK (BỐ CỤC CHUẨN TIẾNG VIỆT) ================= */
function AddSubtaskModal({ isOpen, onClose, taskId, taskDeadline, assignedLeader, allMembers = [], totalCp = 0, currentAllocatedCp = 0, onSuccess }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const remainingCp = Math.max(0, totalCp - currentAllocatedCp);
  const [cpPoints, setCpPoints] = useState(() => (totalCp > 0 && remainingCp > 0 ? Math.min(1, remainingCp) : 1));
  const [selectedAssignees, setSelectedAssignees] = useState(() => {
    if (assignedLeader?.id) return [Number(assignedLeader.id)];
    if (allMembers && allMembers.length > 0) return [Number(allMembers[0].id)];
    return [];
  });
  const [isMulti, setIsMulti] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (assignedLeader?.id) {
      setSelectedAssignees([Number(assignedLeader.id)]);
    } else if (allMembers && allMembers.length > 0) {
      setSelectedAssignees([Number(allMembers[0].id)]);
    }
  }, [assignedLeader, allMembers]);

  const toggleAssignee = (userId) => {
    const idNum = Number(userId);
    setSelectedAssignees((prev) =>
      prev.includes(idNum) ? prev.filter((id) => id !== idNum) : [...prev, idNum]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập Tiêu đề mục việc!");
      return;
    }
    if (selectedAssignees.length === 0) {
      setError("Vui lòng chọn ít nhất 1 thành viên được giao mục việc!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.createSubtask(taskId, {
        title: title.trim(),
        description: description.trim(),
        due_at: dueAt ? dueAt.replace("T", " ") : "",
        assignee_ids: selectedAssignees,
        cp_points: Math.max(0, parseInt(cpPoints) || 0),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Lỗi khi thêm mục việc.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          padding: 24,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0 }}>
            Thêm Mục Việc Checklist
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: 8, fontSize: 13, color: "#991b1b", marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* THÔNG TIN QUỸ ĐIỂM CP TỔNG NẾU NHIỆM VỤ CÓ ĐIỂM TỔNG */}
        {totalCp > 0 && (
          <div
            style={{
              background: "#faf5ff",
              border: "1px solid #e9d5ff",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 14,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "#6b21a8", fontWeight: 700 }}>
                🏆 Quỹ CP tổng nhiệm vụ: <strong>{totalCp} CP</strong>
              </span>
              <span style={{ color: "#64748b" }}>
                Đã phân bổ: <strong>{currentAllocatedCp} CP</strong>
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: remainingCp > 0 ? "#16a34a" : "#dc2626" }}>
                Điểm CP còn lại để chia: {remainingCp} CP
              </span>
              {remainingCp > 0 && (
                <button
                  type="button"
                  onClick={() => setCpPoints(remainingCp)}
                  style={{
                    background: "#7c3aed",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Gán toàn bộ điểm còn lại cho mục việc này"
                >
                  ⚡ Gán hết {remainingCp} CP
                </button>
              )}
            </div>
            {Number(cpPoints) > remainingCp && remainingCp > 0 && (
              <div style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>
                ⚠️ Điểm chia ({cpPoints} CP) vượt quá điểm còn lại của quỹ ({remainingCp} CP).
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
              Tiêu đề mục việc: <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Kiểm tra và cài đặt phần mềm..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                boxSizing: "border-box",
                outlineColor: "#93c5fd",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
              Mô tả chi tiết:
            </label>
            <textarea
              rows={3}
              placeholder="Mô tả yêu cầu cần làm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                boxSizing: "border-box",
                outlineColor: "#93c5fd",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Thành viên được giao mục việc: <span style={{ color: "#ef4444" }}>*</span>
              </label>
              {allMembers && allMembers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsMulti(!isMulti)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  {isMulti ? "Chỉ chọn 1 người" : "+ Giao cho nhiều người"}
                </button>
              )}
            </div>

            {!isMulti ? (
              <select
                value={selectedAssignees[0] || ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedAssignees(val ? [val] : []);
                }}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  color: "#1e293b",
                  outlineColor: "#93c5fd",
                  cursor: "pointer",
                }}
              >
                {allMembers.map((m) => {
                  const roleBadge = m.role === 'admin' ? '👑 Quản trị' : m.role === 'leader' ? '⭐ Trưởng nhóm' : '👤 Thành viên';
                  const isTaskLeader = assignedLeader?.id && Number(m.id) === Number(assignedLeader.id);
                  return (
                    <option key={m.id} value={m.id}>
                      {m.full_name} (@{m.username}) — [{roleBadge}]{isTaskLeader ? " (Phụ trách nhiệm vụ)" : ""}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  maxHeight: 160,
                  overflowY: "auto",
                  padding: "8px 10px",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: 8,
                  background: "#f8fafc",
                }}
              >
                {allMembers.map((m) => {
                  const isChecked = selectedAssignees.includes(Number(m.id));
                  const roleBadge = m.role === 'admin' ? '👑 Quản trị' : m.role === 'leader' ? '⭐ Trưởng nhóm' : '👤 Thành viên';
                  const isTaskLeader = assignedLeader?.id && Number(m.id) === Number(assignedLeader.id);
                  return (
                    <label
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 8px",
                        borderRadius: 6,
                        background: isChecked ? "#eff6ff" : "#ffffff",
                        border: isChecked ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#1e293b",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAssignee(m.id)}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ fontWeight: isChecked ? 600 : 400 }}>
                        {m.full_name} <span style={{ color: "#64748b", fontSize: 12 }}>(@{m.username})</span>
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>
                        [{roleBadge}]{isTaskLeader ? " ⭐" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <small style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "block" }}>
              {isMulti
                ? `Đã chọn ${selectedAssignees.length} thành viên. Mục việc sẽ ở trạng thái 'Chờ tiếp nhận' để thành viên xác nhận.`
                : "Mục việc sẽ ở trạng thái 'Chờ tiếp nhận' để thành viên xác nhận chấp nhận hoặc từ chối."}
            </small>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
                Điểm cống hiến (CP):
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={cpPoints}
                onChange={(e) => setCpPoints(e.target.value)}
                placeholder="VD: 1, 2, 3, 5..."
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  outlineColor: "#93c5fd",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
                Hạn chót:
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                max={taskDeadline ? taskDeadline.replace(" ", "T") : undefined}
                onChange={(e) => setDueAt(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  outlineColor: "#93c5fd",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#475569",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {loading ? "Đang lưu..." : "Thêm mục việc"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================= MODAL: REJECT SUBTASK (TỪ CHỐI NHẬN MỤC VIỆC) ================= */
function RejectSubtaskModal({ isOpen, onClose, subtask, onSuccess }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !subtask) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do từ chối nhận mục việc!");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const res = await api.rejectSubtask(subtask.id, reason.trim());
      onSuccess(res?.message || "Đã từ chối nhận mục việc và gửi phản hồi đến Trưởng nhóm!");
      onClose();
    } catch (err) {
      setError(err.message || "Lỗi khi từ chối nhận mục việc.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 480,
          padding: 24,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#b91c1c", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span>❌</span>
            <span>Từ Chối Tiếp Nhận Mục Việc</span>
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca", fontSize: 13, color: "#991b1b", lineHeight: 1.5 }}>
          Bạn đang từ chối nhận mục việc: <strong>{subtask.title}</strong>{subtask.cp_points > 0 ? ` (${subtask.cp_points} CP)` : ""}.
          <div style={{ marginTop: 4, fontSize: 12, color: "#7f1d1d" }}>
            Mục việc sẽ chuyển sang trạng thái <strong>Đã từ chối</strong> để Trưởng nhóm nắm được lý do và giao lại cho nhân sự phù hợp.
          </div>
        </div>

        {error && (
          <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: 8, fontSize: 13, color: "#991b1b", marginBottom: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Lý do từ chối: <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="VD: Trùng lịch thi / bận việc đột xuất, chưa có chuyên môn phù hợp, khối lượng việc đang quá tải..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1.5px solid #fca5a5",
                fontSize: 14,
                boxSizing: "border-box",
                outlineColor: "#f87171",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#475569",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Quay lại
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#dc2626",
                color: "#ffffff",
                border: "none",
                padding: "8px 20px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(220,38,38,0.25)",
              }}
            >
              {loading ? "Đang gửi..." : "Xác Nhận Từ Chối"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================= MODAL: EDIT / REASSIGN SUBTASK ================= */
function EditSubtaskModal({ isOpen, onClose, subtask, taskDeadline, allMembers = [], totalCp = 0, currentAllocatedCp = 0, onSuccess }) {
  const [title, setTitle] = useState(subtask?.title || "");
  const [description, setDescription] = useState(subtask?.description || "");
  const [dueAt, setDueAt] = useState(subtask?.due_at ? subtask.due_at.replace(" ", "T").slice(0, 16) : "");
  const [cpPoints, setCpPoints] = useState(subtask?.cp_points ?? 1);
  const [selectedAssignees, setSelectedAssignees] = useState(() => {
    if (subtask?.assignees && subtask.assignees.length > 0) {
      return subtask.assignees.map((a) => Number(a.user_id));
    }
    return [];
  });
  const [isMulti, setIsMulti] = useState(() => (subtask?.assignees?.length || 0) > 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const remainingCp = Math.max(0, totalCp - currentAllocatedCp);

  const toggleAssignee = (userId) => {
    const idNum = Number(userId);
    setSelectedAssignees((prev) =>
      prev.includes(idNum) ? prev.filter((id) => id !== idNum) : [...prev, idNum]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập Tiêu đề mục việc!");
      return;
    }
    if (selectedAssignees.length === 0) {
      setError("Vui lòng chọn ít nhất 1 thành viên được giao mục việc!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.updateSubtask(subtask.id, {
        title: title.trim(),
        description: description.trim(),
        due_at: dueAt ? dueAt.replace("T", " ") : "",
        assignee_ids: selectedAssignees,
        cp_points: Math.max(0, parseInt(cpPoints) || 0),
      });
      onSuccess("Đã cập nhật mục việc thành công!");
      onClose();
    } catch (err) {
      setError(err.message || "Lỗi khi cập nhật mục việc.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !subtask) return null;

  const wasRejected = subtask.status === "REJECTED";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 520,
          padding: 24,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span>{wasRejected ? "🔄" : "✏️"}</span>
            <span>{wasRejected ? "Giao Lại Mục Việc Bị Từ Chối" : "Chỉnh Sửa Mục Việc"}</span>
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={20} />
          </button>
        </div>

        {wasRejected && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "#fef2f2", borderRadius: 10, border: "1px solid #fecaca", fontSize: 13, color: "#991b1b" }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>⚠️ Mục việc này đã bị từ chối trước đó:</div>
            <div style={{ fontStyle: "italic" }}>"{subtask.reject_reason || "Không ghi rõ lý do"}"</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "#7f1d1d" }}>
              Khi bạn đổi người hoặc lưu lại, mục việc sẽ được chuyển về <strong>Chờ tiếp nhận</strong> để nhân sự mới xác nhận.
            </div>
          </div>
        )}

        {totalCp > 0 && (
          <div
            style={{
              background: "#faf5ff",
              border: "1px solid #e9d5ff",
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 14,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
              <span style={{ color: "#6b21a8", fontWeight: 700 }}>
                🏆 Quỹ CP tổng: <strong>{totalCp} CP</strong>
              </span>
              <span style={{ color: "#64748b" }}>
                Các mục khác đã chia: <strong>{currentAllocatedCp} CP</strong>
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: remainingCp > 0 ? "#16a34a" : "#dc2626" }}>
                Hạn mức tối đa cho mục này: {remainingCp} CP
              </span>
              {remainingCp > 0 && (
                <button
                  type="button"
                  onClick={() => setCpPoints(remainingCp)}
                  style={{
                    background: "#7c3aed",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  title="Gán mức CP tối đa cho mục này"
                >
                  ⚡ Gán hết {remainingCp} CP
                </button>
              )}
            </div>
            {Number(cpPoints) > remainingCp && remainingCp > 0 && (
              <div style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}>
                ⚠️ Điểm chia ({cpPoints} CP) vượt quá điểm còn lại của quỹ ({remainingCp} CP).
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: 8, fontSize: 13, color: "#991b1b", marginBottom: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
              Tiêu đề mục việc: <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                boxSizing: "border-box",
                outlineColor: "#93c5fd",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
              Mô tả chi tiết:
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                boxSizing: "border-box",
                outlineColor: "#93c5fd",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                Thành viên được giao: <span style={{ color: "#ef4444" }}>*</span>
              </label>
              {allMembers && allMembers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsMulti(!isMulti)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    textDecoration: "underline",
                  }}
                >
                  {isMulti ? "Chỉ chọn 1 người" : "+ Giao cho nhiều người"}
                </button>
              )}
            </div>

            {!isMulti ? (
              <select
                value={selectedAssignees[0] || ""}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSelectedAssignees(val ? [val] : []);
                }}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  color: "#1e293b",
                  outlineColor: "#93c5fd",
                  cursor: "pointer",
                }}
              >
                {allMembers.map((m) => {
                  const roleBadge = m.role === 'admin' ? '👑 Quản trị' : m.role === 'leader' ? '⭐ Trưởng nhóm' : '👤 Thành viên';
                  return (
                    <option key={m.id} value={m.id}>
                      {m.full_name} (@{m.username}) — [{roleBadge}]
                    </option>
                  );
                })}
              </select>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  maxHeight: 160,
                  overflowY: "auto",
                  padding: "8px 10px",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: 8,
                  background: "#f8fafc",
                }}
              >
                {allMembers.map((m) => {
                  const isChecked = selectedAssignees.includes(Number(m.id));
                  const roleBadge = m.role === 'admin' ? '👑 Quản trị' : m.role === 'leader' ? '⭐ Trưởng nhóm' : '👤 Thành viên';
                  return (
                    <label
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "5px 8px",
                        borderRadius: 6,
                        background: isChecked ? "#eff6ff" : "#ffffff",
                        border: isChecked ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "#1e293b",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAssignee(m.id)}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ fontWeight: isChecked ? 600 : 400 }}>
                        {m.full_name} <span style={{ color: "#64748b", fontSize: 12 }}>(@{m.username})</span>
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>
                        [{roleBadge}]
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
                Điểm cống hiến (CP):
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={cpPoints}
                onChange={(e) => setCpPoints(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  outlineColor: "#93c5fd",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 5 }}>
                Hạn chót:
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                max={taskDeadline ? taskDeadline.replace(" ", "T") : undefined}
                onChange={(e) => setDueAt(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  outlineColor: "#93c5fd",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#475569",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "8px 20px",
                borderRadius: 8,
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(37, 99, 235, 0.25)",
              }}
            >
              {loading ? "Đang lưu..." : "Cập Nhật Mục Việc"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================= MODAL: EDIT TASK CP BUDGET ================= */
function EditTaskCpModal({ isOpen, onClose, task, currentAllocatedCp = 0, onSuccess }) {
  const [totalCp, setTotalCp] = useState(task?.total_cp || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      await api.updateTask(task.id, {
        title: task.title,
        description: task.description || "",
        task_type: task.task_type || "RESEARCH",
        planned_date: task.planned_date || "",
        deadline: task.deadline || "",
        location: task.location || "",
        customer_info: task.customer_info || "",
        leader_id: task.leader_id,
        total_cp: Math.max(0, parseInt(totalCp) || 0),
      });
      onSuccess("Đã cập nhật quỹ điểm CP tổng của nhiệm vụ!");
      onClose();
    } catch (err) {
      setError(err.message || "Lỗi khi cập nhật điểm CP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 460,
          padding: 24,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#1e293b", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span>🏆</span>
            <span>Điều Chỉnh Quỹ CP Tổng Nhiệm Vụ</span>
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: 16, fontSize: 13, color: "#64748b" }}>
          Nhiệm vụ: <strong style={{ color: "#0f172a" }}>{task.title}</strong>
        </div>

        <div style={{ padding: "12px 14px", background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 10, marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#6b21a8", fontWeight: 600 }}>Điểm đã chia cho các subtask:</span>
            <strong style={{ color: "#7c3aed" }}>{currentAllocatedCp} CP</strong>
          </div>
          <div style={{ fontSize: 12, color: "#7c3aed" }}>
            💡 Quỹ điểm tổng nên lớn hơn hoặc bằng số điểm đã chia ({currentAllocatedCp} CP) để Trưởng nhóm tiếp tục phân bổ.
          </div>
        </div>

        {error && (
          <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: 8, fontSize: 13, color: "#991b1b", marginBottom: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Điểm CP tổng mới (Quỹ thưởng):
            </label>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={totalCp}
              onChange={(e) => setTotalCp(e.target.value)}
              placeholder="VD: 50, 100, 200..."
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 8,
                border: "1.5px solid #cbd5e1",
                fontSize: 16,
                fontWeight: 700,
                color: "#7c3aed",
                boxSizing: "border-box",
                outlineColor: "#a855f7",
              }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#475569",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#7c3aed",
                color: "#ffffff",
                border: "none",
                padding: "8px 20px",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 2px 4px rgba(124,58,237,0.25)",
              }}
            >
              {loading ? "Đang lưu..." : "Cập Nhật Điểm CP"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================= MODAL: EDIT ROOT TASK (CHỈNH SỬA NHIỆM VỤ LỚN) ================= */
function EditTaskModal({ isOpen, onClose, task, allMembers = [], currentAllocatedCp = 0, onSuccess }) {
  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [taskType, setTaskType] = useState(task?.task_type || "RESEARCH");
  const [plannedDate, setPlannedDate] = useState(() => {
    if (task?.planned_date) {
      return task.planned_date.substring(0, 10);
    }
    return new Date().toISOString().split("T")[0];
  });
  const [deadline, setDeadline] = useState(() => {
    if (task?.deadline) {
      const s = task.deadline.replace(" ", "T");
      return s.length >= 16 ? s.substring(0, 16) : s;
    }
    return "";
  });
  const [leaderId, setLeaderId] = useState(task?.leader_id || "");
  const [totalCp, setTotalCp] = useState(task?.total_cp || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync state whenever task prop changes or modal opens
  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setTaskType(task.task_type || "RESEARCH");
      setPlannedDate(task.planned_date ? task.planned_date.substring(0, 10) : new Date().toISOString().split("T")[0]);
      if (task.deadline) {
        const s = task.deadline.replace(" ", "T");
        setDeadline(s.length >= 16 ? s.substring(0, 16) : s);
      } else {
        setDeadline("");
      }
      setLeaderId(task.leader_id || "");
      setTotalCp(task.total_cp || 0);
      setError("");
    }
  }, [task]);

  // List of potential leaders: role === 'leader' or 'admin', and ensure current leader is included
  const leaderMembers = useMemo(() => {
    const list = (allMembers || []).filter((m) => m.role === "leader" || m.role === "admin");
    if (task?.leader_id && !list.some((m) => Number(m.id) === Number(task.leader_id))) {
      const cur = (allMembers || []).find((m) => Number(m.id) === Number(task.leader_id));
      if (cur) list.push(cur);
    }
    return list;
  }, [allMembers, task]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập Tiêu đề nhiệm vụ!");
      return;
    }
    if (!deadline) {
      setError("Vui lòng chọn Hạn chót hoàn thành (Deadline)!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.updateTask(task.id, {
        title: title.trim(),
        description: description.trim(),
        task_type: taskType,
        planned_date: plannedDate || "",
        deadline: deadline ? deadline.replace("T", " ") : "",
        location: task.location || "",
        customer_info: task.customer_info || "",
        leader_id: leaderId ? parseInt(leaderId) : task.leader_id,
        total_cp: Math.max(0, parseInt(totalCp) || 0),
      });
      onSuccess("Đã cập nhật thông tin nhiệm vụ thành công!");
      onClose();
    } catch (err) {
      setError(err.message || "Lỗi khi cập nhật nhiệm vụ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "24px 28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #e2e8f0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, borderBottom: "1px solid #f1f5f9", paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 4px 10px rgba(37, 99, 235, 0.25)",
              }}
            >
              <Edit3 size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>
                Chỉnh Sửa Nhiệm Vụ Lớn
              </h3>
              <p style={{ fontSize: 13, color: "#64748b", margin: "2px 0 0 0" }}>
                Mã nhiệm vụ #{task.id} • Cập nhật thông tin chi tiết, người phụ trách và thời hạn
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: 8,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              transition: "all 0.15s",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: 10, fontSize: 13, color: "#991b1b", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* KHỐI 1: THÔNG TIN CỐT LÕI */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
              <span>📋 1. Thông tin chung</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                Tiêu đề nhiệm vụ <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Nghiên cứu tối ưu mô hình mạng nơ-ron, nâng cấp hệ thống..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  outline: "none",
                }}
              />
            </div>

            {/* QUỸ ĐIỂM CP TỔNG */}
            <div>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🏆 Quỹ điểm CP tổng của nhiệm vụ:</span>
                </span>
                <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 700 }}>
                  {totalCp > 0 ? `Quỹ: ${totalCp} CP` : "Chưa đặt quỹ"}
                  {currentAllocatedCp > 0 && ` (Đã chia: ${currentAllocatedCp} CP)`}
                </span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="VD: 50, 100, 200..."
                value={totalCp}
                onChange={(e) => setTotalCp(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  outlineColor: "#a855f7",
                }}
              />
              {currentAllocatedCp > 0 && Number(totalCp) < currentAllocatedCp && (
                <small style={{ fontSize: 11.5, color: "#dc2626", marginTop: 4, display: "block", fontWeight: 600 }}>
                  ⚠️ Quỹ điểm CP mới ({totalCp} CP) đang nhỏ hơn tổng điểm các mục việc đã chia ({currentAllocatedCp} CP).
                </small>
              )}
            </div>

            <div className="task-modal-grid-2col">
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Loại nhiệm vụ
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: "#ffffff",
                  }}
                >
                  <option value="RESEARCH">🔬 Nghiên cứu AI / Lab (Research)</option>
                  <option value="INDUSTRY">🏢 Dự án doanh nghiệp (Industry)</option>
                  <option value="LAB_MAINTENANCE">🛠️ Bảo trì Lab (Lab Maintenance)</option>
                  <option value="EVENT">🎉 Sự kiện / Workshop (Event)</option>
                  <option value="OTHER">📁 Khác (Other)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Trưởng nhóm (Leader) phụ trách <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={leaderId}
                  onChange={(e) => setLeaderId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: "#ffffff",
                  }}
                >
                  {leaderMembers.length === 0 ? (
                    <option value="">-- Chưa có tài khoản Leader --</option>
                  ) : (
                    leaderMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} (@{m.username}) — [{m.role === 'leader' ? '⭐ Trưởng nhóm' : m.role === 'admin' ? '👑 Quản trị viên' : m.role}]
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* KHỐI 2: KẾ HOẠCH & THỜI HẠN */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
              <span>⏱️ 2. Kế hoạch & Thời hạn</span>
            </div>

            <div className="task-modal-grid-2col">
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Ngày dự kiến bắt đầu
                </label>
                <input
                  type="date"
                  value={plannedDate}
                  onChange={(e) => setPlannedDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: "#ffffff",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                  Hạn chót hoàn thành (Deadline) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                    background: "#ffffff",
                  }}
                />
              </div>
            </div>
          </div>

          {/* KHỐI 3: MÔ TẢ NHIỆM VỤ */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
              <span>📝 3. Mô tả nhiệm vụ</span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>
                Mô tả chi tiết nhiệm vụ
              </label>
              <textarea
                rows={4}
                placeholder="Nhập nội dung, yêu cầu kỹ thuật và mục tiêu cần đạt được..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  fontSize: 14,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  resize: "vertical",
                }}
              />
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 4, paddingTop: 12, borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#f1f5f9",
                color: "#475569",
                border: "1px solid #e2e8f0",
                padding: "10px 20px",
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "#ffffff",
                border: "none",
                padding: "10px 24px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s ease",
              }}
            >
              <CheckSquare size={16} />
              {loading ? "Đang lưu thay đổi..." : "Lưu Thay Đổi Nhiệm Vụ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
