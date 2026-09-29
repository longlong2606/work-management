import React from "react";
import { X, Users, Clock, AlertTriangle, CheckCircle2, Phone, Mail } from "lucide-react";

export function RosterDetailModal({ shift, dateStr, members, events, onClose }) {
  if (!shift) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          background: "#ffffff",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            background: "linear-gradient(135deg, #1e40af, #3b82f6)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
                {shift.name}
              </h3>
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                {shift.start_time || shift.startTime} - {shift.end_time || shift.endTime}
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#dbeafe", marginTop: 4 }}>
              Chi tiết nhân sự tham gia & sự kiện ca trực ngày {dateStr}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "none",
              color: "#ffffff",
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, maxHeight: "65vh", overflowY: "auto" }}>
          {/* Danh sách thành viên */}
          <div style={{ marginBottom: 24 }}>
            <h4
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#1e293b",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 8
              }}
            >
              <Users size={18} color="#2563eb" />
              DANH SÁCH THÀNH VIÊN TRỰC ({members.length} NGƯỜI)
            </h4>

            {members.length === 0 ? (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  background: "#f8fafc",
                  borderRadius: 12,
                  color: "#64748b",
                  fontSize: 14
                }}
              >
                Chưa có nhân viên nào được phân công cho ca này.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {members.map((m, idx) => {
                  const isAbsent = m.attendance_status === "absent";
                  return (
                    <div
                      key={m.id || idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderRadius: 12,
                        background: isAbsent ? "#fef2f2" : "#f0fdf4",
                        border: isAbsent ? "1px solid #fecaca" : "1px solid #bbf7d0"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: isAbsent ? "#ef4444" : "#10b981",
                            color: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 15
                          }}
                        >
                          {(m.full_name || "N")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
                            {m.full_name || m.username}
                          </div>
                          {m.phone && (
                            <div style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                              <Phone size={12} /> {m.phone}
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        {isAbsent ? (
                          <div style={{ textAlign: "right" }}>
                            <span
                              style={{
                                background: "#fee2e2",
                                color: "#b91c1c",
                                padding: "4px 10px",
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 700
                              }}
                            >
                              Vắng mặt
                            </span>
                            {m.absence_reason && (
                              <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4, fontWeight: 600 }}>
                                Lý do: {m.absence_reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{
                              background: "#dcfce7",
                              color: "#15803d",
                              padding: "4px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            <CheckCircle2 size={14} /> Có mặt
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sự kiện của ca */}
          {events && events.length > 0 && (
            <div>
              <h4
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#1e293b",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <Clock size={18} color="#d97706" />
                SỰ KIỆN TRONG CA ({events.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {events.map((ev, i) => (
                  <div
                    key={ev.id || i}
                    style={{
                      padding: "12px 16px",
                      borderRadius: 10,
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderLeft: "4px solid #f59e0b"
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#92400e" }}>
                      {ev.title}
                    </div>
                    {ev.description && (
                      <div style={{ fontSize: 13, color: "#78350f", marginTop: 4 }}>
                        {ev.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "16px 24px",
            background: "#f8fafc",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end"
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer"
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
