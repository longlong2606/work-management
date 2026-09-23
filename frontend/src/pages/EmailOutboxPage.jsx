import React, { useState, useEffect } from "react";
import { api } from "../services/api";
import { Mail, CheckCircle2, Clock, Eye, X, Send, User } from "lucide-react";

export function EmailOutboxPage() {
  const [emails, setEmails] = useState([]);
// loading
  const [selectedEmail, setSelectedEmail] = useState(null);

  const fetchEmails = async () => {
    try {
      
      const data = await api.getEmailOutbox();
      setEmails(data);
    } catch (err) {
      console.error(err);
    } finally {
      
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 20px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
          Nhật Ký Email Thông Báo Lịch Làm (Outbox)
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          Theo dõi các email thông báo lịch làm việc tự động gửi đến hộp thư của nhân viên
        </p>
      </div>

      <div className="glass-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Người nhận</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Địa chỉ Email</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Tiêu đề thư</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Thời gian gửi</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Trạng thái</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, color: "#475569" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {emails.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                    <Mail size={36} color="#cbd5e1" style={{ marginBottom: 10 }} />
                    <p>Chưa có email nào được gửi. Khi bạn bấm "Xuất bản lịch làm việc", hệ thống sẽ gửi email tự động tại đây.</p>
                  </td>
                </tr>
              ) : (
                emails.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "14px 20px", fontWeight: 700, color: "#0f172a" }}>
                      {m.recipient_name}
                    </td>
                    <td style={{ padding: "14px 20px", color: "#2563eb" }}>
                      {m.recipient_email}
                    </td>
                    <td style={{ padding: "14px 20px", color: "#334155", fontWeight: 500 }}>
                      {m.subject}
                    </td>
                    <td style={{ padding: "14px 20px", color: "var(--text-muted)" }}>
                      {new Date(m.sent_at).toLocaleString("vi-VN")}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      {m.status === "sent" ? (
                        <span className="badge badge-green">
                          <CheckCircle2 size={12} /> Đã gửi qua SMTP
                        </span>
                      ) : (
                        <span className="badge badge-blue">
                          <Send size={12} /> Đã tạo & Lưu Outbox
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <button
                        onClick={() => setSelectedEmail(m)}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: 12, padding: "5px 10px" }}
                      >
                        <Eye size={13} /> Xem trước
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Email Preview */}
      {selectedEmail && (
        <div className="modal-overlay" onClick={() => setSelectedEmail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Xem Trước Email Đã Gửi</h3>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                  Gửi tới: <strong>{selectedEmail.recipient_name}</strong> ({selectedEmail.recipient_email})
                </p>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "20px", background: "#f8fafc" }}>
              <div style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "14px",
                marginBottom: 14,
                fontSize: 13
              }}>
                <div><strong>Tiêu đề:</strong> {selectedEmail.subject}</div>
                <div style={{ marginTop: 4, color: "var(--text-muted)" }}>
                  <strong>Thời gian:</strong> {new Date(selectedEmail.sent_at).toLocaleString("vi-VN")}
                </div>
              </div>

              {/* Render HTML content safely inside an iframe */}
              <div style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden"
              }}>
                <iframe
                  title="Email Preview"
                  srcDoc={selectedEmail.html_body}
                  style={{ width: "100%", height: 380, border: "none" }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
