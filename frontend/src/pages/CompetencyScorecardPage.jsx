import React, { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  COMPETENCY_GROUPS,
  INITIAL_MEMBERS,
  calculateMemberStats,
} from "../constants/competencyData";
import { TriangleRadarChart, getRankTier } from "../components/TriangleRadarChart";
import {
  Award,
  Search,
  Users,
  Sliders,
  HelpCircle,
  RefreshCw,
  GitCompare,
  UserCheck,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Check
} from "lucide-react";

export function CompetencyScorecardPage() {
  const auth = useAuth();
  const canEvaluate = auth?.canEvaluate ?? true;

  // Helper chuyển đổi User thực tế từ Backend Database sang Member đánh giá
  const mapUserToMember = (u) => {
    let scores = {};
    try {
      scores = typeof u.scores_json === "string" ? JSON.parse(u.scores_json || "{}") : (u.scores_json || {});
    } catch {
      scores = {};
    }

    const defaultScores = {};
    for (let i = 1; i <= 18; i++) {
      defaultScores[`c${i}`] = 6;
    }
    const mergedScores = { ...defaultScores, ...scores };

    const roleMap = {
      admin: "Quản trị viên (Admin)",
      core: "Quản lý Cốt cán (Core)",
      leader: "Trưởng nhóm (Lead)",
      contributor: "Thành viên (Contributor)",
      learning: "Học việc (Learning)",
    };

    const roleLevelMap = {
      admin: "Lead",
      core: "Lead",
      leader: "Lead",
      contributor: "Chính thức",
      learning: "Thực tập",
    };

    return {
      id: String(u.id),
      userId: u.id,
      name: u.full_name || u.username,
      username: u.username,
      role: roleMap[u.role] || u.role || "Thành viên",
      roleLevel: roleLevelMap[u.role] || "Thành viên",
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.full_name || u.username)}&background=2563eb&color=fff&bold=true`,
      department: u.department || "Ban Kỹ Thuật & Vận Hành",
      desiredDirection: u.desired_direction || "Phát triển chuyên môn và tích cực đóng góp cho các dự án phòng máy Lab.",
      commitmentLevel: u.commitment_level || "100% Toàn thời gian & đúng ca trực",
      evidenceNotes: u.evidence_notes || "Tích cực hoàn thành tốt các ca trực và checklist được giao.",
      scores: mergedScores,
    };
  };

  // Members state (Khởi tạo từ cache hoặc mẫu, sau đó đồng bộ với Database nhân sự)
  const [members, setMembers] = useState(() => {
    try {
      const saved = localStorage.getItem("lab_competency_members");
      return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  // Selected member for scorecard
  const [selectedMemberId, setSelectedMemberId] = useState(() => {
    return members[0]?.id || "1";
  });
  // Comparison member for head-to-head mode
  const [compareMemberId, setCompareMemberId] = useState(() => {
    return members[1]?.id || members[0]?.id || "1";
  });

  // Tự động kết nối và tải danh sách nhân sự thực tế từ Backend Database
  useEffect(() => {
    const fetchRealStaffData = async () => {
      try {
        const res = await api.getCompetencies();
        if (Array.isArray(res) && res.length > 0) {
          const mapped = res.map(mapUserToMember);
          setMembers(mapped);
          try {
            localStorage.setItem("lab_competency_members", JSON.stringify(mapped));
          } catch {}

          setSelectedMemberId((prev) => (mapped.some((m) => m.id === prev) ? prev : mapped[0].id));
          setCompareMemberId((prev) => (mapped.some((m) => m.id === prev) ? prev : (mapped[1] ? mapped[1].id : mapped[0].id)));
        }
      } catch (err) {
        console.error("Không thể tải danh sách nhân sự từ server, dùng cache offline:", err);
      }
    };

    fetchRealStaffData();
  }, []);

  // View modes: "scorecard" | "compare"
  const [viewMode, setViewMode] = useState("scorecard");

  // Grading / Edit mode state
  const [isGradingMode, setIsGradingMode] = useState(false);

  // Active highlighted group on radar ("group1" | "group2" | "group3" | null)
  const [activeGroupFilter, setActiveGroupFilter] = useState(null);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Member Dropdown state
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsMemberDropdownOpen(false);
      }
    };
    if (isMemberDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMemberDropdownOpen]);

  // Quick navigation helpers: prev / next member
  const currentMemberIndex = useMemo(() => {
    const idx = members.findIndex((m) => m.id === selectedMemberId);
    return idx >= 0 ? idx : 0;
  }, [members, selectedMemberId]);

  const handlePrevMember = (e) => {
    e.stopPropagation();
    if (members.length === 0) return;
    const newIdx = (currentMemberIndex - 1 + members.length) % members.length;
    setSelectedMemberId(members[newIdx].id);
  };

  const handleNextMember = (e) => {
    e.stopPropagation();
    if (members.length === 0) return;
    const newIdx = (currentMemberIndex + 1) % members.length;
    setSelectedMemberId(members[newIdx].id);
  };

  // Save changes to localStorage và Đồng bộ trực tiếp về Database Backend
  const saveMembers = (newMembers) => {
    setMembers(newMembers);
    try {
      localStorage.setItem("lab_competency_members", JSON.stringify(newMembers));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }

    // Đồng bộ điểm lên cơ sở dữ liệu cho nhân sự đang được chấm
    const activeMemberObj = newMembers.find((m) => m.id === currentMember?.id);
    if (activeMemberObj && activeMemberObj.userId) {
      api.updateCompetency(activeMemberObj.userId, {
        scores_json: JSON.stringify(activeMemberObj.scores),
        desired_direction: activeMemberObj.desiredDirection || "",
        commitment_level: activeMemberObj.commitmentLevel || "",
        evidence_notes: activeMemberObj.evidenceNotes || "",
      }).catch((err) => {
        console.error("Lỗi đồng bộ điểm lên database:", err);
      });
    }
  };

  // Reset to original PDF default
  const handleResetData = () => {
    if (window.confirm("Bạn có chắc chắn muốn đặt lại toàn bộ điểm về dữ liệu gốc từ tài liệu đánh giá không?")) {
      saveMembers(INITIAL_MEMBERS);
    }
  };

  // Find active member object
  const currentMember = useMemo(() => {
    return members.find((m) => m.id === selectedMemberId) || members[0];
  }, [members, selectedMemberId]);

  // Find compare member object
  const compareMember = useMemo(() => {
    return members.find((m) => m.id === compareMemberId) || members[1];
  }, [members, compareMemberId]);

  // Calculate current member stats
  const currentStats = useMemo(() => {
    return calculateMemberStats(currentMember.scores);
  }, [currentMember]);

  // Calculate compare member stats
  const compareStats = useMemo(() => {
    return calculateMemberStats(compareMember.scores);
  }, [compareMember]);

  // Overall Rank Tiers
  const currentTier = useMemo(() => getRankTier(currentStats.overallAvg), [currentStats]);
  const compareTier = useMemo(() => getRankTier(compareStats.overallAvg), [compareStats]);

  // Handle score edit for current member (Xóa 1 chạm là mất sạch, gõ số mới tự nhiên)
  const handleScoreChange = (criterionId, val) => {
    // Nếu người dùng xóa trống ô (bấm Backspace hoặc Delete)
    if (val === "" || val === null || val === undefined) {
      const updated = members.map((m) => {
        if (m.id === currentMember.id) {
          return {
            ...m,
            scores: {
              ...m.scores,
              [criterionId]: "",
            },
          };
        }
        return m;
      });
      saveMembers(updated);
      return;
    }

    // Chuyển dấu phẩy tiếng Việt thành dấu chấm thập phân (ví dụ 7,5 -> 7.5)
    let strVal = String(val).replace(",", ".").trim();

    // Nếu người dùng đang gõ dở dấu chấm (ví dụ "7.") thì giữ nguyên để gõ tiếp số lẻ
    if (strVal.endsWith(".")) {
      const updated = members.map((m) => {
        if (m.id === currentMember.id) {
          return {
            ...m,
            scores: {
              ...m.scores,
              [criterionId]: strVal,
            },
          };
        }
        return m;
      });
      saveMembers(updated);
      return;
    }

    let parsed = parseFloat(strVal);
    if (isNaN(parsed)) return;

    // Nếu gõ đè số mới vào số cũ (ví dụ đang là 8 gõ 5 thành "85", hoặc đang là 10 gõ 5 thành "105")
    if (parsed > 10 && !strVal.includes(".")) {
      if (strVal === "10" || strVal.endsWith("10")) {
        parsed = 10;
      } else {
        const lastChar = strVal.slice(-1);
        const lastDigit = parseFloat(lastChar);
        parsed = !isNaN(lastDigit) ? lastDigit : 10;
      }
    }

    // Giới hạn điểm từ 0 đến 10, làm tròn tối đa 1 chữ số thập phân
    const num = Math.min(10, Math.max(0, Math.round(parsed * 10) / 10));

    const updated = members.map((m) => {
      if (m.id === currentMember.id) {
        return {
          ...m,
          scores: {
            ...m.scores,
            [criterionId]: num,
          },
        };
      }
      return m;
    });
    saveMembers(updated);
  };

  // Filtered members list for selector
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole =
        roleFilter === "all" ||
        (roleFilter === "leader"
          ? m.roleLevel.toLowerCase() === "lead" || m.roleLevel.toLowerCase() === "leader"
          : m.roleLevel.toLowerCase() === roleFilter.toLowerCase());
      return matchSearch && matchRole;
    });
  }, [members, searchTerm, roleFilter]);

  return (
    <div className="scorecard-container" style={{ width: "100%", maxWidth: 1280, margin: "0 auto", padding: "16px", boxSizing: "border-box" }}>
      {/* 1. HERO HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #1e293b 100%)",
          borderRadius: 20,
          padding: "20px 24px",
          color: "#ffffff",
          marginBottom: 20,
          boxShadow: "0 12px 32px rgba(15, 23, 42, 0.2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow decoration circles */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.35) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(139, 92, 246, 0.25)",
                  border: "1px solid rgba(167, 139, 250, 0.4)",
                  padding: "4px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                  color: "#c4b5fd",
                }}
              >
                <Award size={14} color="#a78bfa" />
                BLUE LOCK RADAR
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                Biểu đồ tam giác 3 nhóm năng lực chuẩn Lab
              </span>
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 900,
                letterSpacing: "-0.5px",
                margin: "0 0 6px 0",
                textShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              BẢNG ĐIỂM ĐÁNH GIÁ NĂNG LỰC THÀNH VIÊN
            </h1>
            <p style={{ margin: 0, fontSize: 12.5, color: "#cbd5e1", maxWidth: 680 }}>
              Biểu đồ tam giác phản ánh 3 trụ cột năng lực: <strong>Quản Lý Dự Án & Đối Ngoại</strong> (Đỉnh trên), <strong>Kỹ Thuật & Hệ Thống</strong> (Góc phải) và <strong>Research & AI</strong> (Góc trái).
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {canEvaluate ? (
              <button
                onClick={() => setIsGradingMode(!isGradingMode)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: isGradingMode ? "#eab308" : "rgba(255, 255, 255, 0.12)",
                  color: isGradingMode ? "#0f172a" : "#ffffff",
                  border: isGradingMode ? "none" : "1px solid rgba(255, 255, 255, 0.2)",
                  transition: "all 0.2s ease",
                }}
              >
                <Sliders size={14} />
                {isGradingMode ? "Đang bật chấm điểm" : "Chế độ chấm điểm"}
              </button>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  background: "rgba(255, 255, 255, 0.08)",
                  color: "#94a3b8",
                  border: "1px dashed rgba(255, 255, 255, 0.2)"
                }}
                title="Chỉ Quản lý (Admin, Core, Leader) và Contributor mới có quyền chấm điểm đánh giá"
              >
                <Sliders size={14} />
                Chế độ chỉ xem
              </div>
            )}
            <button
              onClick={handleResetData}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                background: "rgba(255, 255, 255, 0.08)",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                transition: "all 0.2s ease",
              }}
              title="Khôi phục lại điểm gốc ban đầu"
            >
              <RefreshCw size={13} />
              Đặt lại gốc
            </button>
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            paddingTop: 14,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setViewMode("scorecard")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: viewMode === "scorecard" ? "#ffffff" : "transparent",
              color: viewMode === "scorecard" ? "#0f172a" : "#cbd5e1",
              border: "none",
              transition: "all 0.2s ease",
            }}
          >
            <Award size={14} color={viewMode === "scorecard" ? "#7c3aed" : "currentColor"} />
            Thẻ Điểm Cá Nhân (Radar Tam Giác)
          </button>
          <button
            onClick={() => setViewMode("compare")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 16px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: viewMode === "compare" ? "#ffffff" : "transparent",
              color: viewMode === "compare" ? "#0f172a" : "#cbd5e1",
              border: "none",
              transition: "all 0.2s ease",
            }}
          >
            <GitCompare size={14} color={viewMode === "compare" ? "#f97316" : "currentColor"} />
            So Sánh Năng Lực (2 Thành Viên)
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: SCORECARD VIEW (THẺ ĐIỂM CÁ NHÂN BLUE LOCK)       */}
      {/* ======================================================== */}
      {viewMode === "scorecard" && (
        <div style={{ width: "100%" }}>
          {/* MEMBER SELECTION DROPDOWN LIST (Thay thế thanh cuộn ngang bằng danh sách chọn thông minh) */}
          <div
            ref={dropdownRef}
            style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: "12px 18px",
              marginBottom: 20,
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
              border: "1px solid #e2e8f0",
              width: "100%",
              boxSizing: "border-box",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {/* Left: Dropdown Trigger Button */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Users size={18} color="#2563eb" />
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#475569" }}>
                    Chọn Thành Viên:
                  </span>
                </div>

                {/* The Dropdown Button */}
                <button
                  type="button"
                  onClick={() => setIsMemberDropdownOpen(!isMemberDropdownOpen)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 14px 6px 8px",
                    borderRadius: 12,
                    border: isMemberDropdownOpen ? "2px solid #2563eb" : "1.5px solid #cbd5e1",
                    background: isMemberDropdownOpen ? "#eff6ff" : "#f8fafc",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    boxShadow: isMemberDropdownOpen ? "0 4px 14px rgba(37, 99, 235, 0.15)" : "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                  title="Nhấp để mở danh sách toàn bộ thành viên"
                >
                  <img
                    src={currentMember.avatar}
                    alt={currentMember.name}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: `2px solid ${currentTier.color}`,
                    }}
                  />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                      {currentMember.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {currentMember.role}
                    </div>
                  </div>

                  {/* Rank Stamp Badge */}
                  <div
                    style={{
                      padding: "2px 7px",
                      borderRadius: 6,
                      background: currentTier.bg,
                      border: `1px solid ${currentTier.border}`,
                      color: currentTier.textColor,
                      fontWeight: 900,
                      fontSize: 12,
                      fontFamily: "Impact, sans-serif",
                      marginLeft: 4,
                    }}
                  >
                    {currentTier.rank}
                  </div>

                  {/* Score */}
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#059669", marginLeft: 2 }}>
                    {currentStats.overallAvg.toFixed(1)}/10
                  </span>

                  {/* Chevron Icon */}
                  {isMemberDropdownOpen ? (
                    <ChevronUp size={16} color="#2563eb" style={{ marginLeft: 4 }} />
                  ) : (
                    <ChevronDown size={16} color="#64748b" style={{ marginLeft: 4 }} />
                  )}
                </button>
              </div>

              {/* Right: Quick Switcher (< Trước | Vị trí | Sau >) */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handlePrevMember}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="Chuyển về nhân sự trước đó"
                >
                  <ChevronLeft size={14} /> Trước
                </button>

                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", padding: "0 4px" }}>
                  {currentMemberIndex + 1} / {members.length}
                </span>

                <button
                  type="button"
                  onClick={handleNextMember}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#334155",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="Chuyển sang nhân sự kế tiếp"
                >
                  Sau <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* FLOATING DROPDOWN MENU (Hiển thị toàn bộ thành viên khi nhấp) */}
            {isMemberDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  width: "100%",
                  maxWidth: 640,
                  background: "#ffffff",
                  borderRadius: 16,
                  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
                  border: "1.5px solid #cbd5e1",
                  zIndex: 1050,
                  overflow: "hidden",
                  animation: "fadeInDown 0.15s ease",
                }}
              >
                {/* Clean Header in Dropdown */}
                <div
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #f1f5f9",
                    background: "#f8fafc",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "#475569",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Toàn bộ thành viên ({members.length})</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Nhấp chọn để đánh giá</span>
                </div>

                {/* List of Members */}
                <div
                  style={{
                    maxHeight: 340,
                    overflowY: "auto",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {members.map((m) => {
                      const isSelected = m.id === selectedMemberId;
                      const st = calculateMemberStats(m.scores);
                      const tier = getRankTier(st.overallAvg);
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMemberId(m.id);
                            setIsMemberDropdownOpen(false);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "8px 12px",
                            borderRadius: 10,
                            cursor: "pointer",
                            border: isSelected ? "1.5px solid #2563eb" : "1px solid transparent",
                            background: isSelected ? "#eff6ff" : "transparent",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "#f8fafc";
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          {/* Left: Avatar + Name + Dept */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <img
                              src={m.avatar}
                              alt={m.name}
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: `2px solid ${tier.color}`,
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ minWidth: 0, textAlign: "left" }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: isSelected ? "#1d4ed8" : "#0f172a",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {m.name}
                              </div>
                              <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {m.role} • {m.department}
                              </div>
                            </div>
                          </div>

                          {/* Right: Score + Rank Stamp + Checkmark */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#059669" }}>
                              {st.overallAvg.toFixed(1)}/10
                            </span>

                            <div
                              style={{
                                padding: "2px 6px",
                                borderRadius: 6,
                                background: tier.bg,
                                border: `1px solid ${tier.border}`,
                                color: tier.textColor,
                                fontWeight: 900,
                                fontSize: 11,
                                fontFamily: "Impact, sans-serif",
                              }}
                            >
                              {tier.rank}
                            </div>

                            {isSelected && <Check size={16} color="#2563eb" style={{ flexShrink: 0 }} />}
                          </div>
                        </div>
                      );
                  })}
                </div>

                {/* Footer hint */}
                <div
                  style={{
                    padding: "8px 14px",
                    borderTop: "1px solid #f1f5f9",
                    background: "#f8fafc",
                    fontSize: 11,
                    color: "#64748b",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Tổng số: {members.length} nhân sự</span>
                  <span style={{ color: "#2563eb", fontWeight: 700 }}>Chọn để đổi bảng điểm</span>
                </div>
              </div>
            )}
          </div>

          {/* Main 2-Column / 1-Column Responsive Grid: Radar Chart + 18 Criteria */}
          <div className="scorecard-grid">
            {/* LEFT COLUMN: MEMBER PROFILE & BLUE LOCK RADAR CHART */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: 20,
                padding: "20px 16px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {/* Member Profile Header */}
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  paddingBottom: 14,
                  borderBottom: "1px solid #f1f5f9",
                  marginBottom: 14,
                }}
              >
                <img
                  src={currentMember.avatar}
                  alt={currentMember.name}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: `3px solid ${currentTier.color}`,
                    boxShadow: `0 4px 10px ${currentTier.glow}`,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8" }}>
                      {currentMember.id}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 8,
                        background: "#e2e8f0",
                        color: "#334155",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                      }}
                    >
                      {currentMember.department}
                    </span>
                  </div>
                  <h2 style={{ margin: "0 0 2px 0", fontSize: 17, fontWeight: 900, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {currentMember.name}
                  </h2>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>
                    {currentMember.role}
                  </div>
                </div>

                {/* Overall Big Rank Stamp */}
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 12,
                    background: currentTier.bg,
                    border: `2px solid ${currentTier.border}`,
                    textAlign: "center",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      fontFamily: "Impact, sans-serif",
                      color: currentTier.color,
                      lineHeight: 1,
                    }}
                  >
                    {currentTier.rank}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: currentTier.textColor, marginTop: 2 }}>
                    OVR {currentStats.overallAvg}
                  </div>
                </div>
              </div>

              {/* TRIANGLE RADAR CHART (BLUE LOCK STYLE) */}
              <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <TriangleRadarChart
                  group1Score={currentStats.group1.avg}
                  group2Score={currentStats.group2.avg}
                  group3Score={currentStats.group3.avg}
                  memberName={currentMember.name}
                  role={currentMember.role}
                  size={460}
                  activeGroup={activeGroupFilter}
                  onGroupClick={(gid) => setActiveGroupFilter(activeGroupFilter === gid ? null : gid)}
                />
              </div>

              {/* Group Quick Stat Cards */}
              <div
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                  marginTop: 16,
                  boxSizing: "border-box",
                }}
              >
                {/* Group 1 */}
                <div
                  onClick={() => setActiveGroupFilter(activeGroupFilter === "group1" ? null : "group1")}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 10,
                    background: activeGroupFilter === "group1" ? "#dbeafe" : "#f8fafc",
                    border: activeGroupFilter === "group1" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: "#1d4ed8" }}>QUẢN LÝ</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", margin: "2px 0" }}>
                    {currentStats.group1.avg}
                  </div>
                  <div style={{ fontSize: 9, color: "#64748b" }}>
                    {currentStats.group1.sum}/60 đ
                  </div>
                </div>

                {/* Group 2 */}
                <div
                  onClick={() => setActiveGroupFilter(activeGroupFilter === "group2" ? null : "group2")}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 10,
                    background: activeGroupFilter === "group2" ? "#d1fae5" : "#f8fafc",
                    border: activeGroupFilter === "group2" ? "2px solid #059669" : "1px solid #e2e8f0",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: "#059669" }}>KỸ THUẬT</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", margin: "2px 0" }}>
                    {currentStats.group2.avg}
                  </div>
                  <div style={{ fontSize: 9, color: "#64748b" }}>
                    {currentStats.group2.sum}/60 đ
                  </div>
                </div>

                {/* Group 3 */}
                <div
                  onClick={() => setActiveGroupFilter(activeGroupFilter === "group3" ? null : "group3")}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 10,
                    background: activeGroupFilter === "group3" ? "#ede9fe" : "#f8fafc",
                    border: activeGroupFilter === "group3" ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: "#7c3aed" }}>RESEARCH</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", margin: "2px 0" }}>
                    {currentStats.group3.avg}
                  </div>
                  <div style={{ fontSize: 9, color: "#64748b" }}>
                    {currentStats.group3.sum}/60 đ
                  </div>
                </div>
              </div>

              {/* Total Summary Row */}
              <div
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: "#334155",
                  boxSizing: "border-box",
                }}
              >
                <span>Tổng 18 tiêu chí:</span>
                <span style={{ fontSize: 13.5, fontWeight: 900, color: "#0f172a" }}>
                  {currentStats.total} / 180 điểm
                </span>
              </div>

              {/* Member qualitative notes & desired direction */}
              <div
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: "#fdf8f6",
                  border: "1px solid #fee2e2",
                  fontSize: 11.5,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontWeight: 800, color: "#9a3412", marginBottom: 3 }}>
                  📌 Hướng phát triển mong muốn:
                </div>
                <div style={{ color: "#475569", marginBottom: 8, lineHeight: 1.4 }}>
                  {currentMember.desiredDirection || "Chưa cập nhật"}
                </div>

                <div style={{ fontWeight: 800, color: "#065f46", marginBottom: 3 }}>
                  🔍 Bằng chứng / Nhận xét quan sát được:
                </div>
                <div style={{ color: "#475569", lineHeight: 1.4 }}>
                  {currentMember.evidenceNotes || "Chưa có ghi chú"}
                </div>

                <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed #cbd5e1", fontSize: 10.5, color: "#64748b" }}>
                  <strong>Mức độ cam kết:</strong> {currentMember.commitmentLevel || "Đang xác nhận"}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: 18 CRITERIA BREAKDOWN WITH ACCORDIONS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
              {/* Informative Guidance Banner */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "12px 16px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <HelpCircle size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#334155" }}>
                    <strong>Thang điểm chuẩn:</strong> 1–3: Cần hướng dẫn • 4–6: Có nền tảng • 7–8: Độc lập • 9–10: Dẫn dắt
                  </span>
                </div>
                {activeGroupFilter && (
                  <button
                    onClick={() => setActiveGroupFilter(null)}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#ef4444",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Bỏ lọc nhóm (Hiện tất cả)
                  </button>
                )}
              </div>

              {/* RENDER 3 GROUPS */}
              {COMPETENCY_GROUPS.map((group) => {
                // If filter is active and this group is not selected, skip
                if (activeGroupFilter && activeGroupFilter !== group.id) {
                  return null;
                }

                const groupStat =
                  group.id === "group1"
                    ? currentStats.group1
                    : group.id === "group2"
                    ? currentStats.group2
                    : currentStats.group3;
                const groupTier = getRankTier(groupStat.avg);

                return (
                  <div
                    key={group.id}
                    style={{
                      background: "#ffffff",
                      borderRadius: 16,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                      border: `1px solid ${group.borderColor}`,
                      overflow: "hidden",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Group Header */}
                    <div
                      style={{
                        padding: "14px 18px",
                        background: group.bgColor,
                        borderBottom: `1px solid ${group.borderColor}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 10,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              background: group.color,
                              color: "#ffffff",
                              padding: "2px 7px",
                              borderRadius: 6,
                            }}
                          >
                            {group.code}
                          </span>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: 14.5,
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            {group.name}
                          </h3>
                        </div>
                        <p style={{ margin: "4px 0 0 0", fontSize: 11, color: "#64748b" }}>
                          {group.description}
                        </p>
                      </div>

                      {/* Group Total & Rank Badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 10.5, color: "#64748b" }}>TB Nhóm</div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: group.color }}>
                            {groupStat.avg} <span style={{ fontSize: 10.5, color: "#94a3b8" }}>/ 10</span>
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "3px 10px",
                            borderRadius: 8,
                            background: groupTier.bg,
                            border: `1px solid ${groupTier.border}`,
                            color: groupTier.textColor,
                            fontWeight: 900,
                            fontSize: 16,
                            fontFamily: "Impact, sans-serif",
                          }}
                        >
                          {groupTier.rank}
                        </div>
                      </div>
                    </div>

                    {/* Criteria List */}
                    <div style={{ padding: "10px 18px" }}>
                      {group.criteria.map((crit, idx) => {
                        const score = currentMember.scores[crit.id] || 0;
                        const critTier = getRankTier(score);

                        return (
                          <div
                            key={crit.id}
                            style={{
                              padding: "10px 0",
                              borderBottom: idx < group.criteria.length - 1 ? "1px solid #f1f5f9" : "none",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 4,
                                gap: 10,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      fontWeight: 800,
                                      color: "#64748b",
                                      background: "#f1f5f9",
                                      padding: "1px 5px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {crit.code}
                                  </span>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b" }}>
                                    {crit.name}
                                  </span>
                                </div>
                                <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 2 }}>
                                  {crit.desc}
                                </div>
                              </div>

                              {/* Numeric score display badge */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 6,
                                    background: critTier.bg,
                                    color: critTier.textColor,
                                  }}
                                >
                                  {critTier.title.split(" ")[0]}
                                </span>

                                <div
                                  onClick={() => !isGradingMode && setIsGradingMode(true)}
                                  style={{
                                    minWidth: 42,
                                    textAlign: "center",
                                    fontSize: 13.5,
                                    fontWeight: 900,
                                    color: score > 0 ? group.color : "#94a3b8",
                                    background: `${group.color}15`,
                                    border: `1px solid ${group.color}35`,
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    cursor: isGradingMode ? "default" : "pointer",
                                    userSelect: "none",
                                    transition: "all 0.15s ease",
                                  }}
                                  title={isGradingMode ? "Điểm hiện tại" : "Nhấp để mở chế độ chấm điểm"}
                                >
                                  {score > 0 ? `${score} / 10` : "-- / 10"}
                                </div>
                              </div>
                            </div>

                            {/* KHUNG GHI SỐ TRỰC TIẾP & BỘ ĐIỀU KHIỂN CHẤM ĐIỂM (Bấm số bàn phím, tự động bôi đen) */}
                            {isGradingMode ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>
                                  Chấm điểm:
                                </span>

                                {/* Nút Giảm 0.5 điểm */}
                                <button
                                  type="button"
                                  onClick={() => handleScoreChange(crit.id, Math.max(0, Math.round(((Number(score) || 0) - 0.5) * 10) / 10))}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 7,
                                    border: "1.5px solid #cbd5e1",
                                    background: "#ffffff",
                                    color: "#334155",
                                    fontWeight: 900,
                                    fontSize: 17,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    userSelect: "none",
                                    flexShrink: 0,
                                    transition: "all 0.15s ease",
                                  }}
                                  title="Giảm 0.5 điểm"
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = group.color; e.currentTarget.style.background = "#f8fafc"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#ffffff"; }}
                                >
                                  −
                                </button>

                                {/* Ô GHI SỐ TRỰC TIẾP (Bấm vào để ghi bất kỳ số nào 0 - 10, tự động bôi đen) */}
                                <div
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                    background: "#ffffff",
                                    border: `2px solid ${group.color}`,
                                    borderRadius: 8,
                                    padding: "2px 8px",
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                                    flexShrink: 0,
                                  }}
                                >
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={score === "" ? "" : score}
                                    onFocus={(e) => e.target.select()}
                                    onClick={(e) => e.target.select()}
                                    onKeyDown={(e) => {
                                      if ((e.key === "Backspace" || e.key === "Delete") && (score === 0 || score === "0" || score === "")) {
                                        e.preventDefault();
                                        handleScoreChange(crit.id, "");
                                      }
                                    }}
                                    onChange={(e) => handleScoreChange(crit.id, e.target.value)}
                                    onBlur={() => {
                                      if (score === "" || score === null || isNaN(Number(score))) {
                                        handleScoreChange(crit.id, 0);
                                      }
                                    }}
                                    placeholder=""
                                    style={{
                                      width: 44,
                                      height: 26,
                                      border: "none",
                                      outline: "none",
                                      textAlign: "center",
                                      fontSize: 15,
                                      fontWeight: 900,
                                      color: group.color,
                                      background: "transparent",
                                      padding: 0,
                                    }}
                                    title="Xóa 1 lần là sạch ô, gõ số điểm từ 0 đến 10"
                                  />
                                  <span style={{ fontSize: 11, fontWeight: 800, color: "#64748b" }}>/ 10</span>
                                </div>

                                {/* Nút Tăng 0.5 điểm */}
                                <button
                                  type="button"
                                  onClick={() => handleScoreChange(crit.id, Math.min(10, Math.round(((Number(score) || 0) + 0.5) * 10) / 10))}
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 7,
                                    border: "1.5px solid #cbd5e1",
                                    background: "#ffffff",
                                    color: "#334155",
                                    fontWeight: 900,
                                    fontSize: 17,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    userSelect: "none",
                                    flexShrink: 0,
                                    transition: "all 0.15s ease",
                                  }}
                                  title="Tăng 0.5 điểm"
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = group.color; e.currentTarget.style.background = "#f8fafc"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#ffffff"; }}
                                >
                                  +
                                </button>

                                {/* Thanh hiển thị mức điểm trực quan */}
                                <div
                                  style={{
                                    flex: 1,
                                    minWidth: 80,
                                    height: 8,
                                    borderRadius: 4,
                                    background: "#f1f5f9",
                                    overflow: "hidden",
                                    position: "relative",
                                    marginLeft: 4,
                                  }}
                                  title={`Điểm số: ${score || 0}/10`}
                                >
                                  <div
                                    style={{
                                      width: `${Math.min(100, Math.max(0, ((Number(score) || 0) / 10) * 100))}%`,
                                      height: "100%",
                                      background:
                                        (Number(score) || 0) >= 8
                                          ? "linear-gradient(90deg, #10b981, #059669)"
                                          : (Number(score) || 0) >= 6
                                          ? "linear-gradient(90deg, #3b82f6, #2563eb)"
                                          : (Number(score) || 0) >= 4
                                          ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                          : "linear-gradient(90deg, #ef4444, #dc2626)",
                                      borderRadius: 4,
                                      transition: "width 0.2s ease",
                                    }}
                                  />
                                </div>
                              </div>
                                                        ) : (
                              <div
                                style={{
                                  height: 5,
                                  borderRadius: 3,
                                  background: "#f1f5f9",
                                  overflow: "hidden",
                                  position: "relative",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${(score / 10) * 100}%`,
                                    height: "100%",
                                    background:
                                      score >= 8
                                        ? "linear-gradient(90deg, #10b981, #059669)"
                                        : score >= 6
                                        ? "linear-gradient(90deg, #3b82f6, #2563eb)"
                                        : score >= 4
                                        ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                        : "linear-gradient(90deg, #ef4444, #dc2626)",
                                    borderRadius: 3,
                                    transition: "width 0.25s ease",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: HEAD-TO-HEAD COMPARE MODE (SO SÁNH ĐỐI ĐẦU)        */}
      {/* ======================================================== */}
      {viewMode === "compare" && (
        <div style={{ background: "#ffffff", borderRadius: 20, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.05)", width: "100%", boxSizing: "border-box" }}>
          <div style={{ marginBottom: 16, textAlign: "center" }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: "0 0 4px 0" }}>
              SO SÁNH NĂNG LỰC ĐỐI ĐẦU TRÊN CÙNG BIỂU ĐỒ TAM GIÁC
            </h2>
            <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>
              Chọn 2 thành viên để so sánh năng lực trên biểu đồ tam giác radar lồng ghép.
            </p>
          </div>

          {/* Member A & Member B Selectors */}
          <div className="scorecard-compare-selectors">
            {/* Member A Selector */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "2px solid #2563eb",
                background: "#eff6ff",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <img
                src={currentMember.avatar}
                alt={currentMember.name}
                style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid #2563eb" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#1d4ed8" }}>THÀNH VIÊN A (XANH DƯƠNG)</div>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid #bfdbfe",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#1e293b",
                    marginTop: 3,
                  }}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Impact", color: "#2563eb" }}>
                  {currentTier.rank}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#1e40af" }}>{currentStats.overallAvg}/10</div>
              </div>
            </div>

            {/* VS Badge */}
            <div style={{ textAlign: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: "#0f172a",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "1px",
                }}
              >
                VS
              </span>
            </div>

            {/* Member B Selector */}
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "2px solid #ea580c",
                background: "#fff7ed",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <img
                src={compareMember.avatar}
                alt={compareMember.name}
                style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid #ea580c" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#ea580c" }}>THÀNH VIÊN B (CAM NÉT ĐỨT)</div>
                <select
                  value={compareMemberId}
                  onChange={(e) => setCompareMemberId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: 6,
                    border: "1px solid #fed7aa",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#1e293b",
                    marginTop: 3,
                  }}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "Impact", color: "#ea580c" }}>
                  {compareTier.rank}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#c2410c" }}>{compareStats.overallAvg}/10</div>
              </div>
            </div>
          </div>

          {/* Overlaid Radar Chart & Stat Comparison Table */}
          <div className="scorecard-compare-grid">
            {/* The Overlaid Triangle Radar Chart */}
            <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
              <TriangleRadarChart
                group1Score={currentStats.group1.avg}
                group2Score={currentStats.group2.avg}
                group3Score={currentStats.group3.avg}
                compareData={{
                  group1Score: compareStats.group1.avg,
                  group2Score: compareStats.group2.avg,
                  group3Score: compareStats.group3.avg,
                  name: compareMember.name,
                }}
                size={460}
              />
            </div>

            {/* Comparison Table */}
            <div style={{ width: "100%", overflowX: "auto" }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: "#1e293b", marginBottom: 10 }}>
                Bảng So Sánh Chỉ Số Chi Tiết
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "9px 10px", textAlign: "left", color: "#475569" }}>Trụ Cột Năng Lực</th>
                    <th style={{ padding: "9px 10px", textAlign: "center", color: "#1d4ed8" }}>{currentMember.name}</th>
                    <th style={{ padding: "9px 10px", textAlign: "center", color: "#ea580c" }}>{compareMember.name}</th>
                    <th style={{ padding: "9px 10px", textAlign: "right", color: "#475569" }}>Chênh lệch (Δ)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Nhóm 1 */}
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: "#1e3a8a" }}>
                      1. Quản Lý & Đối Ngoại
                    </td>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#1d4ed8" }}>
                      {currentStats.group1.avg} ({getRankTier(currentStats.group1.avg).rank})
                    </td>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#ea580c" }}>
                      {compareStats.group1.avg} ({getRankTier(compareStats.group1.avg).rank})
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontWeight: 800 }}>
                      {(() => {
                        const diff = (currentStats.group1.avg - compareStats.group1.avg).toFixed(1);
                        const isPlus = Number(diff) > 0;
                        return (
                          <span style={{ color: isPlus ? "#10b981" : Number(diff) < 0 ? "#ef4444" : "#64748b" }}>
                            {isPlus ? `+${diff}` : diff}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* Nhóm 2 */}
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: "#065f46" }}>
                      2. Kỹ Thuật & Hệ Thống
                    </td>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#1d4ed8" }}>
                      {currentStats.group2.avg} ({getRankTier(currentStats.group2.avg).rank})
                    </td>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#ea580c" }}>
                      {compareStats.group2.avg} ({getRankTier(compareStats.group2.avg).rank})
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontWeight: 800 }}>
                      {(() => {
                        const diff = (currentStats.group2.avg - compareStats.group2.avg).toFixed(1);
                        const isPlus = Number(diff) > 0;
                        return (
                          <span style={{ color: isPlus ? "#10b981" : Number(diff) < 0 ? "#ef4444" : "#64748b" }}>
                            {isPlus ? `+${diff}` : diff}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* Nhóm 3 */}
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px", fontWeight: 700, color: "#581c87" }}>
                      3. Research & AI
                    </td>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#1d4ed8" }}>
                      {currentStats.group3.avg} ({getRankTier(currentStats.group3.avg).rank})
                    </td>
                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: "#ea580c" }}>
                      {compareStats.group3.avg} ({getRankTier(compareStats.group3.avg).rank})
                    </td>
                    <td style={{ padding: "10px", textAlign: "right", fontWeight: 800 }}>
                      {(() => {
                        const diff = (currentStats.group3.avg - compareStats.group3.avg).toFixed(1);
                        const isPlus = Number(diff) > 0;
                        return (
                          <span style={{ color: isPlus ? "#10b981" : Number(diff) < 0 ? "#ef4444" : "#64748b" }}>
                            {isPlus ? `+${diff}` : diff}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>

                  {/* OVERALL ROW */}
                  <tr style={{ background: "#f8fafc", fontWeight: 900 }}>
                    <td style={{ padding: "12px 10px", color: "#0f172a" }}>TỔNG QUAN (OVERALL)</td>
                    <td style={{ padding: "12px 10px", textAlign: "center", color: "#1d4ed8", fontSize: 14 }}>
                      {currentStats.overallAvg} (Hạng {currentTier.rank})
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "center", color: "#ea580c", fontSize: 14 }}>
                      {compareStats.overallAvg} (Hạng {compareTier.rank})
                    </td>
                    <td style={{ padding: "12px 10px", textAlign: "right", fontSize: 13.5 }}>
                      {(() => {
                        const diff = (currentStats.overallAvg - compareStats.overallAvg).toFixed(1);
                        const isPlus = Number(diff) > 0;
                        return (
                          <span style={{ color: isPlus ? "#10b981" : Number(diff) < 0 ? "#ef4444" : "#64748b" }}>
                            {isPlus ? `+${diff}` : diff}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: "#f1f5f9", fontSize: 11.5, color: "#475569" }}>
                💡 <strong>Nhận định chuyên môn:</strong>{" "}
                {currentStats.overallAvg > compareStats.overallAvg
                  ? `${currentMember.name} có tổng thể năng lực dẫn trước ${compareMember.name} (+${(currentStats.overallAvg - compareStats.overallAvg).toFixed(1)} điểm), đặc biệt mạnh ở ${currentStats.group3.avg >= currentStats.group2.avg && currentStats.group3.avg >= currentStats.group1.avg ? "Nghiên cứu & Học thuật" : currentStats.group2.avg >= currentStats.group1.avg ? "Kỹ thuật & Hệ thống" : "Quản lý & Đối ngoại"}.`
                  : `${compareMember.name} có điểm tổng thể nhỉnh hơn ${currentMember.name} (+${(compareStats.overallAvg - currentStats.overallAvg).toFixed(1)} điểm).`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default CompetencyScorecardPage;
