import React, { useState, useEffect, useCallback } from "react";
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
  MapPin,
  Check,
  RotateCcw,
  PauseCircle
} from "lucide-react";

export function TasksPage() {
  const { user, isAdmin } = useAuth();
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
  const [reviewModalSubtask, setReviewModalSubtask] = useState(null); // { id, title, approve: bool }
  const [reviewComment, setReviewComment] = useState("");
  const [postponeModalTask, setPostponeModalTask] = useState(null);
  const [postponeReason, setPostponeReason] = useState("");
  const [toast, setToast] = useState({ text: "", type: "success" });

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

  const handleReviewSubtask = async () => {
    if (!reviewModalSubtask.approve && !reviewComment.trim()) {
      showToast("Vui lòng nhập nhận xét/lý do yêu cầu làm lại!", "danger");
      return;
    }
    try {
      const res = await api.reviewSubtask(reviewModalSubtask.id, reviewModalSubtask.approve, reviewComment.trim());
      showToast(res.message || "Đã xử lý nghiệm thu mục checklist!");
      setReviewModalSubtask(null);
      setReviewComment("");
      if (taskDetail) refreshTaskDetail(taskDetail.task.id);
    } catch (err) {
      showToast(err.message || "Lỗi khi duyệt checklist.", "danger");
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
    <div style={{ maxWidth: 1360, margin: "0 auto", padding: "24px 20px" }}>
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
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
                Nhiệm Vụ & Phân Công Dự Án (Tasks & Checklist)
              </h1>
              <p style={{ margin: "2px 0 0 0", fontSize: 13, color: "#64748b" }}>
                Quản lý các đề tài nghiên cứu, bảo trì phòng Lab, chuẩn bị sự kiện và quy trình nghiệm thu checklist 3 cấp
              </p>
            </div>
          </div>
        </div>

        {/* CREATE TASK BUTTON */}
        {isAdmin && (
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Tổng số nhiệm vụ</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ListTodo size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginTop: 8 }}>{totalCount}</div>
        </div>

        <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Đang triển khai</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fffbeb", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#d97706", marginTop: 8 }}>{inProgressCount}</div>
        </div>

        <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Checklist Chờ Duyệt</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#fef3c7", color: "#b45309", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#b45309", marginTop: 8 }}>{needsReviewCount}</div>
        </div>

        <div style={{ background: "#ffffff", padding: "16px 20px", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Đã nghiệm thu</span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#059669", marginTop: 8 }}>{finishedCount}</div>
        </div>
      </div>

      {/* FILTER CONTROLS & TABS */}
      <div
        style={{
          background: "#ffffff",
          padding: "16px 20px",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        {/* TABS */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all", label: "Tất cả nhiệm vụ", icon: ListTodo },
            { id: "my_tasks", label: "Việc của tôi", icon: User },
            { id: "needs_review", label: "Cần duyệt", count: needsReviewCount, icon: AlertCircle },
            { id: "finished", label: "Đã hoàn thành", icon: CheckCircle2 },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: isActive ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                  background: isActive ? "#eff6ff" : "#ffffff",
                  color: isActive ? "#1d4ed8" : "#64748b",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    style={{
                      background: isActive ? "#2563eb" : "#f59e0b",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: 10,
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* SEARCH & TYPE FILTER */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Tìm theo tên, địa điểm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "8px 12px 8px 32px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                width: 200,
                outline: "none",
              }}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 13,
              background: "#ffffff",
              color: "#334155",
              fontWeight: 600,
              outline: "none",
              cursor: "pointer",
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
          {isAdmin && (
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(410px, 1fr))", gap: 20 }}>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
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
                        Hạn chót: <strong>{task.deadline}</strong>
                      </span>
                    </div>

                    {task.location && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <MapPin size={14} color="#64748b" />
                        <span>{task.location}</span>
                      </div>
                    )}

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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
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
                    {isAdmin && task.status !== "POSTPONED" && task.status !== "FINISHED" && (
                      <button
                        onClick={() => {
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

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteTask(task.id)}
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
              const isLeaderOrAdmin = isAdmin || taskDetail.task.leader_id === user?.id;

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
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0", lineHeight: 1.4 }}>
                        {taskDetail.task.title}
                      </h3>
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
                        <span style={{ color: "#64748b" }}>Trưởng nhóm (Leader):</span>
                        <strong style={{ color: "#0f172a" }}>@{taskDetail.task.leader_name}</strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#64748b" }}>Ngày dự kiến (Planned):</span>
                        <strong style={{ color: "#334155" }}>{taskDetail.task.planned_date || "Chưa đặt"}</strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#64748b" }}>Hạn chót (Deadline):</span>
                        <strong style={{ color: "#dc2626", fontWeight: 800 }}>{taskDetail.task.deadline || "Không có"}</strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#64748b" }}>Địa điểm:</span>
                        <strong style={{ color: "#334155" }}>{taskDetail.task.location || "Chưa xác định"}</strong>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "#64748b" }}>Đối tác / Đơn vị:</span>
                        <strong style={{ color: "#334155" }}>{taskDetail.task.customer_info || "Nội bộ trường"}</strong>
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

                    {/* ADMIN / LEADER ACTION BUTTONS (FINISH & POSTPONE) */}
                    {isLeaderOrAdmin && (
                      <div style={{ display: "flex", gap: 10, marginTop: 4, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
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

                      {isLeaderOrAdmin && (
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
                          <span>Thêm Mục Việc (Leader)</span>
                        </button>
                      )}
                    </div>

                    {/* SUBTASKS LIST */}
                    {totalSub === 0 ? (
                      <div style={{ padding: "40px 0", textAlign: "center", border: "1.5px dashed #cbd5e1", borderRadius: 10, color: "#64748b" }}>
                        <CheckSquare size={32} style={{ color: "#94a3b8", marginBottom: 8 }} />
                        <div style={{ fontWeight: 600 }}>Nhiệm vụ này chưa có mục việc checklist nào.</div>
                        {isLeaderOrAdmin && (
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
                          const isAssignedToMe = sub.assignees?.some((a) => a.user_id === user?.id);

                          let statusBadge = { label: "Đang làm", bg: "#fef3c7", color: "#b45309", border: "#fde68a" };
                          if (sub.status === "REVIEW") {
                            statusBadge = { label: "🟡 Chờ duyệt", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
                          } else if (sub.status === "FINISHED") {
                            statusBadge = { label: "🟢 Hoàn thành", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" };
                          }

                          return (
                            <div
                              key={sub.id}
                              style={{
                                padding: 14,
                                borderRadius: 10,
                                background: sub.status === "FINISHED" ? "#fcfdfd" : sub.status === "REVIEW" ? "#fffbeb" : "#ffffff",
                                border: sub.status === "REVIEW" ? "1.5px solid #f59e0b" : "1px solid #e2e8f0",
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
                                      background: sub.status === "FINISHED" ? "#10b981" : "#e2e8f0",
                                      color: sub.status === "FINISHED" ? "#ffffff" : "#475569",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 800,
                                      fontSize: 12,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {sub.status === "FINISHED" ? <Check size={15} /> : idx + 1}
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
                                    </div>

                                    {sub.description && (
                                      <p style={{ margin: "4px 0 8px 0", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                                        {sub.description}
                                      </p>
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

                                    {sub.review_comment && (
                                      <div
                                        style={{
                                          marginTop: 8,
                                          padding: "6px 10px",
                                          background: sub.status === "FINISHED" ? "#f0fdf4" : "#fef2f2",
                                          border: `1px solid ${sub.status === "FINISHED" ? "#bbf7d0" : "#fecdd3"}`,
                                          borderRadius: 6,
                                          fontSize: 11,
                                          color: sub.status === "FINISHED" ? "#166534" : "#991b1b",
                                        }}
                                      >
                                        <strong>Nhận xét:</strong> {sub.review_comment}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* WORKFLOW BUTTONS FOR THIS SUBTASK */}
                                <div style={{ display: "flex", alignItems: "center", gap: 6, alignSelf: "center" }}>
                                  {/* 1. Member submits */}
                                  {sub.status === "PROCESSING" && (isAssignedToMe || isLeaderOrAdmin) && (
                                    <button
                                      onClick={() => handleSubmitSubtask(sub.id)}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 5,
                                        background: "#2563eb",
                                        color: "#ffffff",
                                        border: "none",
                                        padding: "6px 12px",
                                        borderRadius: 6,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                        boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
                                      }}
                                      title="Đã hoàn thành phần việc, nộp để Trưởng nhóm nghiệm thu"
                                    >
                                      <Send size={13} />
                                      <span>Nộp Duyệt</span>
                                    </button>
                                  )}

                                  {/* 2. Leader reviews */}
                                  {sub.status === "REVIEW" && isLeaderOrAdmin && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <button
                                        onClick={() => {
                                          setReviewModalSubtask({ id: sub.id, title: sub.title, approve: true });
                                          setReviewComment("Đã nghiệm thu đạt chuẩn.");
                                        }}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 4,
                                          background: "#10b981",
                                          color: "#ffffff",
                                          border: "none",
                                          padding: "6px 12px",
                                          borderRadius: 6,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                      >
                                        <Check size={14} />
                                        <span>Duyệt Đạt</span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setReviewModalSubtask({ id: sub.id, title: sub.title, approve: false });
                                          setReviewComment("");
                                        }}
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 4,
                                          background: "#fee2e2",
                                          color: "#b91c1c",
                                          border: "1px solid #fca5a5",
                                          padding: "6px 10px",
                                          borderRadius: 6,
                                          fontSize: 12,
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                      >
                                        <RotateCcw size={13} />
                                        <span>Yêu Cầu Sửa</span>
                                      </button>
                                    </div>
                                  )}

                                  {/* Delete subtask */}
                                  {isLeaderOrAdmin && (
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
          allMembers={allMembers}
          onSuccess={() => {
            refreshTaskDetail(taskDetail.task.id);
            showToast("Đã thêm mục checklist thành công!");
          }}
        />
      )}

      {/* ================= MODAL: REVIEW SUBTASK ================= */}
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
              borderRadius: 14,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
              {reviewModalSubtask.approve ? "✅ Nghiệm Thu Đạt Chuẩn" : "↩ Yêu Cầu Chỉnh Sửa Lại"}
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px 0" }}>
              Mục: <strong>{reviewModalSubtask.title}</strong>
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                {reviewModalSubtask.approve ? "Nhận xét nghiệm thu (Tùy chọn):" : "Nhận xét chi tiết lý do cần sửa (Bắt buộc):"}
              </label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder={reviewModalSubtask.approve ? "Đã nghiệm thu đạt chuẩn..." : "Cần kiểm tra lại các máy dãy B..."}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setReviewModalSubtask(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "#475569",
                }}
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleReviewSubtask}
                style={{
                  background: reviewModalSubtask.approve ? "#10b981" : "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {reviewModalSubtask.approve ? "Xác nhận Duyệt Đạt" : "Gửi Yêu Cầu Sửa"}
              </button>
            </div>
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
              borderRadius: 14,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
              Tạm Hoãn Nhiệm Vụ
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px 0" }}>
              Nhiệm vụ: <strong>{postponeModalTask.title}</strong>
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                Lý do tạm hoãn (Bắt buộc):
              </label>
              <textarea
                rows={3}
                value={postponeReason}
                onChange={(e) => setPostponeReason(e.target.value)}
                placeholder="Nhập lý do tạm hoãn nhiệm vụ..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setPostponeModalTask(null)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  color: "#475569",
                }}
              >
                Hủy bỏ
              </button>
              <button
                onClick={handlePostponeTask}
                style={{
                  background: "#64748b",
                  color: "#ffffff",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Xác nhận Tạm Hoãn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ================= MODAL COMPONENT: CREATE TASK =================
function CreateTaskModal({ isOpen, onClose, allMembers, onSuccess }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [taskType, setTaskType] = useState("LAB_MAINTENANCE");
  const [plannedDate, setPlannedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0] + " 17:00";
  });
  const [location, setLocation] = useState("Phòng Lab 301 & 402");
  const [customerInfo, setCustomerInfo] = useState("Khoa CNTT Greenwich");
  const [leaderId, setLeaderId] = useState(allMembers[0]?.id || 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề nhiệm vụ!");
      return;
    }
    if (!deadline.trim()) {
      setError("Vui lòng nhập thời hạn chót!");
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
        deadline: deadline.trim(),
        location: location.trim(),
        customer_info: customerInfo.trim(),
        leader_id: parseInt(leaderId),
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
          maxWidth: 600,
          padding: 24,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={20} color="#2563eb" />
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Khởi Tạo Nhiệm Vụ Mới
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: 8, fontSize: 13, color: "#991b1b", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Tiêu đề nhiệm vụ *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Bảo trì hệ thống phòng máy Lab 301..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box", outline: "none" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Loại nhiệm vụ
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box", background: "#fff" }}
              >
                <option value="LAB_MAINTENANCE">Bảo trì Lab</option>
                <option value="EVENT">Sự kiện / Workshop</option>
                <option value="INDUSTRY">Dự án Doanh nghiệp</option>
                <option value="RESEARCH">Nghiên cứu AI / Lab</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Trưởng nhóm phụ trách (Leader) *
              </label>
              <select
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box", background: "#fff" }}
              >
                {allMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name} ({m.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Ngày dự kiến bắt đầu
              </label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Hạn chót hoàn thành (Deadline) *
              </label>
              <input
                type="text"
                required
                placeholder="2026-10-15 17:00"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Địa điểm triển khai
              </label>
              <input
                type="text"
                placeholder="Lab 301, Hội trường..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
                Đơn vị / Đối tác phối hợp
              </label>
              <input
                type="text"
                placeholder="Khoa CNTT, Doanh nghiệp..."
                value={customerInfo}
                onChange={(e) => setCustomerInfo(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Mô tả chi tiết yêu cầu
            </label>
            <textarea
              rows={3}
              placeholder="Ghi chú mục tiêu, quy chuẩn hoàn thành của nhiệm vụ..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box", outline: "none" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "#f1f5f9", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#475569" }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "9px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              {loading ? "Đang tạo..." : "Tạo Nhiệm Vụ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ================= MODAL COMPONENT: ADD SUBTASK =================
function AddSubtaskModal({ isOpen, onClose, taskId, taskDeadline, allMembers, onSuccess }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState(taskDeadline || "");
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleAssignee = (userId) => {
    setSelectedAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Vui lòng nhập tiêu đề mục checklist!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.createSubtask(taskId, {
        title: title.trim(),
        description: description.trim(),
        due_at: dueAt.trim(),
        assignee_ids: selectedAssignees,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || "Lỗi khi thêm mục checklist.");
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={20} color="#2563eb" />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>
              Thêm Mục Việc Checklist
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecdd3", borderRadius: 8, fontSize: 13, color: "#991b1b", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Tiêu đề mục việc *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Kiểm tra và thay dây cáp mạng dãy máy B..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Hạn hoàn thành checklist
            </label>
            <input
              type="text"
              placeholder="2026-10-10 17:00"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
              Phân công thành viên thực hiện
            </label>
            <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              {allMembers.map((m) => {
                const checked = selectedAssignees.includes(m.id);
                return (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAssignee(m.id)}
                    />
                    <span>{m.full_name} ({m.username})</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>
              Hướng dẫn / Yêu cầu chi tiết
            </label>
            <textarea
              rows={2}
              placeholder="Mô tả tiêu chuẩn hoàn thành của đầu việc này..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "#f1f5f9", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#475569" }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "9px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              {loading ? "Đang thêm..." : "Thêm Vào Checklist"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
