import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { 
  UserPlus, 
  ShieldCheck, 
  UserCheck, 
  Mail, 
} from "lucide-react";

export function StaffManagementPage() {
  const [users, setUsers] = useState([]);
// loading
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState({ text: "", type: "success" });

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("staff");
  const [department, setDepartment] = useState("Tổ Trực Vận Hành");
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToastMsg = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "success" }), 3500);
  };

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
        department: department.trim(),
      });

      showToastMsg(`Đã cấp tài khoản thành công cho nhân viên ${fullName}!`);
      setShowModal(false);
      setUsername("");
      setPassword("");
      setFullName("");
      setEmail("");
      setPhone("");
      fetchUsers();
    } catch (err) {
      showToastMsg(err.message, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 20px" }}>
      {toast.text && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: toast.type === "danger" ? "#ef4444" : "#10b981",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: 12,
          fontWeight: 600,
          fontSize: 14,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)"
        }}>
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
        marginBottom: 24
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
            Quản Lý Nhân Sự & Cấp Tài Khoản Nội Bộ
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Quản lý danh sách nhân viên, cấp tài khoản đăng nhập và email nhận lịch ca
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
          style={{ boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)" }}
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
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdmin = u.role === "admin";
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
                      <span className="badge badge-green">Hoạt động</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add User */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Cấp Tài Khoản Nội Bộ Cho Nhân Viên
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
              Thông tin đăng nhập sẽ dùng để truy cập vào hệ thống chọn ca và nhận email lịch làm.
            </p>

            <form onSubmit={handleCreateUser}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Tên đăng nhập nội bộ:</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: nv_nghia"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mật khẩu khởi tạo:</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Tối thiểu 6 ký tự"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Họ và tên nhân viên:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: Lê Văn Nghĩa"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Email (nhận thông báo lịch):</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="nghia.le@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Số điện thoại:</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="0988xxxxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Tổ / Bộ phận công tác:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vai trò hệ thống:</label>
                  <select
                    className="form-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="staff">Nhân viên (Staff)</option>
                    <option value="admin">Quản lý (Admin)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  <UserPlus size={16} /> {submitting ? "Đang tạo..." : "Xác Nhận Tạo Tài Khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
