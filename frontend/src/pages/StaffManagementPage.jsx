import { CompetencyScorecardPage } from "./CompetencyScorecardPage";
import React, { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";
import {
  Award,
  UserPlus, 
  ShieldCheck, 
  UserCheck, 
  Mail, 
  Key,
  Edit3,
  Lock,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  Shield,
  Plus,
  Trash2,
  Search,
  Filter,
  Check,
  ChevronRight,
  Info,
  Calendar,
  CheckSquare,
  Sparkles,
  Phone,
  Briefcase
} from "lucide-react";

export function StaffManagementPage({ onNavigateToCompetency }) {
  const [activeTab, setActiveTab] = useState("staff"); // "staff" | "departments" | "roles"
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  // Sắp xếp 5 role chuẩn: admin > core > leader > contributor > learning
  const ROLE_HIERARCHY = { admin: 1, core: 2, leader: 3, contributor: 4, learning: 5 };
  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => {
      const ordA = ROLE_HIERARCHY[a.id] || 99;
      const ordB = ROLE_HIERARCHY[b.id] || 99;
      return ordA - ordB;
    });
  }, [roles]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ text: "", type: "success" });

  // Filters for Staff list
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Add User Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("contributor");
  const [department, setDepartment] = useState("Tổ Trực Vận Hành");
  const [submitting, setSubmitting] = useState(false);

  // Reset Password Modal states
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Edit User Modal states
  const [editUser, setEditUser] = useState(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editRole, setEditRole] = useState("contributor");
  const [editStatus, setEditStatus] = useState("active");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Department Modal states
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptManager, setDeptManager] = useState("");
  const [deptColor, setDeptColor] = useState("#2563eb");
  const [deptSubmitting, setDeptSubmitting] = useState(false);

  // Role Modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleId, setRoleId] = useState("");
  const [roleDisplayName, setRoleDisplayName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [roleColor, setRoleColor] = useState("#3b82f6");
  const [roleCanSchedule, setRoleCanSchedule] = useState(false);
  const [roleCanTasks, setRoleCanTasks] = useState(false);
  const [roleCanStaff, setRoleCanStaff] = useState(false);
  const [roleCanEvaluate, setRoleCanEvaluate] = useState(false);
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'department' | 'role', item }
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const COLOR_PRESETS = [
    "#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", 
    "#0891b2", "#ec4899", "#8b5cf6", "#475569"
  ];

  const showToastMsg = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "success" }), 3500);
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [uData, dData, rData] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getDepartments().catch(() => []),
        api.getRoles().catch(() => [])
      ]);
      setUsers(uData);
      setDepartments(dData);
      setRoles(rData);

      // Default department for add form
      if (dData.length > 0 && !department) {
        setDepartment(dData[0].name);
      }
    } catch (err) {
      console.error("Failed to load staff management data:", err);
      showToastMsg("Không thể tải dữ liệu", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Map roles by ID for quick lookup
  const roleMap = useMemo(() => {
    const map = {};
    roles.forEach(r => { map[r.id] = r; });
    return map;
  }, [roles]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = !searchTerm || 
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.phone?.includes(searchTerm);
      
      const matchDept = !filterDepartment || u.department === filterDepartment;
      const matchRole = !filterRole || u.role === filterRole;
      const matchStatus = !filterStatus || u.status === filterStatus;

      return matchSearch && matchDept && matchRole && matchStatus;
    });
  }, [users, searchTerm, filterDepartment, filterRole, filterStatus]);

  // 1. Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!username || !password || !fullName || !email) {
      showToastMsg("Vui lòng điền đầy đủ các thông tin bắt buộc (*)", "danger");
      return;
    }

    try {
      setSubmitting(true);
      await api.createUser({
        username: username.trim(),
        password,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        department: department || "Tổ Trực Vận Hành",
      });

      showToastMsg("Cấp tài khoản mới thành công!");
      setShowAddModal(false);
      setUsername("");
      setPassword("");
      setFullName("");
      setEmail("");
      setPhone("");
      loadAllData();
    } catch (err) {
      showToastMsg(err.message || "Tạo tài khoản thất bại!", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Reset Password Modal
  const handleOpenReset = (u) => {
    setResetUser(u);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPw(false);
  };

  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToastMsg("Mật khẩu mới phải có tối thiểu 6 ký tự!", "danger");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToastMsg("Mật khẩu xác nhận không khớp!", "danger");
      return;
    }

    try {
      setResetSubmitting(true);
      const res = await api.adminResetPassword(resetUser.id, newPassword);
      showToastMsg(res.message || `Đã đặt lại mật khẩu cho ${resetUser.full_name}!`);
      setResetUser(null);
    } catch (err) {
      showToastMsg(err.message || "Đặt lại mật khẩu thất bại!", "danger");
    } finally {
      setResetSubmitting(false);
    }
  };

  // 3. Edit User Modal
  const handleOpenEdit = (u) => {
    setEditUser(u);
    setEditFullName(u.full_name || "");
    setEditEmail(u.email || "");
    setEditPhone(u.phone || "");
    setEditDepartment(u.department || (departments[0]?.name || "Tổ Trực Vận Hành"));
    setEditRole(u.role || "staff");
    setEditStatus(u.status || "active");
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editFullName.trim() || !editEmail.trim()) {
      showToastMsg("Họ tên và Email không được để trống!", "danger");
      return;
    }

    try {
      setEditSubmitting(true);
      const res = await api.updateUser(editUser.id, {
        full_name: editFullName.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
        department: editDepartment,
        role: editRole,
        status: editStatus,
      });
      showToastMsg(res.message || "Cập nhật tài khoản thành công!");
      setEditUser(null);
      loadAllData();
    } catch (err) {
      showToastMsg(err.message || "Cập nhật thất bại!", "danger");
    } finally {
      setEditSubmitting(false);
    }
  };

  // 4. Department Modal Handlers
  const handleOpenAddDept = () => {
    setEditingDept(null);
    setDeptName("");
    setDeptCode("");
    setDeptDesc("");
    setDeptManager("");
    setDeptColor("#2563eb");
    setShowDeptModal(true);
  };

  const handleOpenEditDept = (dept) => {
    setEditingDept(dept);
    setDeptName(dept.name || "");
    setDeptCode(dept.code || "");
    setDeptDesc(dept.description || "");
    setDeptManager(dept.manager_name || "");
    setDeptColor(dept.color || "#2563eb");
    setShowDeptModal(true);
  };

  const handleSaveDepartment = async (e) => {
    e.preventDefault();
    if (!deptName.trim()) {
      showToastMsg("Vui lòng nhập tên phòng ban / tổ trực!", "danger");
      return;
    }

    try {
      setDeptSubmitting(true);
      if (editingDept) {
        await api.updateDepartment(editingDept.id, {
          name: deptName.trim(),
          code: deptCode.trim(),
          description: deptDesc.trim(),
          manager_name: deptManager.trim(),
          color: deptColor,
        });
        showToastMsg("Cập nhật phòng ban thành công!");
      } else {
        await api.createDepartment({
          name: deptName.trim(),
          code: deptCode.trim(),
          description: deptDesc.trim(),
          manager_name: deptManager.trim(),
          color: deptColor,
        });
        showToastMsg("Thêm phòng ban mới thành công!");
      }
      setShowDeptModal(false);
      loadAllData();
    } catch (err) {
      showToastMsg(err.message || "Thao tác phòng ban thất bại!", "danger");
    } finally {
      setDeptSubmitting(false);
    }
  };

  // 5. Role Modal Handlers
  const handleOpenAddRole = () => {
    setEditingRole(null);
    setRoleId("");
    setRoleDisplayName("");
    setRoleDesc("");
    setRoleColor("#3b82f6");
    setRoleCanSchedule(false);
    setRoleCanTasks(false);
    setRoleCanStaff(false);
    setRoleCanEvaluate(false);
    setShowRoleModal(true);
  };

  const handleOpenEditRole = (r) => {
    setEditingRole(r);
    setRoleId(r.id);
    setRoleDisplayName(r.display_name || "");
    setRoleDesc(r.description || "");
    setRoleColor(r.color || "#3b82f6");
    setRoleCanSchedule(!!r.can_manage_schedule);
    setRoleCanTasks(!!r.can_manage_tasks);
    setRoleCanStaff(!!r.can_manage_staff);
    setRoleCanEvaluate(!!r.can_evaluate);
    setShowRoleModal(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleDisplayName.trim() || (!editingRole && !roleId.trim())) {
      showToastMsg("Vui lòng nhập đầy đủ mã và tên vai trò!", "danger");
      return;
    }

    try {
      setRoleSubmitting(true);
      if (editingRole) {
        await api.updateRole(editingRole.id, {
          display_name: roleDisplayName.trim(),
          description: roleDesc.trim(),
          color: roleColor,
          can_manage_schedule: roleCanSchedule,
          can_manage_tasks: roleCanTasks,
          can_manage_staff: roleCanStaff,
          can_evaluate: roleCanEvaluate,
        });
        showToastMsg("Cập nhật vai trò thành công!");
      } else {
        await api.createRole({
          id: roleId.trim().toLowerCase().replace(/\s+/g, "_"),
          display_name: roleDisplayName.trim(),
          description: roleDesc.trim(),
          color: roleColor,
          can_manage_schedule: roleCanSchedule,
          can_manage_tasks: roleCanTasks,
          can_manage_staff: roleCanStaff,
          can_evaluate: roleCanEvaluate,
        });
        showToastMsg("Thêm vai trò mới thành công!");
      }
      setShowRoleModal(false);
      loadAllData();
    } catch (err) {
      showToastMsg(err.message || "Thao tác vai trò thất bại!", "danger");
    } finally {
      setRoleSubmitting(false);
    }
  };

  // 6. Delete Action Confirmation
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteSubmitting(true);
      if (deleteTarget.type === "department") {
        await api.deleteDepartment(deleteTarget.item.id);
        showToastMsg(`Đã xóa phòng ban "${deleteTarget.item.name}" thành công!`);
      } else if (deleteTarget.type === "role") {
        await api.deleteRole(deleteTarget.item.id);
        showToastMsg(`Đã xóa vai trò "${deleteTarget.item.display_name}" thành công!`);
      }
      setDeleteTarget(null);
      loadAllData();
    } catch (err) {
      showToastMsg(err.message || "Không thể xóa mục này!", "danger");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto", padding: "16px 20px 60px 20px", boxSizing: "border-box" }}>
      {/* Toast Alert */}
      {toast.text && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 10,
            background: toast.type === "danger" ? "#ef4444" : "#10b981",
            color: "#fff",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "fadeIn 0.2s ease-out"
          }}
        >
          {toast.type === "danger" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.text}
        </div>
      )}

      {/* Main Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: "clamp(18px, 3.5vw, 24px)", fontWeight: 800, color: "var(--text-main)", marginBottom: 4 }}>
            Quản Lý Tổ Chức & Nhân Sự
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Quản lý tập trung tài khoản nhân viên, sơ đồ phòng ban và cấu hình vai trò & quyền hạn (RBAC)
          </p>
        </div>

        {/* Quick action buttons according to active tab */}
        <div style={{ display: "flex", gap: 10 }}>
          {activeTab === "staff" && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
              style={{ boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)", display: "flex", alignItems: "center", gap: 6 }}
            >
              <UserPlus size={16} /> Cấp Tài Khoản Mới
            </button>
          )}
          {activeTab === "departments" && (
            <button
              onClick={handleOpenAddDept}
              className="btn btn-primary"
              style={{ boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={16} /> Thêm Phòng Ban Mới
            </button>
          )}
          {activeTab === "roles" && (
            <button
              onClick={handleOpenAddRole}
              className="btn btn-primary"
              style={{ boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)", display: "flex", alignItems: "center", gap: 6 }}
            >
              <Plus size={16} /> Tạo Vai Trò Mới
            </button>
          )}
        </div>
      </div>

      {/* Competency Radar Banner Alert */}
      <div
        style={{
          background: "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)",
          border: "1px solid #c4b5fd",
          borderRadius: 14,
          padding: "12px 18px",
          marginBottom: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#7c3aed",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 10px rgba(124, 58, 237, 0.25)",
              flexShrink: 0
            }}
          >
            <Award size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#1e1b4b" }}>
              Bảng Điểm Đánh Giá Năng Lực Thành Viên (Biểu Đồ Tam Giác Blue Lock)
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Đã tích hợp 3 trụ cột (Quản lý, Kỹ thuật, Research) & 5 cấp bậc vai trò theo bảng đánh giá Lab.
            </div>
          </div>
        </div>
        <button
          onClick={() => setActiveTab("competency")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#7c3aed",
            color: "#ffffff",
            border: "none",
            fontWeight: 800,
            fontSize: 12.5,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.3)",
          }}
        >
          <span>Xem Thẻ Điểm Ngay</span>
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Sub-Navigation Tabs (Touch-scrollable on mobile) */}
      <div style={{
        display: "flex",
        gap: 8,
        borderBottom: "1px solid var(--border)",
        marginBottom: 20,
        paddingBottom: 2,
        overflowX: "auto",
        whiteSpace: "nowrap",
        WebkitOverflowScrolling: "touch",
      }}>
        <button
          onClick={() => setActiveTab("staff")}
          style={{
            padding: "10px 18px",
            borderRadius: "8px 8px 0 0",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
            background: activeTab === "staff" ? "var(--surface)" : "transparent",
            color: activeTab === "staff" ? "#2563eb" : "var(--text-muted)",
            borderBottom: activeTab === "staff" ? "3px solid #2563eb" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s ease"
          }}
        >
          <Users size={16} /> Danh Sách Nhân Sự ({users.length})
        </button>

        <button
          onClick={() => setActiveTab("departments")}
          style={{
            padding: "10px 18px",
            borderRadius: "8px 8px 0 0",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
            background: activeTab === "departments" ? "var(--surface)" : "transparent",
            color: activeTab === "departments" ? "#2563eb" : "var(--text-muted)",
            borderBottom: activeTab === "departments" ? "3px solid #2563eb" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s ease"
          }}
        >
          <Building2 size={16} /> Quản Lý Phòng Ban / Tổ Trực ({departments.length})
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          style={{
            padding: "10px 18px",
            borderRadius: "8px 8px 0 0",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
            background: activeTab === "roles" ? "var(--surface)" : "transparent",
            color: activeTab === "roles" ? "#2563eb" : "var(--text-muted)",
            borderBottom: activeTab === "roles" ? "3px solid #2563eb" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s ease"
          }}
        >
          <Shield size={16} /> Quản Lý Vai Trò & Quyền Hạn ({roles.length})
        </button>

        <button
          onClick={() => setActiveTab("competency")}
          style={{
            padding: "10px 18px",
            borderRadius: "8px 8px 0 0",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
            background: activeTab === "competency" ? "var(--surface)" : "transparent",
            color: activeTab === "competency" ? "#7c3aed" : "var(--text-muted)",
            borderBottom: activeTab === "competency" ? "3px solid #7c3aed" : "3px solid transparent",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.15s ease",
            whiteSpace: "nowrap"
          }}
        >
          <Award size={16} color={activeTab === "competency" ? "#7c3aed" : "currentColor"} />
          <span>Bảng Điểm Năng Lực (Radar Tam Giác)</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: DANH SÁCH NHÂN SỰ                                  */}
      {/* ======================================================== */}
      {activeTab === "staff" && (
        <div>
          {/* Filter Bar */}
          <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 18 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 12,
              alignItems: "center"
            }}>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <Search size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Tìm họ tên, email, sđt..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: 36, height: 40 }}
                />
              </div>

              {/* Department Filter */}
              <div>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="form-input"
                  style={{ height: 40 }}
                >
                  <option value="">🏢 Tất cả phòng ban ({departments.length})</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="form-input"
                  style={{ height: 40 }}
                >
                  <option value="">🛡️ Tất cả vai trò ({roles.length})</option>
                  {sortedRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.display_name}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="form-input"
                  style={{ height: 40 }}
                >
                  <option value="">⚡ Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm khóa</option>
                </select>
              </div>
            </div>

            {(searchTerm || filterDepartment || filterRole || filterStatus) && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--border)", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>
                  Tìm thấy <strong>{filteredUsers.length}</strong> / {users.length} tài khoản phù hợp
                </span>
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterDepartment("");
                    setFilterRole("");
                    setFilterStatus("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    cursor: "pointer",
                    fontWeight: 600
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}
          </div>

          {/* Users Table */}
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Nhân viên</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Tên đăng nhập</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Email nhận thông báo</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Số điện thoại</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Phòng ban / Tổ trực</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Vai trò hệ thống</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Trạng thái</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                        Không tìm thấy tài khoản nhân sự nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const userRoleObj = roleMap[u.role] || { 
                        display_name: u.role === "admin" ? "Quản trị viên" : (u.role === "staff" ? "Nhân viên" : u.role),
                        color: u.role === "admin" ? "#7c3aed" : "#2563eb" 
                      };
                      const isLocked = u.status === "inactive" || u.status === "locked";
                      return (
                        <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: `${userRoleObj.color}18`,
                                color: userRoleObj.color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: 14
                              }}>
                                {u.full_name?.charAt(0) || u.username?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span style={{ fontWeight: 700, color: "#0f172a", display: "block" }}>{u.full_name}</span>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "14px 20px", fontFamily: "monospace", color: "#334155" }}>
                            {u.username}
                          </td>
                          <td style={{ padding: "14px 20px", color: "#2563eb" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Mail size={13} /> {u.email}
                            </div>
                          </td>
                          <td style={{ padding: "14px 20px", color: "var(--text-muted)" }}>
                            {u.phone ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <Phone size={12} color="#64748b" /> {u.phone}
                              </div>
                            ) : "---"}
                          </td>
                          <td style={{ padding: "14px 20px", color: "#475569" }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "#f1f5f9",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#334155"
                            }}>
                              <Building2 size={12} color="#64748b" /> {u.department || "Chưa phân bổ"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 20px" }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 10px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              background: `${userRoleObj.color}15`,
                              color: userRoleObj.color,
                              border: `1px solid ${userRoleObj.color}35`
                            }}>
                              <ShieldCheck size={13} /> {userRoleObj.display_name}
                            </span>
                          </td>
                          <td style={{ padding: "14px 20px" }}>
                            {isLocked ? (
                              <span className="badge" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                                Tạm khóa
                              </span>
                            ) : (
                              <span className="badge badge-green">Hoạt động</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 20px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                              <button
                                onClick={() => setActiveTab("competency")}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#6d28d9",
                                  background: "#f5f3ff",
                                  border: "1px solid #ddd6fe",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                                title={`Xem thẻ điểm năng lực & biểu đồ radar tam giác của ${u.full_name}`}
                              >
                                <Award size={13} /> Thẻ Điểm
                              </button>
                              <button
                                onClick={() => handleOpenReset(u)}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "#b45309",
                                  background: "#fffbeb",
                                  border: "1px solid #fde68a",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                                title={`Đổi mật khẩu cho ${u.full_name} khi quên`}
                              >
                                <Key size={13} /> Đổi MK
                              </button>
                              <button
                                onClick={() => handleOpenEdit(u)}
                                className="btn btn-secondary btn-sm"
                                style={{
                                  padding: "5px 10px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: "#1d4ed8",
                                  background: "#eff6ff",
                                  border: "1px solid #bfdbfe",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                                title={`Sửa thông tin tài khoản ${u.full_name}`}
                              >
                                <Edit3 size={13} /> Sửa
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: QUẢN LÝ PHÒNG BAN / TỔ TRỰC                        */}
      {/* ======================================================== */}
      {activeTab === "departments" && (
        <div>
          {/* Department Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
            marginBottom: 20
          }}>
            <div className="glass-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#dbeafe", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Building2 size={24} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{departments.length}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Tổng số phòng ban / tổ trực</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#d1fae5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={24} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
                  {departments.reduce((sum, d) => sum + (d.member_count || 0), 0)}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nhân sự đã phân bổ theo phòng</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Briefcase size={24} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {departments.length > 0 ? [...departments].sort((a,b) => (b.member_count||0) - (a.member_count||0))[0]?.name : "---"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Phòng ban có đông nhân sự nhất</div>
              </div>
            </div>
          </div>

          {/* Department Cards Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: 16
          }}>
            {departments.map((dept) => (
              <div key={dept.id} className="glass-card" style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                borderTop: `4px solid ${dept.color || "#2563eb"}`
              }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                        {dept.name}
                      </h3>
                      {dept.code && (
                        <span style={{
                          display: "inline-block",
                          marginTop: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "#f1f5f9",
                          color: "#475569"
                        }}>
                          Mã: {dept.code}
                        </span>
                      )}
                    </div>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontSize: 12,
                      fontWeight: 700
                    }}>
                      {dept.member_count || 0} thành viên
                    </span>
                  </div>

                  <p style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    margin: "10px 0 16px 0",
                    lineHeight: 1.4,
                    minHeight: 38
                  }}>
                    {dept.description || "Chưa có mô tả chức năng cho phòng ban này."}
                  </p>

                  <div style={{
                    fontSize: 12,
                    color: "#475569",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    <UserCheck size={14} color="#64748b" />
                    <span>Phụ trách: <strong>{dept.manager_name || "Chưa bổ nhiệm"}</strong></span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  paddingTop: 12,
                  borderTop: "1px solid var(--border)"
                }}>
                  <button
                    onClick={() => handleOpenEditDept(dept)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <Edit3 size={13} /> Chỉnh sửa
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ type: "department", item: dept })}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "#dc2626",
                      borderColor: "#fecaca"
                    }}
                    title="Xóa phòng ban này"
                  >
                    <Trash2 size={13} /> Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: QUẢN LÝ VAI TRÒ & QUYỀN HẠN (RBAC)                 */}
      {/* ======================================================== */}
      {activeTab === "roles" && (
        <div>
          {/* Roles Intro Card */}
          <div className="glass-card" style={{
            padding: "18px 22px",
            marginBottom: 20,
            background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)",
            borderLeft: "4px solid #2563eb"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <ShieldCheck size={20} color="#2563eb" />
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e3a8a" }}>
                Hệ Thống Phân Quyền Theo Vai Trò (Role-Based Access Control)
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
              Mỗi tài khoản nhân sự được gán một vai trò xác định quyền hạn trên hệ thống. 
              Bạn có thể xem ma trận quyền hạn dưới đây hoặc tạo thêm vai trò mới để đáp ứng nhu cầu quản trị chuyên biệt.
            </p>
          </div>

          {/* Roles Table */}
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Tên vai trò</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Mã hệ thống</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Mô tả trách nhiệm & chức năng</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Phân ca trực</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Giao việc</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Quản lý nhân sự</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Đánh giá năng lực</th>
                    <th style={{ padding: "14px 16px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Số nhân sự</th>
                    <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => {
                    const isSys = r.is_system;
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 10px",
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700,
                              background: `${r.color || "#3b82f6"}18`,
                              color: r.color || "#3b82f6",
                              border: `1px solid ${r.color || "#3b82f6"}35`
                            }}>
                              <Shield size={12} /> {r.display_name}
                            </span>
                            {isSys ? (
                              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#f1f5f9", color: "#64748b", fontWeight: 700 }}>
                                Mặc định
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#ecfdf5", color: "#059669", fontWeight: 700 }}>
                                Tùy chỉnh
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px", fontFamily: "monospace", color: "#475569" }}>
                          {r.id}
                        </td>
                        <td style={{ padding: "14px 20px", color: "var(--text-muted)", maxWidth: 320, lineHeight: 1.4 }}>
                          {r.description || "Chưa có mô tả chi tiết."}
                        </td>
                        {/* Can schedule */}
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          {r.id === "admin" || r.can_manage_schedule ? (
                            <span style={{ color: "#059669", fontWeight: 700 }}>✓ Có</span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        {/* Can tasks */}
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          {r.id === "admin" || r.can_manage_tasks ? (
                            <span style={{ color: "#059669", fontWeight: 700 }}>✓ Có</span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        {/* Can staff */}
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          {r.id === "admin" || r.can_manage_staff ? (
                            <span style={{ color: "#059669", fontWeight: 700 }}>✓ Có</span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        {/* Can evaluate */}
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          {r.id === "admin" || r.can_evaluate ? (
                            <span style={{ color: "#059669", fontWeight: 700 }}>✓ Có</span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        {/* Member count */}
                        <td style={{ padding: "14px 16px", textAlign: "center" }}>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "#f1f5f9",
                            fontWeight: 700,
                            color: "#334155"
                          }}>
                            {r.user_count || 0}
                          </span>
                        </td>
                        {/* Actions */}
                        <td style={{ padding: "14px 20px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button
                              onClick={() => handleOpenEditRole(r)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "5px 10px", fontSize: 12 }}
                              title="Chỉnh sửa tên và quyền hạn vai trò này"
                            >
                              <Edit3 size={13} /> Sửa
                            </button>
                            {!isSys && (
                              <button
                                onClick={() => setDeleteTarget({ type: "role", item: r })}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: "5px 10px", fontSize: 12, color: "#dc2626", borderColor: "#fecaca" }}
                                title="Xóa vai trò tùy chỉnh này"
                              >
                                <Trash2 size={13} /> Xóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: BẢNG ĐIỂM NĂNG LỰC & BIỂU ĐỒ RADAR TAM GIÁC       */}
      {/* ======================================================== */}
      {activeTab === "competency" && (
        <div style={{ marginTop: 8 }}>
          <CompetencyScorecardPage />
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CẤP TÀI KHOẢN MỚI (DYNAMIC ROLES & DEPTS)       */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px", maxWidth: 540 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Cấp Tài Khoản Mới</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>Khởi tạo tài khoản nhân sự vào hệ thống</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="btn-close" style={{ border: "none", background: "none", cursor: "pointer" }}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Tên đăng nhập: *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ví dụ: nv_nam"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mật khẩu khởi tạo: *</label>
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">Họ và tên đầy đủ: *</label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <div className="form-group">
                  <label className="form-label">Email nhận lịch: *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@company.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Số điện thoại:</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0912345678"
                  />
                </div>
              </div>

              {/* DYNAMIC DEPARTMENT & ROLE DROPDOWNS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>Phòng ban / Tổ trực:</label>
                    <button
                      type="button"
                      onClick={() => { setShowAddModal(false); handleOpenAddDept(); }}
                      style={{ fontSize: 11, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      + Thêm mới
                    </button>
                  </div>
                  <select
                    className="form-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                    {departments.length === 0 && (
                      <option value="Tổ Trực Vận Hành">Tổ Trực Vận Hành</option>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>Vai trò hệ thống:</label>
                    <button
                      type="button"
                      onClick={() => { setShowAddModal(false); handleOpenAddRole(); }}
                      style={{ fontSize: 11, color: "#2563eb", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      + Quản lý role
                    </button>
                  </div>
                  <select
                    className="form-input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.display_name}
                      </option>
                    ))}
                    {roles.length === 0 && (
                      <>
                        <option value="staff">Nhân viên (Staff)</option>
                        <option value="admin">Quản lý (Admin)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Hint about selected role permissions */}
              {roleMap[role] && (
                <div style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  color: "#475569"
                }}>
                  <div style={{ fontWeight: 700, color: roleMap[role].color, marginBottom: 2 }}>
                    🛡️ {roleMap[role].display_name}:
                  </div>
                  {roleMap[role].description || "Vai trò tiêu chuẩn của hệ thống."}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? "Đang cấp..." : "Xác Nhận Cấp Tài Khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: RESET PASSWORD                                   */}
      {/* ======================================================== */}
      {resetUser && (
        <div className="modal-overlay" onClick={() => setResetUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px", maxWidth: 460 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "#fffbeb",
                  color: "#d97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Key size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Đổi Mật Khẩu Cho Nhân Sự</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    {resetUser.full_name} ({resetUser.username})
                  </p>
                </div>
              </div>
              <button onClick={() => setResetUser(null)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <div style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontSize: 12,
              color: "#1e40af",
              marginBottom: 16
            }}>
              💡 <strong>Dành cho Quản lý:</strong> Bạn có thể trực tiếp đặt mật khẩu mới cho nhân sự khi họ quên hoặc cần cấp lại, không yêu cầu mật khẩu cũ.
            </div>

            <form onSubmit={handleAdminResetPassword}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Mật khẩu mới (tối thiểu 6 ký tự): *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showNewPw ? "text" : "password"}
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới"
                    required
                    style={{ paddingRight: 36 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#64748b"
                    }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Xác nhận mật khẩu mới: *</label>
                <input
                  type={showNewPw ? "text" : "password"}
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={resetSubmitting}
                  className="btn btn-primary"
                  style={{ background: "#d97706", borderColor: "#d97706" }}
                >
                  {resetSubmitting ? "Đang cập nhật..." : "Cập Nhật Mật Khẩu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CHỈNH SỬA NHÂN VIÊN                              */}
      {/* ======================================================== */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px", maxWidth: 520 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Chỉnh Sửa Thông Tin Nhân Sự</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    Tài khoản: @{editUser.username}
                  </p>
                </div>
              </div>
              <button onClick={() => setEditUser(null)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Họ và tên đầy đủ: *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Email: *</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Số điện thoại:</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Phòng ban / Tổ trực:</label>
                <select
                  className="form-input"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                  {departments.length === 0 && (
                    <option value="Tổ Trực Vận Hành">Tổ Trực Vận Hành</option>
                  )}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Vai trò hệ thống:</label>
                  <select
                    className="form-input"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.display_name}
                      </option>
                    ))}
                    {roles.length === 0 && (
                      <>
                        <option value="staff">Nhân viên (Staff)</option>
                        <option value="admin">Quản lý (Admin)</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Trạng thái:</label>
                  <select
                    className="form-input"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Tạm khóa tài khoản</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="btn btn-primary"
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Edit3 size={15} />
                  {editSubmitting ? "Đang lưu..." : "Lưu Thay Đổi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: THÊM / SỬA PHÒNG BAN                            */}
      {/* ======================================================== */}
      {showDeptModal && (
        <div className="modal-overlay" onClick={() => setShowDeptModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px", maxWidth: 500 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                    {editingDept ? "Chỉnh Sửa Phòng Ban / Tổ Trực" : "Thêm Phòng Ban / Tổ Trực Mới"}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    Quản lý cơ cấu tổ chức và phân chia nhân lực
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDeptModal(false)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleSaveDepartment}>
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Tên phòng ban / tổ trực: *</label>
                <input
                  type="text"
                  className="form-input"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="ví dụ: Tổ Trực Ca Đêm"
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Mã viết tắt:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                    placeholder="ví dụ: CA_DEM"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Người phụ trách:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={deptManager}
                    onChange={(e) => setDeptManager(e.target.value)}
                    placeholder="Họ tên trưởng nhóm"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Mô tả chức năng & nhiệm vụ:</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  placeholder="Mô tả phạm vi trách nhiệm của tổ trực..."
                />
              </div>

              {/* Color Presets */}
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Màu nhận diện phòng ban:</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDeptColor(c)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: c,
                        border: deptColor === c ? "3px solid #0f172a" : "2px solid #fff",
                        cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={deptColor}
                    onChange={(e) => setDeptColor(e.target.value)}
                    style={{ width: 34, height: 32, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={deptSubmitting}
                  className="btn btn-primary"
                >
                  {deptSubmitting ? "Đang lưu..." : (editingDept ? "Cập Nhật" : "Tạo Phòng Ban")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: THÊM / SỬA VAI TRÒ (ROLES & PERMISSIONS)        */}
      {/* ======================================================== */}
      {showRoleModal && (
        <div className="modal-overlay" onClick={() => setShowRoleModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px", maxWidth: 540 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "#f5f3ff",
                  color: "#7c3aed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <Shield size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                    {editingRole ? "Chỉnh Sửa Vai Trò & Quyền Hạn" : "Tạo Vai Trò Mới"}
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    Cấu hình cấp độ truy cập và phân quyền hệ thống
                  </p>
                </div>
              </div>
              <button onClick={() => setShowRoleModal(false)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                <X size={20} color="#94a3b8" />
              </button>
            </div>

            <form onSubmit={handleSaveRole}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Mã vai trò (ID): *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    placeholder="ví dụ: technician"
                    disabled={!!editingRole}
                    required
                    style={{ fontFamily: "monospace" }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tên hiển thị: *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={roleDisplayName}
                    onChange={(e) => setRoleDisplayName(e.target.value)}
                    placeholder="ví dụ: Kỹ thuật viên"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Mô tả trách nhiệm & chức năng:</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Mô tả quyền hạn của vai trò này..."
                />
              </div>

              {/* Color Presets */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Màu sắc Badge nhận diện:</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setRoleColor(c)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: c,
                        border: roleColor === c ? "3px solid #0f172a" : "2px solid #fff",
                        cursor: "pointer",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={roleColor}
                    onChange={(e) => setRoleColor(e.target.value)}
                    style={{ width: 34, height: 30, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer" }}
                  />
                </div>
              </div>

              {/* Permissions Checkboxes */}
              <div style={{
                padding: "14px",
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid var(--border)",
                marginBottom: 20
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
                  Thiết lập quyền hạn truy cập:
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={roleCanSchedule}
                      onChange={(e) => setRoleCanSchedule(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span><strong>Phân ca & Duyệt ca trực:</strong> Được xếp lịch cho nhân viên, duyệt đổi ca / xin nghỉ</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={roleCanTasks}
                      onChange={(e) => setRoleCanTasks(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span><strong>Giao việc & Duyệt nhiệm vụ:</strong> Tạo task/subtask, duyệt kết quả công việc checklist</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={roleCanStaff}
                      onChange={(e) => setRoleCanStaff(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span><strong>Quản lý nhân sự & phòng ban:</strong> Cấp tài khoản mới, phân phòng ban, đặt lại mật khẩu</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={roleCanEvaluate}
                      onChange={(e) => setRoleCanEvaluate(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span><strong>Đánh giá năng lực:</strong> Được chấm điểm bảng năng lực nhân sự, đánh giá tiêu chí và xếp hạng</span>
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={roleSubmitting}
                  className="btn btn-primary"
                >
                  {roleSubmitting ? "Đang lưu..." : (editingRole ? "Cập Nhật" : "Tạo Vai Trò")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 6: XÁC NHẬN XÓA PHÒNG BAN HOẶC VAI TRÒ             */}
      {/* ======================================================== */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "24px", maxWidth: 440 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#991b1b" }}>
                  Xác nhận xóa {deleteTarget.type === "department" ? "phòng ban" : "vai trò"}?
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                  Thao tác này không thể hoàn tác.
                </p>
              </div>
            </div>

            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.5, marginBottom: 20 }}>
              Bạn có chắc chắn muốn xóa {deleteTarget.type === "department" ? "phòng ban" : "vai trò"}{" "}
              <strong>"{deleteTarget.type === "department" ? deleteTarget.item.name : deleteTarget.item.display_name}"</strong>?
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn btn-secondary"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={confirmDelete}
                className="btn btn-primary"
                style={{ background: "#dc2626", borderColor: "#dc2626" }}
              >
                {deleteSubmitting ? "Đang xóa..." : "Xác Nhận Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
