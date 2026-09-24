import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { 
  Clock, 
  Lock, 
  User, 
  LogIn, 
  Sparkles, 
  ShieldCheck, 
  UserCheck, 
  Key, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  ArrowRight
} from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotInput, setForgotInput] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Vui lòng điền đầy đủ tên đăng nhập và mật khẩu");
      return;
    }

    try {
      setLoading(true);
      await login(username, password);
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError("");
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess(null);

    if (!forgotInput.trim()) {
      setForgotError("Vui lòng nhập tên đăng nhập hoặc email!");
      return;
    }

    try {
      setForgotLoading(true);
      const res = await api.forgotPassword(forgotInput.trim());
      setForgotSuccess(res);
    } catch (err) {
      setForgotError(err.message || "Không thể khôi phục mật khẩu, vui lòng thử lại!");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleUseTempPassword = () => {
    if (forgotSuccess) {
      setUsername(forgotSuccess.username);
      setPassword(forgotSuccess.temp_password);
      setShowForgotModal(false);
      setError("");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(circle at top left, #eff6ff 0%, #f8fafc 100%)",
      padding: 20
    }}>
      <div className="glass-card" style={{
        maxWidth: 440,
        width: "100%",
        padding: "36px 32px",
        borderRadius: 20,
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.08)",
        background: "#ffffff"
      }}>
        {/* Header Branding */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            marginBottom: 14,
            boxShadow: "0 8px 16px rgba(37, 99, 235, 0.3)"
          }}>
            <Clock size={28} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
            WorkShift<span style={{ color: "#2563eb" }}>Pro</span>
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            Hệ thống Quản lý 9 Ca & Cổng Thông tin Nội bộ
          </p>
        </div>

        {error && (
          <div style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 18,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Tên tài khoản nội bộ</label>
            <div style={{ position: "relative" }}>
              <User size={18} color="#94a3b8" style={{ position: "absolute", left: 12, top: 12 }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: 38 }}
                placeholder="VD: admin hoặc nv_an"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 6 }}>
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: "relative" }}>
              <Lock size={18} color="#94a3b8" style={{ position: "absolute", left: 12, top: 12 }} />
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                style={{ paddingLeft: 38, paddingRight: 38 }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Forgot password trigger */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
            <button
              type="button"
              onClick={() => {
                setShowForgotModal(true);
                setForgotSuccess(null);
                setForgotError("");
                setForgotInput(username || "");
              }}
              style={{
                background: "none",
                border: "none",
                color: "#2563eb",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              Quên mật khẩu?
            </button>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px" }}
            disabled={loading}
          >
            <LogIn size={18} />
            {loading ? "Đang xác thực..." : "Đăng Nhập Cổng Nội Bộ"}
          </button>
        </form>

        {/* Quick Fill Test Accounts */}
        <div style={{
          marginTop: 26,
          paddingTop: 20,
          borderTop: "1px dashed var(--border)"
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--text-muted)",
            fontWeight: 600,
            marginBottom: 10
          }}>
            <Sparkles size={14} color="#f59e0b" /> Tài khoản mẫu thử nghiệm nhanh:
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => handleQuickFill("admin", "admin123")}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
            >
              <ShieldCheck size={14} color="#7c3aed" />
              Admin (Quản lý)
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("nv_an", "123456")}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
            >
              <UserCheck size={14} color="#2563eb" />
              Nhân viên (An)
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowForgotModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 460,
              background: "#ffffff",
              borderRadius: 16,
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              padding: 24
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
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
                  <Key size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>
                    Khôi Phục Mật Khẩu
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                    Tự cấp lại mật khẩu đăng nhập khi quên
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                style={{ border: "none", background: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Error banner */}
            {forgotError && (
              <div style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14
              }}>
                <AlertCircle size={16} />
                <span>{forgotError}</span>
              </div>
            )}

            {/* Success state */}
            {forgotSuccess ? (
              <div>
                <div style={{
                  padding: "14px",
                  borderRadius: 10,
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  fontSize: 13,
                  marginBottom: 16
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 4 }}>
                    <CheckCircle2 size={16} /> Đã cấp mật khẩu mới thành công!
                  </div>
                  <p style={{ margin: "4px 0", fontSize: 12, color: "#15803d" }}>
                    Hệ thống đã gửi mật khẩu đăng nhập tạm thời tới email: <strong>{forgotSuccess.email}</strong>
                  </p>
                </div>

                <div style={{
                  background: "#f8fafc",
                  border: "1.5px dashed #cbd5e1",
                  borderRadius: 10,
                  padding: "16px",
                  textAlign: "center",
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                    Mật khẩu tạm thời của bạn:
                  </div>
                  <div style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: 2,
                    fontFamily: "monospace",
                    color: "#2563eb",
                    userSelect: "all"
                  }}>
                    {forgotSuccess.temp_password}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                    (Ghi chú: Sau khi đăng nhập, vui lòng bấm <strong>🔑 Đổi mật khẩu</strong> để tạo mật khẩu riêng)
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUseTempPassword}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "11px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  <span>Tự động điền mật khẩu này & Đăng nhập</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              /* Request Form */
              <form onSubmit={handleForgotPassword}>
                <div style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  color: "#475569",
                  marginBottom: 14,
                  lineHeight: 1.5
                }}>
                  Nhập <strong>Tên đăng nhập</strong> hoặc <strong>Email</strong> của bạn. Hệ thống sẽ tạo mật khẩu tạm thời và gửi email thông báo cho bạn ngay lập tức.
                </div>

                <div className="form-group" style={{ marginBottom: 18 }}>
                  <label className="form-label">Tên đăng nhập hoặc Email đã đăng ký: *</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={16} color="#94a3b8" style={{ position: "absolute", left: 12, top: 12 }} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: 38 }}
                      placeholder="VD: nv_an hoặc an.nguyen@company.com"
                      value={forgotInput}
                      onChange={(e) => setForgotInput(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="btn btn-secondary"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn btn-primary"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Key size={15} />
                    {forgotLoading ? "Đang xử lý..." : "Cấp Lại Mật Khẩu"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
