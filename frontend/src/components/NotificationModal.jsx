import React from "react";
import { useNotifications } from "../context/NotificationContext";
import { Bell, CheckCheck, X, Calendar, FileText, MessageSquare, Info } from "lucide-react";

export function NotificationModal() {
  const { notifications, isOpen, setIsOpen, markAsRead, markAllAsRead } = useNotifications();

  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case "schedule_published":
        return <Calendar size={18} color="#2563eb" />;
      case "shift_note_submitted":
      case "shift_note_approved":
        return <FileText size={18} color="#d97706" />;
      case "feedback_reply":
        return <MessageSquare size={18} color="#7c3aed" />;
      default:
        return <Info size={18} color="#0891b2" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={() => setIsOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "#eff6ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <Bell size={18} color="#2563eb" />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Thông báo</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
                Cập nhật lịch làm việc, báo ca và phản hồi
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={markAllAsRead}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 12, padding: "5px 10px" }}
              title="Đánh dấu tất cả đã đọc"
            >
              <CheckCheck size={14} /> Đọc hết
            </button>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 4,
                color: "#64748b"
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* List of Notifications */}
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "8px 0" }}>
          {notifications.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
              <Bell size={36} color="#cbd5e1" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 14, fontWeight: 500 }}>Chưa có thông báo nào</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.is_read && markAsRead(item.id)}
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  background: item.is_read ? "#ffffff" : "#f8fafc",
                  cursor: "pointer",
                  transition: "background 0.15s"
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2
                }}>
                  {getIcon(item.type)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <h4 style={{
                      fontSize: 13,
                      fontWeight: item.is_read ? 600 : 700,
                      color: item.is_read ? "#334155" : "#0f172a",
                      margin: 0
                    }}>
                      {item.title}
                    </h4>
                    {!item.is_read && (
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#3b82f6",
                        flexShrink: 0,
                        marginLeft: 8
                      }} />
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "#475569", margin: "4px 0 6px 0", lineHeight: 1.4 }}>
                    {item.message}
                  </p>
                  <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    {item.created_at ? new Date(item.created_at).toLocaleString("vi-VN") : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
