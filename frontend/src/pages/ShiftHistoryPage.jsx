import React, { useState, useEffect, useMemo } from "react";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Clock, 
  User, 
  Search, 
  Filter, 
  RefreshCw, 
  TrendingUp, 
  ShieldCheck,
  AlertCircle
} from "lucide-react";

export function ShiftHistoryPage() {
  const { user, isAdmin } = useAuth();
  const [historyList, setHistoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState("ALL"); // ALL, REGISTER, CANCEL
  const [searchKeyword, setSearchKeyword] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getShiftHistory({
        action: actionFilter !== "ALL" ? actionFilter : undefined,
        work_date: dateFilter || undefined,
      });
      setHistoryList(data || []);
    } catch (err) {
      setError(err.message || "Không thể tải lịch sử ca làm việc.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [actionFilter, dateFilter]);

  // Client-side filter by action group and search keyword
  const filteredHistory = useMemo(() => {
    let list = historyList;
    if (actionFilter === "REGISTER") {
      list = list.filter((h) => h.action === "REGISTER");
    } else if (actionFilter === "CANCEL") {
      list = list.filter((h) => ["CANCEL", "APPROVED_CANCEL", "REQUEST_CANCEL"].includes(h.action));
    } else if (actionFilter === "CHANGE") {
      list = list.filter((h) => ["REQUEST_CHANGE", "APPROVED_CHANGE"].includes(h.action));
    } else if (actionFilter === "ABSENCE") {
      list = list.filter((h) => ["SUBMIT_ABSENCE_REQUEST", "APPROVE_ABSENCE", "REPORT_ABSENCE", "REJECT_ABSENCE"].includes(h.action));
    }

    if (!searchKeyword.trim()) return list;
    const kw = searchKeyword.toLowerCase();
    return list.filter((item) => {
      const nameMatch = item.full_name?.toLowerCase().includes(kw);
      const userMatch = item.username?.toLowerCase().includes(kw);
      const shiftMatch = item.shift_name?.toLowerCase().includes(kw);
      const noteMatch = item.note?.toLowerCase().includes(kw);
      return nameMatch || userMatch || shiftMatch || noteMatch;
    });
  }, [historyList, actionFilter, searchKeyword]);

  // Summary Metrics
  const totalCount = historyList.length;
  const registerCount = historyList.filter((h) => h.action === "REGISTER").length;
  const cancelCount = historyList.filter((h) => ["CANCEL", "APPROVED_CANCEL"].includes(h.action)).length;
  const changeCount = historyList.filter((h) => ["REQUEST_CHANGE", "APPROVED_CHANGE"].includes(h.action)).length;
  const absenceCount = historyList.filter((h) => ["SUBMIT_ABSENCE_REQUEST", "APPROVE_ABSENCE", "REPORT_ABSENCE"].includes(h.action)).length;


  const renderActionBadge = (action) => {
    switch (action) {
      case "REGISTER":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#dcfce7",
            color: "#15803d",
            border: "1px solid #bbf7d0"
          }}>
            <CheckCircle2 size={13} /> + ĐĂNG KÝ CA
          </span>
        );
      case "CANCEL":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#fee2e2",
            color: "#b91c1c",
            border: "1px solid #fecaca"
          }}>
            <XCircle size={13} /> - HỦY CA
          </span>
        );
      case "REQUEST_CANCEL":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#fffbeb",
            color: "#b45309",
            border: "1px solid #fde68a"
          }}>
            <Clock size={13} /> XIN HỦY CA
          </span>
        );
      case "APPROVED_CANCEL":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#fee2e2",
            color: "#dc2626",
            border: "1px solid #fca5a5"
          }}>
            <XCircle size={13} /> ĐÃ DUYỆT HỦY CA
          </span>
        );
      case "REQUEST_CHANGE":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#eff6ff",
            color: "#1d4ed8",
            border: "1px solid #bfdbfe"
          }}>
            <TrendingUp size={13} /> XIN ĐỔI CA
          </span>
        );
      case "APPROVED_CHANGE":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#f3e8ff",
            color: "#7e22ce",
            border: "1px solid #d8b4fe"
          }}>
            <CheckCircle2 size={13} /> ĐÃ DUYỆT ĐỔI CA
          </span>
        );
      case "SUBMIT_ABSENCE_REQUEST":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#fef3c7",
            color: "#92400e",
            border: "1px solid #fcd34d"
          }}>
            <Clock size={13} /> BÁO VẮNG (CHỜ DUYỆT)
          </span>
        );
      case "APPROVE_ABSENCE":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#fee2e2",
            color: "#991b1b",
            border: "1px solid #f87171"
          }}>
            <AlertCircle size={13} /> ĐÃ DUYỆT VẮNG
          </span>
        );
      case "REJECT_ABSENCE":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#f1f5f9",
            color: "#475569",
            border: "1px solid #cbd5e1"
          }}>
            <XCircle size={13} /> TỪ CHỐI DUYỆT VẮNG
          </span>
        );
      case "REPORT_ABSENCE":
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#fee2e2",
            color: "#b91c1c",
            border: "1px solid #fca5a5"
          }}>
            <AlertCircle size={13} /> BÁO VẮNG CA
          </span>
        );
      default:
        return (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            background: "#f1f5f9",
            color: "#334155",
            border: "1px solid #cbd5e1"
          }}>
            {action}
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        marginBottom: 24
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff"
            }}>
              <History size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>
                Nhật Ký Lịch Sử Đăng Ký & Hủy Ca
              </h1>
              <p style={{ margin: "3px 0 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                Theo dõi toàn bộ biến động đăng ký, hủy ca và điều chuyển ca làm việc (9 Ca chuẩn timeline trường).
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="btn btn-secondary"
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
        marginBottom: 24
      }}>
        <div style={{
          background: "#ffffff",
          borderRadius: 14,
          padding: "16px 20px",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Tổng lượt ghi nhận
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
            {totalCount}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <History size={13} /> Dữ liệu cập nhật thời gian thực
          </div>
        </div>

        <div style={{
          background: "#ffffff",
          borderRadius: 14,
          padding: "16px 20px",
          border: "1px solid #bbf7d0",
          backgroundColor: "#f0fdf4",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#166534", textTransform: "uppercase" }}>
            Số lượt Đăng Ký Ca
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#15803d", marginTop: 4 }}>
            {registerCount}
          </div>
          <div style={{ fontSize: 12, color: "#166534", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={13} /> Nhân viên xác nhận đi làm
          </div>
        </div>

        <div style={{
          background: "#ffffff",
          borderRadius: 14,
          padding: "16px 20px",
          border: "1px solid #fecaca",
          backgroundColor: "#fef2f2",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#991b1b", textTransform: "uppercase" }}>
            Số lượt Hủy Ca
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#b91c1c", marginTop: 4 }}>
            {cancelCount}
          </div>
          <div style={{ fontSize: 12, color: "#991b1b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            <XCircle size={13} /> Nhân viên đã hủy lịch trực
          </div>
        </div>

        <div style={{
          background: "#ffffff",
          borderRadius: 14,
          padding: "16px 20px",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Quyền hạn tra cứu
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            {isAdmin ? (
              <span className="badge badge-purple" style={{ padding: "4px 8px" }}>
                <ShieldCheck size={14} /> Toàn bộ nhân sự (Admin)
              </span>
            ) : (
              <span className="badge badge-blue" style={{ padding: "4px 8px" }}>
                <User size={14} /> Cá nhân: {user?.full_name}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {isAdmin ? "Xem và đối soát mọi thao tác của tất cả ca" : "Chỉ hiển thị lịch sử của chính bạn"}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        background: "#ffffff",
        borderRadius: 14,
        padding: "16px 20px",
        border: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 20
      }}>
        {/* Action filter pill buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginRight: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Filter size={14} /> Hành động:
          </span>
          <button
            onClick={() => setActionFilter("ALL")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: actionFilter === "ALL" ? "#2563eb" : "var(--border)",
              background: actionFilter === "ALL" ? "#eff6ff" : "#ffffff",
              color: actionFilter === "ALL" ? "#2563eb" : "#475569"
            }}
          >
            Tất cả ({totalCount})
          </button>
          <button
            onClick={() => setActionFilter("REGISTER")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: actionFilter === "REGISTER" ? "#16a34a" : "var(--border)",
              background: actionFilter === "REGISTER" ? "#f0fdf4" : "#ffffff",
              color: actionFilter === "REGISTER" ? "#16a34a" : "#475569"
            }}
          >
            + Đăng ký ({registerCount})
          </button>
          <button
            onClick={() => setActionFilter("CANCEL")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: actionFilter === "CANCEL" ? "#dc2626" : "var(--border)",
              background: actionFilter === "CANCEL" ? "#fef2f2" : "#ffffff",
              color: actionFilter === "CANCEL" ? "#dc2626" : "#475569"
            }}
          >
            - Hủy ca ({cancelCount})
          </button>
          <button
            onClick={() => setActionFilter("CHANGE")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: actionFilter === "CHANGE" ? "#7e22ce" : "var(--border)",
              background: actionFilter === "CHANGE" ? "#f3e8ff" : "#ffffff",
              color: actionFilter === "CHANGE" ? "#7e22ce" : "#475569"
            }}
          >
            ⇄ Đổi ca ({changeCount})
          </button>
          <button
            onClick={() => setActionFilter("ABSENCE")}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid",
              borderColor: actionFilter === "ABSENCE" ? "#d97706" : "var(--border)",
              background: actionFilter === "ABSENCE" ? "#fef3c7" : "#ffffff",
              color: actionFilter === "ABSENCE" ? "#d97706" : "#475569"
            }}
          >
            🚫 Báo vắng ({absenceCount})
          </button>
        </div>

        {/* Search & Date Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Tìm theo tên nhân viên, ca..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                padding: "7px 12px 7px 32px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                outline: "none",
                width: 220
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Ngày ca:</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 13,
                outline: "none"
              }}
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#ef4444",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600
                }}
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          padding: 14,
          borderRadius: 10,
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Table Card */}
      <div style={{
        background: "#ffffff",
        borderRadius: 14,
        border: "1px solid var(--border)",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
      }}>
        {loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            Đang tải lịch sử đăng ký / hủy ca...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center" }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px auto",
              color: "#94a3b8"
            }}>
              <History size={24} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#334155" }}>
              Không tìm thấy nhật ký biến động ca nào
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Khi nhân viên thao tác đăng ký hoặc hủy ca làm việc trên hệ thống, toàn bộ lịch sử sẽ tự động hiển thị tại đây.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)", color: "#475569", fontWeight: 700 }}>
                  <th style={{ padding: "12px 16px" }}>Loại Thao Tác</th>
                  <th style={{ padding: "12px 16px" }}>Nhân Viên</th>
                  <th style={{ padding: "12px 16px" }}>Ca Làm Việc</th>
                  <th style={{ padding: "12px 16px" }}>Khung Giờ</th>
                  <th style={{ padding: "12px 16px" }}>Ngày Làm Việc</th>
                  <th style={{ padding: "12px 16px" }}>Thời Gian Thực Hiện</th>
                  <th style={{ padding: "12px 16px" }}>Ghi Chú</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((row) => {
                  const isRegister = row.action === "REGISTER";
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        transition: "background-color 0.15s ease"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {/* Action Badge */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        {renderActionBadge(row.action)}
                      </td>

                      {/* Employee */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: isRegister ? "#eff6ff" : "#fef2f2",
                            color: isRegister ? "#2563eb" : "#dc2626",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: 12
                          }}>
                            {row.full_name ? row.full_name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>
                              {row.full_name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              @{row.username} {row.department ? `• ${row.department}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Shift Name */}
                      <td style={{ padding: "14px 16px", fontWeight: 700, color: "#0284c7" }}>
                        {row.shift_name}
                      </td>

                      {/* Shift Time Label */}
                      <td style={{ padding: "14px 16px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          color: "#334155",
                          fontWeight: 600,
                          fontSize: 12,
                          background: "#f1f5f9",
                          padding: "3px 8px",
                          borderRadius: 6
                        }}>
                          <Clock size={12} color="#64748b" />
                          {row.shift_label || `${row.start_time} - ${row.end_time}`}
                        </span>
                      </td>

                      {/* Work Date */}
                      <td style={{ padding: "14px 16px", fontWeight: 600, color: "#1e293b" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Calendar size={13} color="#64748b" />
                          {row.work_date}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td style={{ padding: "14px 16px", color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
                        {row.created_at ? row.created_at.replace("T", " ").substring(0, 19) : "-"}
                      </td>

                      {/* Note */}
                      <td style={{ padding: "14px 16px", color: row.note ? "#475569" : "#94a3b8", fontStyle: row.note ? "normal" : "italic", maxWidth: 220 }}>
                        {row.note || "Không có ghi chú"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}