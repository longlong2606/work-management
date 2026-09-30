import React, { useState, useEffect } from "react";
import { CATEGORIES } from "../constants/shifts";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import { 
  MessageSquare, 
  Heart, 
  Send, 
  ShieldCheck, 
  EyeOff, 
  CheckCircle2, 
  Clock, 
  PlusCircle, 
  Filter,
} from "lucide-react";

export function FeedbackPage() {
  const { isAdmin } = useAuth();
  const { fetchNotifications } = useNotifications();

  const [feedbacks, setFeedbacks] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
// loading
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState("");

  // Create form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("facilities");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Admin reply state
  const [replyingFeedback, setReplyingFeedback] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState("resolved");

  const fetchFeedbacks = async () => {
    try {
      
      const data = await api.getFeedbacks();
      setFeedbacks(data);
    } catch (err) {
      console.error(err);
    } finally {
      
    }
  };

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const handleCreateFeedback = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      setSubmitting(true);
      await api.createFeedback({
        title: title.trim(),
        content: content.trim(),
        category,
        is_anonymous: isAnonymous,
      });

      showToastMsg("Đã đăng góp ý thành công lên bảng tin toàn công ty!");
      setShowModal(false);
      setTitle("");
      setContent("");
      setIsAnonymous(false);
      fetchFeedbacks();
      fetchNotifications();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async (feedbackId) => {
    try {
      const res = await api.toggleLikeFeedback(feedbackId);
      setFeedbacks((prev) =>
        prev.map((f) => {
          if (f.id === feedbackId) {
            return {
              ...f,
              has_liked: res.liked ? 1 : 0,
              likes_count: res.liked ? f.likes_count + 1 : Math.max(0, f.likes_count - 1),
            };
          }
          return f;
        })
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminReply = async () => {
    if (!replyingFeedback || !replyText.trim()) return;
    try {
      await api.replyFeedback(replyingFeedback.id, replyText.trim(), replyStatus);
      showToastMsg("Đã lưu phản hồi cho ý kiến đóng góp!");
      setReplyingFeedback(null);
      setReplyText("");
      fetchFeedbacks();
      fetchNotifications();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredFeedbacks = selectedCategory === "all"
    ? feedbacks
    : feedbacks.filter((f) => f.category === selectedCategory);

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 20px" }}>
      {toast && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 9999,
          background: "#10b981",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: 12,
          fontWeight: 600,
          fontSize: 14,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)"
        }}>
          {toast}
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
            Hòm Thư & Bảng Góp Ý Toàn Công Ty
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Mọi thành viên công ty đều có thể chia sẻ ý kiến, đề xuất cải tiến hoặc gửi ẩn danh
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
          style={{ boxShadow: "0 4px 14px rgba(37, 99, 235, 0.35)" }}
        >
          <PlusCircle size={16} /> Gửi Ý Kiến Đóng Góp Mới
        </button>
      </div>

      {/* Category filter pills */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 24
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginRight: 4 }}>
          <Filter size={14} style={{ display: "inline", verticalAlign: "-2px" }} /> Lọc:
        </span>
        <button
          onClick={() => setSelectedCategory("all")}
          className={`btn btn-sm ${selectedCategory === "all" ? "btn-primary" : "btn-secondary"}`}
        >
          Tất cả ({feedbacks.length})
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => {
          const count = feedbacks.filter((f) => f.category === key).length;
          const isSelected = selectedCategory === key;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Feedbacks Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20 }}>
        {filteredFeedbacks.length === 0 ? (
          <div className="glass-card" style={{ gridColumn: "1 / -1", padding: "50px 20px", textAlign: "center", color: "var(--text-muted)" }}>
            <MessageSquare size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600 }}>Chưa có ý kiến đóng góp nào trong mục này</p>
            <p style={{ fontSize: 13 }}>Hãy là người đầu tiên gửi ý kiến xây dựng công ty tốt hơn!</p>
          </div>
        ) : (
          filteredFeedbacks.map((fb) => {
            const catInfo = CATEGORIES[fb.category] || { label: "Khác", color: "#64748b" };
            return (
              <div
                key={fb.id}
                className="glass-card"
                style={{
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 16,
                  background: "#ffffff"
                }}
              >
                {/* Card Top */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <span
                    className="badge"
                    style={{
                      background: `${catInfo.color}15`,
                      color: catInfo.color,
                      fontSize: 11
                    }}
                  >
                    {catInfo.label}
                  </span>

                  {fb.status === "resolved" ? (
                    <span className="badge badge-green" style={{ fontSize: 11 }}>
                      <CheckCircle2 size={11} /> Đã phản hồi
                    </span>
                  ) : fb.status === "in_progress" ? (
                    <span className="badge badge-blue" style={{ fontSize: 11 }}>
                      <Clock size={11} /> Đang xử lý
                    </span>
                  ) : (
                    <span className="badge badge-amber" style={{ fontSize: 11 }}>
                      Chờ xem xét
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8, lineHeight: 1.4 }}>
                  {fb.title}
                </h3>

                <p style={{ fontSize: 13, color: "#475569", flex: 1, lineHeight: 1.6, marginBottom: 16, whiteSpace: "pre-wrap" }}>
                  {fb.content}
                </p>

                {/* Admin Reply Section */}
                {fb.admin_reply && (
                  <div style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 16,
                    fontSize: 12,
                    color: "#166534"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, marginBottom: 2 }}>
                      <ShieldCheck size={14} color="#16a34a" /> Ban Quản Lý Phản Hồi:
                    </div>
                    {fb.admin_reply}
                  </div>
                )}

                {/* Card Footer */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingTop: 12,
                  borderTop: "1px solid #f1f5f9",
                  fontSize: 12,
                  color: "var(--text-muted)"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {fb.is_anonymous ? (
                      <>
                        <EyeOff size={14} color="#94a3b8" />
                        <span style={{ fontStyle: "italic", color: "#64748b" }}>Ẩn danh</span>
                      </>
                    ) : (
                      <>
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#e2e8f0",
                          color: "#334155",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10,
                          fontWeight: 700
                        }}>
                          {fb.author_name?.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 600, color: "#334155" }}>{fb.author_name}</span>
                      </>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Upvote / Like Button */}
                    <button
                      onClick={() => handleToggleLike(fb.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "5px 10px",
                        borderRadius: 20,
                        border: fb.has_liked ? "1px solid #fecaca" : "1px solid var(--border)",
                        background: fb.has_liked ? "#fef2f2" : "#f8fafc",
                        color: fb.has_liked ? "#ef4444" : "#64748b",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                      title="Đồng thuận / Thích góp ý này"
                    >
                      <Heart size={14} fill={fb.has_liked ? "#ef4444" : "none"} color={fb.has_liked ? "#ef4444" : "#64748b"} />
                      <span>{fb.likes_count}</span>
                    </button>

                    {/* Admin Reply Button */}
                    {isAdmin && (
                      <button
                        onClick={() => {
                          setReplyingFeedback(fb);
                          setReplyText(fb.admin_reply || "");
                          setReplyStatus(fb.status || "resolved");
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "4px 8px", fontSize: 11 }}
                      >
                        Trả lời
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Create Feedback */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Gửi Ý Kiến Đóng Góp Cho Công Ty
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18 }}>
              Mọi ý kiến của bạn đều được ghi nhận để cùng xây dựng môi trường làm việc tốt hơn.
            </p>

            <form onSubmit={handleCreateFeedback}>
              <div className="form-group">
                <label className="form-label">Danh mục góp ý:</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <option key={key} value={key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tiêu đề góp ý / đề xuất:</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="VD: Đề xuất trang bị thêm bình nước lọc phòng máy ca 3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nội dung chi tiết:</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Mô tả cụ thể hiện trạng, đề xuất giải pháp hoặc mong muốn của bạn..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                />
              </div>

              <div style={{
                background: "#f8fafc",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 20
              }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  <EyeOff size={16} color="#64748b" /> Gửi dưới chế độ Ẩn Danh
                </label>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, display: "block", marginLeft: 26 }}>
                  Khi chọn ẩn danh, họ tên của bạn sẽ được ẩn hoàn toàn trên bảng góp ý chung.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
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
                  <Send size={15} /> {submitting ? "Đang gửi..." : "Đăng Góp Ý"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Admin Reply */}
      {replyingFeedback && (
        <div className="modal-overlay" onClick={() => setReplyingFeedback(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "26px" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              Phản Hồi Ý Kiến: "{replyingFeedback.title}"
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
              Câu trả lời sẽ được hiển thị công khai ngay dưới góp ý để toàn công ty cùng theo dõi.
            </p>

            <div className="form-group">
              <label className="form-label">Cập nhật trạng thái:</label>
              <select
                className="form-select"
                value={replyStatus}
                onChange={(e) => setReplyStatus(e.target.value)}
              >
                <option value="resolved">✅ Đã giải quyết / Đã hoàn tất</option>
                <option value="in_progress">⚙️ Đang xử lý / Đang tiến hành</option>
                <option value="pending">⏳ Đã ghi nhận xem xét</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Nội dung phản hồi từ Ban Quản Lý:</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Nhập thông tin phản hồi hoặc phương án giải quyết..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setReplyingFeedback(null)}
                className="btn btn-secondary"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAdminReply}
                className="btn btn-primary"
              >
                Lưu Phản Hồi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
