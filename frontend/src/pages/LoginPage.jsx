import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Clock, Lock, User, LogIn, Sparkles, ShieldCheck, UserCheck } from "lucide-react";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
            Hệ thống Quản lý 6 Ca & Cổng Thông tin Nội bộ
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
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
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

          <div className="form-group">
            <label className="form-label">Mật khẩu</label>
            <div style={{ position: "relative" }}>
              <Lock size={18} color="#94a3b8" style={{ position: "absolute", left: 12, top: 12 }} />
              <input
                type="password"
                className="form-input"
                style={{ paddingLeft: 38 }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px", marginTop: 8 }}
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
    </div>
  );
}
