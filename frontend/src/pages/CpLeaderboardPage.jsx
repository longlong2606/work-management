import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  Sparkles,
  Trophy,
  Award,
  TrendingUp,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  RefreshCw,
  User,
  Star,
  ShieldCheck,
  Percent
} from "lucide-react";

export function CpLeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await api.getCpLeaderboard();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Lỗi khi tải bảng điểm CP:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleViewUserHistory = async (u) => {
    setSelectedUser(u);
    setLoadingHistory(true);
    try {
      const data = await api.getUserCpHistory(u.user_id);
      setUserHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Lỗi khi tải lịch sử CP:", err);
      setUserHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredLeaderboard = leaderboard.filter(
    (item) =>
      item.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.username?.toLowerCase().includes(search.toLowerCase()) ||
      item.department?.toLowerCase().includes(search.toLowerCase())
  );

  const myStats = leaderboard.find((item) => item.user_id === user?.id) || {
    total_cp: 0,
    subtasks_finished: 0,
    tier: "Học việc (Junior)",
    next_tier_cp: 50,
    progress_pct: 0,
  };

  const totalLabCp = leaderboard.reduce((acc, curr) => acc + (curr.total_cp || 0), 0);
  const topMember = leaderboard[0];

  return (
    <div style={{ maxWidth: 1200, margin: "24px auto", padding: "0 16px" }}>
      {/* HEADER BANNER */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
          borderRadius: 16,
          padding: "24px 28px",
          color: "#ffffff",
          marginBottom: 24,
          boxShadow: "0 10px 25px -5px rgba(67, 56, 202, 0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, position: "relative", zIndex: 1 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "6px 12px",
                  borderRadius: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  backdropFilter: "blur(6px)",
                }}
              >
                <Sparkles size={16} color="#fbbf24" />
                <span>Hệ Thống Điểm Đóng Góp (CP)</span>
              </div>
              <button
                onClick={() => setShowRulesModal(true)}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "none",
                  color: "#ffffff",
                  cursor: "pointer",
                  borderRadius: 20,
                  padding: "4px 10px",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Info size={14} /> Cách tính điểm & DoD
              </button>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
              Bảng Xếp Hạng Cống Hiến & Tích Lũy CP
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "#c7d2fe", maxWidth: 600 }}>
              Ghi nhận minh bạch theo 4 bước chuẩn: Nhận task → Hoàn thành đúng DoD → Nộp minh chứng → Reviewer nghiệm thu.
            </p>
          </div>

          <button
            onClick={fetchLeaderboard}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              borderRadius: 10,
              padding: "8px 14px",
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s",
            }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Làm mới
          </button>
        </div>

        {/* METRICS ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginTop: 24,
            position: "relative",
            zIndex: 1,
          }}
        >
          {user?.role === "admin" ? (
            <>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(10px)",
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Vai trò của tôi</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#a78bfa" }}>Quản Trị Viên</div>
                <div style={{ fontSize: 11, color: "#c4b5fd", marginTop: 4 }}>Hội đồng nghiệm thu & duyệt CP</div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(10px)",
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Chế độ đánh giá</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", marginTop: 2 }}>
                  Không tính điểm cá nhân
                </div>
                <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 4 }}>Dành riêng cho nhân sự thi đua</div>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(10px)",
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Điểm CP của tôi</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#fbbf24" }}>{myStats.total_cp} <span style={{ fontSize: 13, fontWeight: 500 }}>CP</span></div>
                <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 4 }}>Cấp bậc: {myStats.tier}</div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(10px)",
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                }}
              >
                <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Tiến độ thăng hạng</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#ffffff" }}>
                  {myStats.total_cp} / {myStats.next_tier_cp} CP
                </div>
                <div style={{ width: "100%", background: "rgba(255,255,255,0.2)", height: 6, borderRadius: 3, marginTop: 8, overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (myStats.total_cp / (myStats.next_tier_cp || 1)) * 100)}%`,
                      height: "100%",
                      background: "#10b981",
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            </>
          )}

          <div
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
              padding: "14px 18px",
              borderRadius: 12,
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Cống hiến hàng đầu</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: 6 }}>
              <Trophy size={16} color="#fbbf24" /> {topMember?.full_name || "Chưa có"}
            </div>
            <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 4 }}>{topMember ? `${topMember.total_cp} CP tích lũy` : "Đang chờ nghiệm thu"}</div>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(10px)",
              padding: "14px 18px",
              borderRadius: 12,
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Tổng CP toàn Lab</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#34d399" }}>{totalLabCp} <span style={{ fontSize: 13, fontWeight: 500 }}>CP</span></div>
            <div style={{ fontSize: 11, color: "#93c5fd", marginTop: 4 }}>{leaderboard.length} thành viên tham gia</div>
          </div>
        </div>
      </div>

      {/* SEARCH BAR & CONTROLS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", minWidth: 280, flex: 1, maxWidth: 400 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Tìm theo tên thành viên, username..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px 9px 36px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* LEADERBOARD TABLE CARD */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <th style={{ padding: "12px 16px", width: 60, textAlign: "center" }}>Hạng</th>
                <th style={{ padding: "12px 16px" }}>Thành viên</th>
                <th style={{ padding: "12px 16px" }}>Vai trò / Bộ phận</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Checklist Hoàn Thành</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>Tổng CP Tích Lũy</th>
                <th style={{ padding: "12px 16px" }}>Cấp bậc Cống hiến</th>
                <th style={{ padding: "12px 16px", width: 100, textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 16px", color: "#94a3b8" }}>
                    {loading ? "Đang tải dữ liệu..." : "Chưa có thành viên nào tích lũy CP"}
                  </td>
                </tr>
              ) : (
                filteredLeaderboard.map((u, idx) => {
                  const isTop1 = idx === 0 && u.total_cp > 0;
                  const isTop2 = idx === 1 && u.total_cp > 0;
                  const isTop3 = idx === 2 && u.total_cp > 0;
                  const isMe = u.user_id === user?.id;

                  return (
                    <tr
                      key={u.user_id}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        background: isMe ? "#f0fdf4" : "transparent",
                        transition: "background 0.15s",
                      }}
                    >
                      {/* RANK */}
                      <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: 700 }}>
                        {isTop1 ? (
                          <span style={{ fontSize: 18 }}>🥇</span>
                        ) : isTop2 ? (
                          <span style={{ fontSize: 18 }}>🥈</span>
                        ) : isTop3 ? (
                          <span style={{ fontSize: 18 }}>🥉</span>
                        ) : (
                          <span style={{ color: "#64748b", fontSize: 14 }}>#{idx + 1}</span>
                        )}
                      </td>

                      {/* USER INFO */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: isTop1 ? "#fef3c7" : "#e0e7ff",
                              color: isTop1 ? "#d97706" : "#4338ca",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 14,
                            }}
                          >
                            {u.full_name?.charAt(0) || "U"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                              {u.full_name}
                              {isMe && (
                                <span style={{ fontSize: 11, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 4 }}>
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>@{u.username}</div>
                          </div>
                        </div>
                      </td>

                      {/* ROLE & DEPT */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{u.role?.toUpperCase()}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{u.department || "Lab Vận Hành"}</div>
                      </td>

                      {/* FINISHED SUBTASKS */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <span
                          style={{
                            background: "#f1f5f9",
                            padding: "3px 8px",
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#475569",
                          }}
                        >
                          {u.subtasks_finished} mục
                        </span>
                      </td>

                      {/* TOTAL CP */}
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "#2563eb" }}>
                          {u.total_cp} <span style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>CP</span>
                        </div>
                      </td>

                      {/* TIER BADGE */}
                      <td style={{ padding: "14px 16px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 10px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background:
                              u.total_cp >= 300
                                ? "#fef3c7"
                                : u.total_cp >= 150
                                ? "#ede9fe"
                                : u.total_cp >= 50
                                ? "#e0f2fe"
                                : "#f1f5f9",
                            color:
                              u.total_cp >= 300
                                ? "#b45309"
                                : u.total_cp >= 150
                                ? "#6d28d9"
                                : u.total_cp >= 50
                                ? "#0369a1"
                                : "#475569",
                          }}
                        >
                          <Star size={12} /> {u.tier}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: "14px 16px", textAlign: "center" }}>
                        <button
                          onClick={() => handleViewUserHistory(u)}
                          style={{
                            background: "#f8fafc",
                            border: "1px solid #cbd5e1",
                            padding: "5px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 12,
                            color: "#334155",
                            fontWeight: 500,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Chi tiết <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* USER HISTORY MODAL */}
      {selectedUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
          onClick={() => setSelectedUser(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              maxWidth: 650,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                  Lịch Sử Cống Hiến CP: {selectedUser.full_name}
                </h3>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  Tổng điểm tích lũy: <strong style={{ color: "#2563eb" }}>{selectedUser.total_cp} CP</strong> &bull; {selectedUser.tier}
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: 18,
                  cursor: "pointer",
                  color: "#94a3b8",
                }}
              >
                &times;
              </button>
            </div>

            {loadingHistory ? (
              <div style={{ padding: "30px 0", textAlign: "center", color: "#64748b" }}>Đang tải lịch sử...</div>
            ) : userHistory.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>
                Chưa có lịch sử nhận CP cho thành viên này.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {userHistory.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "12px 14px",
                      background: "#fafafa",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 14 }}>{item.subtask_title}</div>
                      <span
                        style={{
                          background: item.cp_earned < 0 ? "#fef2f2" : "#dcfce7",
                          color: item.cp_earned < 0 ? "#b91c1c" : "#166534",
                          fontWeight: 700,
                          fontSize: 13,
                          padding: "2px 8px",
                          borderRadius: 6,
                          border: `1px solid ${item.cp_earned < 0 ? "#fecaca" : "#bbf7d0"}`,
                        }}
                      >
                        {item.cp_earned < 0 ? `${item.cp_earned} CP (Phạt)` : `+${item.cp_earned} CP`}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
                      Nhiệm vụ cha: <strong>{item.task_title}</strong>
                    </div>

                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#475569" }}>
                      <span>Tỷ lệ đóng góp: <strong>{item.contribution_pct}%</strong></span>
                      {item.quality_multiplier !== 1.0 && (
                        <span>Hệ số chất lượng: <strong>{item.quality_multiplier}x</strong></span>
                      )}
                      <span>Ngày duyệt: {new Date(item.awarded_at).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RULES / DOD EXPLANATION MODAL */}
      {showRulesModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
          onClick={() => setShowRulesModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              maxWidth: 620,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color="#4f46e5" /> Quy Trình Nghiệm Thu & Tích Lũy CP
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#f8fafc", padding: 14, borderRadius: 10, borderLeft: "4px solid #3b82f6" }}>
                <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>Quy trình 4 bước chuẩn</div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
                  1. <strong>Nhận task hợp lệ</strong>: Được phân công hoặc đăng ký checklist.<br />
                  2. <strong>Hoàn thành đúng DoD</strong>: Đạt chuẩn chất lượng kỹ thuật, không báo cáo khống.<br />
                  3. <strong>Có minh chứng</strong>: Link PR, file hình ảnh, checklist kiểm thử.<br />
                  4. <strong>Reviewer nghiệm thu</strong>: Trưởng nhóm hoặc Admin phê duyệt ĐẠT.
                </div>
              </div>

              <div style={{ background: "#f0fdf4", padding: 14, borderRadius: 10, borderLeft: "4px solid #10b981" }}>
                <div style={{ fontWeight: 600, color: "#166534", marginBottom: 4 }}>Công thức tính điểm đa thành viên</div>
                <div style={{ fontSize: 13, color: "#166534", lineHeight: 1.5 }}>
                  <strong>CP Earned = CP Định Mức &times; (% Đóng Góp / 100) &times; Hệ Số Chất Lượng</strong>
                  <br />
                  <em>Ví dụ:</em> Mục việc 40 CP, Member A đóng góp 70% = 28 CP; Member B đóng góp 30% = 12 CP.
                </div>
              </div>

              <div style={{ background: "#fef3c7", padding: 14, borderRadius: 10, borderLeft: "4px solid #f59e0b" }}>
                <div style={{ fontWeight: 600, color: "#92400e", marginBottom: 4 }}>Các mốc điểm thăng hạng</div>
                <div style={{ fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
                  &bull; <strong>Dưới 50 CP</strong>: Học việc (Junior)<br />
                  &bull; <strong>50 - 149 CP</strong>: Thành viên cốt cán (Active Member)<br />
                  &bull; <strong>150 - 299 CP</strong>: Chuyên gia kỹ thuật (Specialist)<br />
                  &bull; <strong>Từ 300 CP trở lên</strong>: Trụ cột xuất sắc (Master Contributor)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default CpLeaderboardPage;
