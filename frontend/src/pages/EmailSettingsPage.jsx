import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Server, 
  ShieldCheck, 
  HelpCircle, 
  Sparkles
} from "lucide-react";

export function EmailSettingsPage() {
  const [host, setHost] = useState("smtp.gmail.com");
  const [port, setPort] = useState(587);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [fromName, setFromName] = useState("Hệ Thống Phân Ca WorkShiftPro");
  const [hasPassword, setHasPassword] = useState(false);

  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "success" });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getSmtpSettings();
        if (data.host) setHost(data.host);
        if (data.port) setPort(data.port);
        if (data.user) setUser(data.user);
        if (data.from_name) setFromName(data.from_name);
        setHasPassword(data.has_password);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();
  }, []);

  const showToast = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "success" }), 5000);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.updateSmtpSettings({
        host,
        port: parseInt(port),
        user: user.trim(),
        password: password.trim(),
        from_name: fromName.trim(),
      });
      showToast("Đã lưu cấu hình SMTP thành công!");
      setHasPassword(Boolean(password.trim()) || hasPassword);
      setPassword(""); // Clear input
    } catch (err) {
      showToast(err.message, "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) {
      showToast("Vui lòng nhập địa chỉ email người nhận để gửi thử!", "danger");
      return;
    }

    try {
      setTesting(true);
      const res = await api.testSendEmail(testEmail.trim());
      showToast(res.message || "Đã gửi email thật thành công! Bạn hãy mở hộp thư Inbox để kiểm tra.", "success");
    } catch (err) {
      showToast(`Gửi thất bại: ${err.message}`, "danger");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
      {/* Toast Alert */}
      {msg.text && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: msg.type === "danger" ? "#ef4444" : "#10b981",
          color: "#ffffff",
          padding: "14px 22px",
          borderRadius: 12,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontWeight: 600,
          fontSize: 14,
          animation: "fadeIn 0.2s ease-out"
        }}>
          {msg.type === "danger" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {msg.text}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
          Cấu Hình Gửi Email Thật (SMTP Settings)
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Cài đặt tài khoản gửi email tự động (Gmail, Outlook, v.v.) để khi Quản lý xuất bản lịch, nhân viên sẽ nhận email thật vào hộp thư cá nhân
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
        {/* Left Column: Form Settings */}
        <div className="glass-card" style={{ padding: "26px", borderRadius: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
            <Server size={20} color="#2563eb" />
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Thông Tin Máy Chủ SMTP</h2>
          </div>

          <form onSubmit={handleSaveSettings}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
              <div className="form-group">
                <label className="form-label">SMTP Host (Máy chủ gửi thư):</label>
                <input
                  type="text"
                  className="form-input"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="VD: smtp.gmail.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Port:</label>
                <input
                  type="number"
                  className="form-input"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="587 hoặc 465"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Địa chỉ Email người gửi (Gmail / Công ty):</label>
              <input
                type="email"
                className="form-input"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="VD: yourcompany.shifts@gmail.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Mật khẩu ứng dụng (App Password 16 ký tự của Google):
              </label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasPassword ? "•••••••••••••••• (Đã lưu mật khẩu)" : "VD: abcd efgh ijkl mnop"}
              />
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                {hasPassword ? "✅ Đã có mật khẩu được lưu. Bạn chỉ cần nhập nếu muốn thay đổi." : "⚠️ Chưa cấu hình mật khẩu ứng dụng."}
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Tên hiển thị người gửi (Sender Name):</label>
              <input
                type="text"
                className="form-input"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Hệ Thống Phân Ca WorkShiftPro"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", marginTop: 8 }}
              disabled={saving}
            >
              <ShieldCheck size={16} /> {saving ? "Đang lưu..." : "Lưu Cấu Hình SMTP"}
            </button>
          </form>

          {/* Live Test Send Box */}
          <div style={{
            marginTop: 26,
            paddingTop: 20,
            borderTop: "1px dashed var(--border)"
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={16} color="#f59e0b" /> Kiểm Tra Gửi Email Thật Ngay Lập Tức:
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Nhập địa chỉ email cá nhân của bạn để hệ thống kết nối máy chủ gửi thử 1 email thật:
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="email"
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Nhập email của bạn (VD: myemail@gmail.com)"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
              />
              <button
                type="button"
                onClick={handleTestSend}
                className="btn btn-secondary"
                disabled={testing}
                style={{ flexShrink: 0 }}
              >
                <Send size={15} /> {testing ? "Đang gửi..." : "Gửi Thử Email"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Instructions for Gmail App Password */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="glass-card" style={{ padding: "22px", borderRadius: 16, background: "#f8fafc" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <HelpCircle size={20} color="#2563eb" />
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                Cách Lấy Mật Khẩu Ứng Dụng Gmail (30 Giây)
              </h3>
            </div>

            <p style={{ fontSize: 12, color: "#475569", lineHeight: 1.6, marginBottom: 12 }}>
              Google không cho phép đăng nhập trực tiếp bằng mật khẩu tài khoản chính để bảo mật. Bạn cần tạo một <strong>Mật khẩu ứng dụng (App Password)</strong> gồm 16 ký tự:
            </p>

            <ol style={{ fontSize: 12, color: "#334155", paddingLeft: 18, lineHeight: 1.8 }}>
              <li>
                Mở Google Account: <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 600 }}>myaccount.google.com/security</a>
              </li>
              <li>
                Đảm bảo đã bật <strong>Xác minh 2 bước (2-Step Verification)</strong>.
              </li>
              <li>
                Tại thanh tìm kiếm tài khoản Google, gõ <strong>"Mật khẩu ứng dụng"</strong> (hoặc truy cập <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 600 }}>myaccount.google.com/apppasswords</a>).
              </li>
              <li>
                Đặt tên ứng dụng: <em>WorkShiftPro</em> ➔ Bấm <strong>Tạo</strong>.
              </li>
              <li>
                Copy chuỗi 16 ký tự màu vàng (ví dụ: <code>abcd efgh ijkl mnop</code>) và dán vào ô mật khẩu ở form bên cạnh.
              </li>
            </ol>
          </div>

          <div style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: 14,
            padding: "16px",
            fontSize: 12,
            color: "#065f46",
            lineHeight: 1.6
          }}>
            <strong>⚡ Tự động gửi khi xuất bản lịch:</strong><br/>
            Sau khi lưu cấu hình, mỗi khi bạn vào tab <strong>"Lịch Làm Việc (6 Ca)"</strong> và bấm <strong>"Xuất Bản Lịch & Bắn Email"</strong>, hệ thống sẽ tự động quét danh sách các ca của từng nhân viên và gửi email HTML thật đến đúng địa chỉ hộp thư của nhân viên đó!
          </div>
        </div>
      </div>
    </div>
  );
}
