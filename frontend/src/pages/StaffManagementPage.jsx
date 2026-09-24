import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { 
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
  AlertCircle
} from "lucide-react";

export function StaffManagementPage() {
  const [users, setUsers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState({ text: "", type: "success" });

  // Add User Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("staff");
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
  const [editRole, setEditRole] = useState("staff");
  const [editStatus, setEditStatus] = useState("active");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToastMsg = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "success" }), 3500);
  };

  // 1. Create User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!username || !password || !fullName || !email) {
      showToastMsg("Vui lòng điền đầy đủ thông tin bắt buộc", "danger");
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
        department,
      });

      showToastMsg("Cấp tài khoản mới thành công!");
      setShowAddModal(false);
      setUsername("");
      setPassword("");
      setFullName("");
      setEmail("");
      setPhone("");
      fetchUsers();
    } catch (err) {
      showToastMsg(err.message || "Tạo tài khoản thất bại!", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Open Reset Password Modal
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

  // 3. Open Edit User Modal
  const handleOpenEdit = (u) => {
    setEditUser(u);
    setEditFullName(u.full_name || "");
    setEditEmail(u.email || "");
    setEditPhone(u.phone || "");
    setEditDepartment(u.department || "Tổ Trực Vận Hành");
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
      fetchUsers();
    } catch (err) {
      showToastMsg(err.message || "Cập nhật thất bại!", "danger");
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
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
            boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {toast.type === "danger" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-main)", marginBottom: 4 }}>
            Quản Lý Nhân Sự & Tài Khoản
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Danh sách toàn bộ {users.length} tài khoản nhân sự, phân quyền và cấp đổi mật khẩu
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary"
          style={{ boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)", display: "flex", alignItems: "center", gap: 6 }}
        >
          <UserPlus size={16} /> Cấp Tài Khoản Mới
        </button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Nhân viên</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Tên đăng nhập</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Email nhận lịch</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Số điện thoại</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Phòng ban</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Vai trò</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Trạng thái</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === "admin";
                const isLocked = u.status === "inactive" || u.status === "locked";
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: isAdmin ? "#ede9fe" : "#dbeafe",
                          color: isAdmin ? "#7c3aed" : "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700
                        }}>
                          {u.full_name?.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 700, color: "#0f172a" }}>{u.full_name}</span>
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
                      {u.phone || "---"}
                    </td>
                    <td style={{ padding: "14px 20px", color: "#475569" }}>
                      {u.department}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      {isAdmin ? (
                        <span className="badge badge-purple">
                          <ShieldCheck size={12} /> Quản lý
                        </span>
                      ) : (
                        <span className="badge badge-blue">
                          <UserCheck size={12} /> Nhân viên
                        </span>
                      )}
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
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Add New User */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px", maxWidth: 500 }}>
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                <div className="form-group">
                  <label className="form-label">Phòng ban / Tổ trực:</label>
                  <select
                    className="form-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="Tổ Trực Vận Hành">Tổ Trực Vận Hành</option>
                    <option value="Tổ Trực Kỹ Thuật">Tổ Trực Kỹ Thuật</option>
                    <option value="Tổ Dịch Vụ Sinh Viên">Tổ Dịch Vụ Sinh Viên</option>
                    <option value="Hỗ Trợ Kỹ Thuật">Hỗ Trợ Kỹ Thuật</option>
                    <option value="Kỹ Thuật Hạ Tầng">Kỹ Thuật Hạ Tầng</option>
                    <option value="Vận Hành Mạng">Vận Hành Mạng</option>
                    <option value="Chăm Sóc Khách Hàng">Chăm Sóc Khách Hàng</option>
                    <option value="Giám Sát Ca Đêm">Giám Sát Ca Đêm</option>
                    <option value="Ban Quản Trị">Ban Quản Trị</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vai trò hệ thống:</label>
                  <select
                    className="form-input"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="staff">Nhân viên (Staff)</option>
                    <option value="admin">Quản lý (Admin)</option>
                  </select>
                </div>
              </div>

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

      {/* Modal 2: Admin Reset Password for Employee */}
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
                      color: "#94a3b8",
                      cursor: "pointer",
                    }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Nhập lại mật khẩu mới: *</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Xác nhận lại mật khẩu mới"
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
                  style={{ background: "#d97706", borderColor: "#d97706", display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Key size={15} />
                  {resetSubmitting ? "Đang lưu..." : "Xác Nhận Đặt Lại"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Admin Edit User Information */}
      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px", maxWidth: 500 }}>
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
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Chỉnh Sửa Nhân Sự</h3>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                    Tài khoản: <strong>{editUser.username}</strong>
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
                  <option value="Tổ Trực Vận Hành">Tổ Trực Vận Hành</option>
                  <option value="Tổ Trực Kỹ Thuật">Tổ Trực Kỹ Thuật</option>
                  <option value="Tổ Dịch Vụ Sinh Viên">Tổ Dịch Vụ Sinh Viên</option>
                  <option value="Hỗ Trợ Kỹ Thuật">Hỗ Trợ Kỹ Thuật</option>
                  <option value="Kỹ Thuật Hạ Tầng">Kỹ Thuật Hạ Tầng</option>
                  <option value="Vận Hành Mạng">Vận Hành Mạng</option>
                  <option value="Chăm Sóc Khách Hàng">Chăm Sóc Khách Hàng</option>
                  <option value="Giám Sát Ca Đêm">Giám Sát Ca Đêm</option>
                  <option value="Ban Quản Trị">Ban Quản Trị</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">Vai trò:</label>
                  <select
                    className="form-input"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                  >
                    <option value="staff">Nhân viên (Staff)</option>
                    <option value="admin">Quản lý (Admin)</option>
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
    </div>
  );
}
