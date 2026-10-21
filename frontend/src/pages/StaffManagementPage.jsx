import React, { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import {
  RefreshCw,
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
  const auth = useAuth() || {};
  const user = auth.user || null;
  const updateCurrentUser = auth.updateCurrentUser;
  const isAdmin = auth.isAdmin ?? false;
  const canManageStaff = auth.canManageStaff ?? false;
  const isRoleAdmin = isAdmin || Boolean(canManageStaff);

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
      setUsers(Array.isArray(uData) ? uData : []);
      setDepartments(Array.isArray(dData) ? dData : []);
      if (Array.isArray(rData) && rData.length > 0) {
        setRoles(rData);
      }

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

      const matchRole = !filterRole || u.role === filterRole;
      const matchStatus = !filterStatus || u.status === filterStatus;

      return matchSearch && matchRole && matchStatus;
    });
  }, [users, searchTerm, filterRole, filterStatus]);

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



  // 5. Role Modal Handlers
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
            Quản lý tập trung tài khoản nhân sự và cấu hình vai trò & quyền hạn (RBAC)
          </p>
        </div>

        {/* Quick action buttons according to active tab */}
        <div style={{ display: "flex", gap: 10 }}>
          {canManageStaff && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary"
              style={{ boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)", display: "flex", alignItems: "center", gap: 6 }}
            >
              <UserPlus size={16} /> Cấp Tài Khoản Mới
            </button>
          )}</div>
      </div>



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

          {(searchTerm || filterRole || filterStatus) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--border)", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>
                Tìm thấy <strong>{filteredUsers.length}</strong> / {users.length} tài khoản phù hợp
              </span>
              <button
                onClick={() => {
                  setSearchTerm("");
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
                  <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Vai trò hệ thống</th>
                  <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Trạng thái</th>
                  <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
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
              <div className="staff-modal-grid-2col">
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

              <div className="staff-modal-grid-2col" style={{ marginTop: 14 }}>
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

              {/* ROLE DROPDOWN */}
              <div className="form-group" style={{ marginTop: 14 }}>
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

              <div className="staff-modal-grid-2col" style={{ marginBottom: 14 }}>
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
    </div>
  );
}
