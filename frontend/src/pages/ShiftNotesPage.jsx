import React, { useState, useEffect } from "react";
import { SHIFTS } from "../constants/shifts";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { 
  FileText, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  PlusCircle, 
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export function ShiftNotesPage() {
  const { isAdmin } = useAuth();
  const { fetchNotifications } = useNotifications();

  const [notes, setNotes] = useState([]);
// loading
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState({ text: "", type: "success" });

  // Form states for creating note
  const [selectedShiftId, setSelectedShiftId] = useState(1);
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [adjustedTime, setAdjustedTime] = useState("08:00 - 09:00");
  const [reason, setReason] = useState("");
  const [noteType, setNoteType] = useState("adjusted_hours");
  const [submitting, setSubmitting] = useState(false);

  // Admin response modal / inline state
  const [selectedNoteForReply, setSelectedNoteForReply] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState("");
  const [adminActionStatus, setAdminActionStatus] = useState("approved");

  const fetchNotes = async () => {
    try {
      
      const data = await api.getShiftNotes();
      setNotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const showToastMsg = (text, type = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: "", type: "success" }), 4000);
  };

  const handleShiftChange = (e) => {
    const shiftId = parseInt(e.target.value);
    setSelectedShiftId(shiftId);
    const s = SHIFTS.find((item) => item.id === shiftId);
    if (s) {
      // Default adjusted example: reduce 1 hour
      setAdjustedTime(`${s.startTime} - ${s.startTime.split(":")[0]}:50 hoặc thỏa thuận`);
    }
  };

  const handleSubmitNote = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToastMsg("Vui lòng nhập lý do cụ thể để quản lý nắm thông tin", "danger");
      return;
    }

    const currentToday = new Date().toISOString().split("T")[0];
    if (workDate < currentToday) {
      showToastMsg("Không được chọn ngày trong quá khứ! Chỉ được chọn ngày hôm nay hoặc tương lai.", "danger");
      return;
    }

    const currentShift = SHIFTS.find((s) => s.id === selectedShiftId);
    const originalTime = currentShift ? currentShift.label : "08:00 - 10:00";

    try {
      setSubmitting(true);
      await api.createShiftNote({
        shift_id: selectedShiftId,
        work_date: workDate,
        original_time: originalTime,
        adjusted_time: adjustedTime,
        reason: reason.trim(),
        note_type: noteType,
      });

      showToastMsg("Đã gửi ghi chú báo bận đột xuất cho Quản lý!");
      setShowModal(false);
      setReason("");
      fetchNotes();
      fetchNotifications();
    } catch (err) {
      showToastMsg(err.message, "danger");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminUpdateStatus = async () => {
    if (!selectedNoteForReply) return;
    try {
      await api.updateShiftNoteStatus(
        selectedNoteForReply.id,
        adminActionStatus,
        adminReplyText.trim()
      );
      showToastMsg("Đã cập nhật trạng thái và gửi thông báo lại cho nhân viên!");
      setSelectedNoteForReply(null);
      setAdminReplyText("");
      fetchNotes();
      fetchNotifications();
    } catch (err) {
      showToastMsg(err.message, "danger");
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const getStatusBadge = (status, workDate) => {
    if (status === "pending" && workDate && workDate < todayStr) {
      return (
        <span className="badge badge-red" style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}>
          <Clock size={12} /> Quá hạn duyệt (Đã qua ngày)
        </span>
      );
    }
    switch (status) {
      case "approved":
        return <span className="badge badge-green"><CheckCircle size={12} /> Quản lý đã duyệt</span>;
      case "rejected":
        return <span className="badge badge-red"><XCircle size={12} /> Từ chối</span>;
      case "acknowledged":
        return <span className="badge badge-blue"><CheckCircle size={12} /> Đã ghi nhận</span>;
      default:
        return <span className="badge badge-amber"><Clock size={12} /> Chờ quản lý duyệt</span>;
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
            Sổ Ghi Chú Ca Làm & Báo Bận Đột Xuất
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Báo cáo sự cố hoặc điều chỉnh giờ trực (VD: Ca 8h-10h chỉ làm được 8h-9h vì việc gấp)
          </p>
        </div>

        <button
          onClick={() => {
            const nowStr = new Date().toISOString().split("T")[0];
            setWorkDate((prev) => (prev < nowStr ? nowStr : prev));
            setShowModal(true);
          }}
          className="btn btn-primary"
          style={{ boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)" }}
        >
          <PlusCircle size={16} /> Tạo Ghi Chú Báo Bận Mới
        </button>
      </div>

      {/* Info helper banner */}
      <div style={{
        background: "linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)",
        border: "1px solid #bfdbfe",
        borderRadius: 14,
        padding: "16px 20px",
        marginBottom: 28,
        display: "flex",
        alignItems: "flex-start",
        gap: 14
      }}>
        <AlertTriangle size={22} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 13, color: "#1e40af", lineHeight: 1.5 }}>
          <strong>Lưu ý nghiệp vụ:</strong> Nếu bạn đã được phân công ca trực nhưng phát sinh việc học, thi đột xuất ở trường hoặc việc khẩn cấp khiến bạn <em>không thể trực trọn vẹn toàn ca</em> (ví dụ: chỉ trực được 1 tiếng, đến muộn 30 phút hoặc cần về sớm), hãy điền ngay vào sổ này để Quản lý kịp thời bố trí người hỗ trợ tiếp ứng.
        </div>
      </div>

      {/* Notes List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {notes.length === 0 ? (
          <div className="glass-card" style={{ padding: "50px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <FileText size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600 }}>Chưa có ghi chú báo bận nào</p>
            <p style={{ fontSize: 13 }}>Mọi ca trực hiện đang hoạt động bình thường theo lịch chuẩn.</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="glass-card"
              style={{
                padding: "20px 24px",
                borderLeft: note.status === "approved" ? "5px solid #10b981" : (note.status === "rejected" ? "5px solid #ef4444" : "5px solid #f59e0b")
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 12
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: "#0f172a" }}>
                      {note.author_name}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      ({note.author_email})
                    </span>
                    {getStatusBadge(note.status, note.work_date)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, fontSize: 13, color: "var(--text-muted)" }}>
                    <span>📅 Ngày ca trực: <strong>{note.work_date}</strong></span>
                    <span>🏷️ <strong>{note.shift_name}</strong></span>
                  </div>
                </div>

                {/* Time comparison visual */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#f8fafc",
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)"
                }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>Ca gốc</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>{note.original_time}</div>
                  </div>
                  <ArrowRight size={16} color="#94a3b8" />
                  <div>
                    <div style={{ fontSize: 10, color: "#2563eb", textTransform: "uppercase", fontWeight: 700 }}>Khả năng trực thực tế</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{note.adjusted_time}</div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div style={{
                background: "#ffffff",
                border: "1px solid #f1f5f9",
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 12
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>
                  Lý do báo bận / điều chỉnh:
                </div>
                <div style={{ fontSize: 14, color: "#1e293b", lineHeight: 1.5 }}>
                  "{note.reason}"
                </div>
              </div>

              {/* Admin Response */}
              {note.admin_response && (
                <div style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13,
                  color: "#166534"
                }}>
                  <strong>Phản hồi từ Quản lý:</strong> {note.admin_response}
                </div>
              )}

              {/* Admin Action Button */}
              {isAdmin && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                  {note.work_date && note.work_date < todayStr && note.status === "pending" ? (
                    <button
                      onClick={() => {
                        setSelectedNoteForReply(note);
                        setAdminActionStatus("rejected");
                        setAdminReplyText(
                          note.admin_response || "Từ chối do quá hạn duyệt (đã qua ngày ca làm việc)"
                        );
                      }}
                      className="btn btn-danger btn-sm"
                      style={{ display: "flex", alignItems: "center", gap: 6, background: "#dc2626", borderColor: "#b91c1c", color: "#ffffff" }}
                    >
                      <XCircle size={14} /> Chuyển Sang Từ Chối (Quá Hạn)
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const isPast = note.work_date && note.work_date < todayStr;
                        setSelectedNoteForReply(note);
                        setAdminActionStatus(isPast ? "rejected" : "approved");
                        setAdminReplyText(
                          note.admin_response || (isPast ? "Từ chối do quá hạn duyệt" : "")
                        );
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      <ShieldCheck size={14} color="#2563eb" /> Phản hồi ghi chú này
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Create Shift Note */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" style={{ background: "#ffffff", color: "#0f172a", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()} style={{ padding: "26px" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Báo Bận Đột Xuất / Điều Chỉnh Giờ Ca
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
              Gửi thông tin cho quản lý để điều phối người hỗ trợ hoặc duyệt giờ trực thực tế.
            </p>

            <form onSubmit={handleSubmitNote}>
              <div className="form-group">
                <label className="form-label">Chọn ca làm việc liên quan:</label>
                <select
                  className="form-select"
                  value={selectedShiftId}
                  onChange={handleShiftChange}
                >
                  {SHIFTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.label})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ngày làm việc:</label>
                <input
                  type="date"
                  className="form-input"
                  min={todayStr}
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  required
                />
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                  ℹ️ Hệ thống chỉ cho phép chọn ngày hôm nay hoặc các ngày trong tương lai.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Khung giờ thực tế bạn có thể trực:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={adjustedTime}
                  onChange={(e) => setAdjustedTime(e.target.value)}
                  placeholder="VD: 08:00 - 09:00 hoặc Xin về sớm 1 tiếng"
                  required
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                  Ghi rõ khoảng thời gian bạn có mặt được (VD: ban đầu ca 8h-10h, chỉ làm được 8h-9h).
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Loại điều chỉnh:</label>
                <select
                  className="form-select"
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                >
                  <option value="adjusted_hours">Rút ngắn giờ trực / Xin về sớm</option>
                  <option value="late">Xin đến muộn</option>
                  <option value="emergency">Sự cố khẩn cấp xin nghỉ ca</option>
                  <option value="swap">Đã nhờ đồng nghiệp trực thay</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Lý do chi tiết gửi Quản lý:</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Trùng lịch kiểm tra giữa kỳ lúc 9h15 tại trường nên em chỉ trực được 8h-9h..."
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? "Đang gửi..." : "Gửi Báo Cáo Cho Quản Lý"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin Approve/Reply */}
      {selectedNoteForReply && (() => {
        const isPast = Boolean(selectedNoteForReply.work_date && selectedNoteForReply.work_date < todayStr);
        return (
          <div className="modal-overlay" onClick={() => setSelectedNoteForReply(null)}>
            <div className="modal-content" style={{ background: "#ffffff", color: "#0f172a", borderRadius: 16, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", padding: "26px" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: isPast ? "#b91c1c" : "#0f172a" }}>
                {isPast ? "Từ Chối Ghi Chú Ca Làm" : "Duyệt Ghi Chú Ca Làm"} ({selectedNoteForReply.author_name})
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                Ca: <strong>{selectedNoteForReply.shift_name}</strong> - Ngày: <strong>{selectedNoteForReply.work_date}</strong>
              </p>

              {isPast ? (
                <div style={{ padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, color: "#991b1b", fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <XCircle size={18} color="#dc2626" />
                  <span>Quyết định: TỪ CHỐI (Ca làm việc đã qua ngày)</span>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Quyết định của quản lý:</label>
                  <select
                    className="form-select"
                    value={adminActionStatus}
                    onChange={(e) => setAdminActionStatus(e.target.value)}
                  >
                    <option value="approved">✅ Phê duyệt điều chỉnh giờ làm</option>
                    <option value="rejected">❌ Từ chối yêu cầu</option>
                    <option value="acknowledged">ℹ️ Đã ghi nhận thông tin</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  {isPast ? "Lý do từ chối gửi nhân viên:" : "Lời dặn / Phản hồi gửi cho nhân viên:"}
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={adminReplyText}
                  onChange={(e) => setAdminReplyText(e.target.value)}
                  placeholder={isPast ? "Lý do từ chối..." : "VD: Quản lý đã duyệt..."}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setSelectedNoteForReply(null)}
                  className="btn btn-secondary"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAdminUpdateStatus}
                  className={isPast ? "btn btn-danger" : "btn btn-primary"}
                  style={isPast ? { background: "#dc2626", borderColor: "#b91c1c", color: "#ffffff", fontWeight: 700 } : {}}
                >
                  {isPast ? "Xác Nhận Từ Chối" : "Xác Nhận & Gửi Thông Báo"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
