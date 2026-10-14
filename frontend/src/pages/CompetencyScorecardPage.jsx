import React, { useState, useMemo, useEffect } from "react";
import {
  COMPETENCY_GROUPS,
  INITIAL_MEMBERS,
  calculateMemberStats,
} from "../constants/competencyData";
import { TriangleRadarChart, getRankTier } from "../components/TriangleRadarChart";
import {
  Award,
  Search,
  Filter,
  Users,
  TrendingUp,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Share2,
  RefreshCw,
  Eye,
  GitCompare,
  Sparkles,
  Shield,
  Briefcase,
  Target,
  ArrowRight,
  UserCheck
} from "lucide-react";

export function CompetencyScorecardPage() {
  // Members state (persisted to localStorage)
  const [members, setMembers] = useState(() => {
    try {
      const saved = localStorage.getItem("lab_competency_members");
      return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  // Selected member for scorecard
  const [selectedMemberId, setSelectedMemberId] = useState("TV01");
  // Comparison member for head-to-head mode
  const [compareMemberId, setCompareMemberId] = useState("TV02");

  // View modes: "scorecard" | "compare" | "matrix"
  const [viewMode, setViewMode] = useState("scorecard");

  // Grading / Edit mode state
  const [isGradingMode, setIsGradingMode] = useState(false);

  // Active highlighted group on radar ("group1" | "group2" | "group3" | null)
  const [activeGroupFilter, setActiveGroupFilter] = useState(null);

  // Search & filter
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Save changes to localStorage
  const saveMembers = (newMembers) => {
    setMembers(newMembers);
    try {
      localStorage.setItem("lab_competency_members", JSON.stringify(newMembers));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
    }
  };

  // Reset to original PDF default
  const handleResetData = () => {
    if (window.confirm("Bạn có chắc chắn muốn đặt lại toàn bộ điểm về dữ liệu gốc từ tài liệu PDF không?")) {
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

  // Handle score edit for current member
  const handleScoreChange = (criterionId, val) => {
    const num = Math.min(10, Math.max(0, parseInt(val, 10) || 0));
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
        m.roleLevel.toLowerCase() === roleFilter.toLowerCase();
      return matchSearch && matchRole;
    });
  }, [members, searchTerm, roleFilter]);

  // CSV Export for Full Matrix
  const handleExportCSV = () => {
    const headers = [
      "Mã TV",
      "Họ tên",
      "Vai trò / Cấp độ",
      "Nhóm 1 (Tổng 60)",
      "TB Nhóm 1",
      "Nhóm 2 (Tổng 60)",
      "TB Nhóm 2",
      "Nhóm 3 (Tổng 60)",
      "TB Nhóm 3",
      "Tổng điểm (180)",
      "TB Toàn Bộ (1-10)",
      "Xếp Hạng",
      "Bằng chứng / Nhận xét",
      "Hướng phát triển mong muốn",
      "Mức độ cam kết"
    ];

    const rows = members.map((m) => {
      const st = calculateMemberStats(m.scores);
      const tier = getRankTier(st.overallAvg);
      return [
        `"${m.id}"`,
        `"${m.name}"`,
        `"${m.role}"`,
        st.group1.sum,
        st.group1.avg,
        st.group2.sum,
        st.group2.avg,
        st.group3.sum,
        st.group3.avg,
        st.total,
        st.overallAvg,
        `"${tier.rank} - ${tier.title}"`,
        `"${m.evidenceNotes || ""}"`,
        `"${m.desiredDirection || ""}"`,
        `"${m.commitmentLevel || ""}"`
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Bang_Diem_Danh_Gia_Nang_Luc_Lab_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 16px" }}>
      {/* 1. HERO HEADER */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #1e293b 100%)",
          borderRadius: 20,
          padding: "24px 28px",
          color: "#ffffff",
          marginBottom: 24,
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
            position: "absolute",
            bottom: -60,
            left: 200,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            position: "relative",
            zIndex: 1,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
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
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  color: "#c4b5fd",
                }}
              >
                <Award size={14} color="#a78bfa" />
                BLUE LOCK RADAR MATRIX
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>
                3 Nhóm Năng Lực Chuẩn Lab • 18 Tiêu Chí Đánh Giá
              </span>
            </div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "-0.5px",
                margin: "0 0 6px 0",
                textShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              BẢNG ĐIỂM ĐÁNH GIÁ NĂNG LỰC THÀNH VIÊN
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1", maxWidth: 680 }}>
              Biểu đồ radar tam giác phản ánh 3 trụ cột cốt lõi: <strong>Quản Lý Dự Án & Đối Ngoại</strong> (Đỉnh trên), <strong>Kỹ Thuật & Hệ Thống</strong> (Góc phải) và <strong>Research & AI</strong> (Góc trái).
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => setIsGradingMode(!isGradingMode)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 16px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: isGradingMode ? "#eab308" : "rgba(255, 255, 255, 0.12)",
                color: isGradingMode ? "#0f172a" : "#ffffff",
                border: isGradingMode ? "none" : "1px solid rgba(255, 255, 255, 0.2)",
                transition: "all 0.2s ease",
              }}
            >
              <Sliders size={15} />
              {isGradingMode ? "Đang bật chấm điểm" : "Chế độ chấm điểm"}
            </button>
            <button
              onClick={handleExportCSV}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 16px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                background: "rgba(255, 255, 255, 0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                transition: "all 0.2s ease",
              }}
            >
              <Download size={15} />
              Xuất CSV
            </button>
          </div>
        </div>

        {/* View Mode Navigation Tabs */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 20,
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            paddingTop: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => setViewMode("scorecard")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              background: viewMode === "scorecard" ? "#ffffff" : "transparent",
              color: viewMode === "scorecard" ? "#0f172a" : "#cbd5e1",
              border: "none",
              transition: "all 0.2s ease",
            }}
          >
            <Award size={15} color={viewMode === "scorecard" ? "#7c3aed" : "currentColor"} />
            Thẻ Điểm Cá Nhân (Blue Lock)
          </button>
          <button
            onClick={() => setViewMode("compare")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              background: viewMode === "compare" ? "#ffffff" : "transparent",
              color: viewMode === "compare" ? "#0f172a" : "#cbd5e1",
              border: "none",
              transition: "all 0.2s ease",
            }}
          >
            <GitCompare size={15} color={viewMode === "compare" ? "#f97316" : "currentColor"} />
            So Sánh Đối Đầu (2 Thành Viên)
          </button>
          <button
            onClick={() => setViewMode("matrix")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              background: viewMode === "matrix" ? "#ffffff" : "transparent",
              color: viewMode === "matrix" ? "#0f172a" : "#cbd5e1",
              border: "none",
              transition: "all 0.2s ease",
            }}
          >
            <FileText size={15} color={viewMode === "matrix" ? "#059669" : "currentColor"} />
            Bảng Ma Trận Toàn Bộ Lab (16 TV)
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* VIEW 1: SCORECARD VIEW (THẺ ĐIỂM CÁ NHÂN BLUE LOCK)       */}
      {/* ======================================================== */}
      {viewMode === "scorecard" && (
        <div>
          {/* Member Roster Filter Row */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Users size={18} color="#475569" />
                <span style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>
                  Danh Sách Thành Viên Lab ({members.length})
                </span>
              </div>

              {/* Search & Role Filters */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <Search
                    size={14}
                    color="#94a3b8"
                    style={{ position: "absolute", left: 10, top: 10 }}
                  />
                  <input
                    type="text"
                    placeholder="Tìm tên hoặc mã TV..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      padding: "7px 12px 7px 32px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 12.5,
                      width: 190,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  {[
                    { id: "all", label: "Tất cả" },
                    { id: "lead", label: "Lead" },
                    { id: "core", label: "Core" },
                    { id: "contributor", label: "Contributor" },
                    { id: "learning", label: "Learning" },
                  ].map((rf) => (
                    <button
                      key={rf.id}
                      onClick={() => setRoleFilter(rf.id)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: "pointer",
                        border: "none",
                        background: roleFilter === rf.id ? "#1e293b" : "#f1f5f9",
                        color: roleFilter === rf.id ? "#ffffff" : "#475569",
                      }}
                    >
                      {rf.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Member Horizontal Scroll Pills */}
            <div
              style={{
                display: "flex",
                gap: 10,
                overflowX: "auto",
                paddingBottom: 6,
              }}
            >
              {filteredMembers.map((m) => {
                const isSelected = m.id === selectedMemberId;
                const st = calculateMemberStats(m.scores);
                const tier = getRankTier(st.overallAvg);
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 14px",
                      borderRadius: 12,
                      cursor: "pointer",
                      border: isSelected ? "2px solid #2563eb" : "1px solid #e2e8f0",
                      background: isSelected ? "#eff6ff" : "#f8fafc",
                      transition: "all 0.2s ease",
                      boxShadow: isSelected ? "0 4px 12px rgba(37, 99, 235, 0.15)" : "none",
                    }}
                  >
                    <img
                      src={m.avatar}
                      alt={m.name}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: `2px solid ${tier.color}`,
                      }}
                    />
                    <div style={{ textAlign: "left" }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 800,
                          color: isSelected ? "#1d4ed8" : "#1e293b",
                        }}
                      >
                        {m.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#64748b" }}>{m.role}</div>
                    </div>
                    {/* Rank letter stamp */}
                    <div
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: tier.bg,
                        border: `1px solid ${tier.border}`,
                        color: tier.textColor,
                        fontWeight: 900,
                        fontSize: 12,
                        fontFamily: "Impact, sans-serif",
                      }}
                    >
                      {tier.rank}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main 2-Column Grid: Radar Chart + 18 Criteria */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(340px, 480px) 1fr",
              gap: 24,
              alignItems: "start",
            }}
            className="scorecard-grid"
          >
            {/* LEFT COLUMN: MEMBER PROFILE & BLUE LOCK RADAR CHART */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: 20,
                padding: "24px 20px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
                border: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Member Profile Header */}
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  paddingBottom: 16,
                  borderBottom: "1px solid #f1f5f9",
                  marginBottom: 16,
                }}
              >
                <img
                  src={currentMember.avatar}
                  alt={currentMember.name}
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: `3px solid ${currentTier.color}`,
                    boxShadow: `0 4px 12px ${currentTier.glow}`,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
                      {currentMember.id}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "#e2e8f0",
                        color: "#334155",
                      }}
                    >
                      {currentMember.department}
                    </span>
                  </div>
                  <h2 style={{ margin: "0 0 4px 0", fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
                    {currentMember.name}
                  </h2>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2563eb" }}>
                    {currentMember.role}
                  </div>
                </div>

                {/* Overall Big Rank Stamp */}
                <div
                  style={{
                    padding: "6px 14px",
                    borderRadius: 12,
                    background: currentTier.bg,
                    border: `2px solid ${currentTier.border}`,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 28,
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
              <TriangleRadarChart
                group1Score={currentStats.group1.avg}
                group2Score={currentStats.group2.avg}
                group3Score={currentStats.group3.avg}
                memberName={currentMember.name}
                role={currentMember.role}
                size={420}
                activeGroup={activeGroupFilter}
                onGroupClick={(gid) => setActiveGroupFilter(activeGroupFilter === gid ? null : gid)}
              />

              {/* Group Quick Stat Cards */}
              <div
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 10,
                  marginTop: 20,
                }}
              >
                {/* Group 1 */}
                <div
                  onClick={() => setActiveGroupFilter(activeGroupFilter === "group1" ? null : "group1")}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 12,
                    background: activeGroupFilter === "group1" ? "#dbeafe" : "#f8fafc",
                    border: activeGroupFilter === "group1" ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#1d4ed8" }}>QUẢN LÝ</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#1e293b", margin: "2px 0" }}>
                    {currentStats.group1.avg}
                  </div>
                  <div style={{ fontSize: 9.5, color: "#64748b" }}>
                    {currentStats.group1.sum}/60 điểm
                  </div>
                </div>

                {/* Group 2 */}
                <div
                  onClick={() => setActiveGroupFilter(activeGroupFilter === "group2" ? null : "group2")}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 12,
                    background: activeGroupFilter === "group2" ? "#d1fae5" : "#f8fafc",
                    border: activeGroupFilter === "group2" ? "2px solid #059669" : "1px solid #e2e8f0",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#059669" }}>KỸ THUẬT</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#1e293b", margin: "2px 0" }}>
                    {currentStats.group2.avg}
                  </div>
                  <div style={{ fontSize: 9.5, color: "#64748b" }}>
                    {currentStats.group2.sum}/60 điểm
                  </div>
                </div>

                {/* Group 3 */}
                <div
                  onClick={() => setActiveGroupFilter(activeGroupFilter === "group3" ? null : "group3")}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 12,
                    background: activeGroupFilter === "group3" ? "#ede9fe" : "#f8fafc",
                    border: activeGroupFilter === "group3" ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                    textAlign: "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#7c3aed" }}>RESEARCH</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#1e293b", margin: "2px 0" }}>
                    {currentStats.group3.avg}
                  </div>
                  <div style={{ fontSize: 9.5, color: "#64748b" }}>
                    {currentStats.group3.sum}/60 điểm
                  </div>
                </div>
              </div>

              {/* Total Summary Row */}
              <div
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#334155",
                }}
              >
                <span>Tổng 18 tiêu chí:</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>
                  {currentStats.total} / 180 điểm
                </span>
              </div>

              {/* Member qualitative notes & desired direction */}
              <div
                style={{
                  width: "100%",
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 12,
                  background: "#fdf8f6",
                  border: "1px solid #fee2e2",
                  fontSize: 12,
                }}
              >
                <div style={{ fontWeight: 800, color: "#9a3412", marginBottom: 4 }}>
                  📌 Hướng phát triển mong muốn:
                </div>
                <div style={{ color: "#475569", marginBottom: 10, lineHeight: 1.4 }}>
                  {currentMember.desiredDirection || "Chưa cập nhật"}
                </div>

                <div style={{ fontWeight: 800, color: "#065f46", marginBottom: 4 }}>
                  🔍 Bằng chứng / Nhận xét quan sát được:
                </div>
                <div style={{ color: "#475569", lineHeight: 1.4 }}>
                  {currentMember.evidenceNotes || "Chưa có ghi chú"}
                </div>

                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px dashed #cbd5e1", fontSize: 11, color: "#64748b" }}>
                  <strong>Mức độ cam kết:</strong> {currentMember.commitmentLevel || "Đang xác nhận"}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: 18 CRITERIA BREAKDOWN WITH ACCORDIONS */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Informative Guidance Banner */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 14,
                  padding: "14px 18px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <HelpCircle size={18} color="#2563eb" />
                  <span style={{ fontSize: 12.5, color: "#334155" }}>
                    <strong>Thang điểm chuẩn:</strong> 1–3: Cần hướng dẫn • 4–6: Có nền tảng • 7–8: Độc lập ổn định • 9–10: Dẫn dắt/chuyên sâu
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
                      borderRadius: 18,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
                      border: `1px solid ${group.borderColor}`,
                      overflow: "hidden",
                    }}
                  >
                    {/* Group Header */}
                    <div
                      style={{
                        padding: "16px 20px",
                        background: group.bgColor,
                        borderBottom: `1px solid ${group.borderColor}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              background: group.color,
                              color: "#ffffff",
                              padding: "2px 8px",
                              borderRadius: 6,
                            }}
                          >
                            {group.code}
                          </span>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: 15,
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            {group.name}
                          </h3>
                        </div>
                        <p style={{ margin: "4px 0 0 0", fontSize: 11.5, color: "#64748b" }}>
                          {group.description}
                        </p>
                      </div>

                      {/* Group Total & Rank Badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 11, color: "#64748b" }}>Trung bình nhóm</div>
                          <div style={{ fontSize: 17, fontWeight: 900, color: group.color }}>
                            {groupStat.avg} <span style={{ fontSize: 11, color: "#94a3b8" }}>/ 10</span>
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "4px 12px",
                            borderRadius: 10,
                            background: groupTier.bg,
                            border: `1px solid ${groupTier.border}`,
                            color: groupTier.textColor,
                            fontWeight: 900,
                            fontSize: 18,
                            fontFamily: "Impact, sans-serif",
                          }}
                        >
                          {groupTier.rank}
                        </div>
                      </div>
                    </div>

                    {/* Criteria List */}
                    <div style={{ padding: "12px 20px" }}>
                      {group.criteria.map((crit, idx) => {
                        const score = currentMember.scores[crit.id] || 0;
                        const critTier = getRankTier(score);

                        return (
                          <div
                            key={crit.id}
                            style={{
                              padding: "12px 0",
                              borderBottom: idx < group.criteria.length - 1 ? "1px solid #f1f5f9" : "none",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 6,
                                gap: 10,
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 800,
                                      color: "#64748b",
                                      background: "#f1f5f9",
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {crit.code}
                                  </span>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                                    {crit.name}
                                  </span>
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                  {crit.desc}
                                </div>
                              </div>

                              {/* Numeric score display */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    background: critTier.bg,
                                    color: critTier.textColor,
                                  }}
                                >
                                  {critTier.title.split(" ")[0]}
                                </span>
                                <div
                                  style={{
                                    minWidth: 40,
                                    textAlign: "center",
                                    fontSize: 15,
                                    fontWeight: 900,
                                    color: score > 0 ? "#0f172a" : "#cbd5e1",
                                  }}
                                >
                                  {score > 0 ? `${score}/10` : "--"}
                                </div>
                              </div>
                            </div>

                            {/* Progress bar or Interactive Slider if in Grading Mode */}
                            {isGradingMode ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                                <input
                                  type="range"
                                  min="0"
                                  max="10"
                                  step="1"
                                  value={score}
                                  onChange={(e) => handleScoreChange(crit.id, e.target.value)}
                                  style={{
                                    flex: 1,
                                    accentColor: group.color,
                                    cursor: "pointer",
                                    height: 6,
                                  }}
                                />
                                <span style={{ fontSize: 11, fontWeight: 800, color: group.color, width: 24 }}>
                                  {score}
                                </span>
                              </div>
                            ) : (
                              <div
                                style={{
                                  height: 6,
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
                                    transition: "width 0.3s ease",
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
        <div style={{ background: "#ffffff", borderRadius: 20, padding: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
          <div style={{ marginBottom: 20, textAlign: "center" }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: "0 0 6px 0" }}>
              SO SÁNH NĂNG LỰC ĐỐI ĐẦU TRÊN CÙNG BIỂU ĐỒ TAM GIÁC
            </h2>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Chọn 2 thành viên để so sánh năng lực trên biểu đồ tam giác radar lồng ghép và bảng phân tích chênh lệch.
            </p>
          </div>

          {/* Member A & Member B Selectors */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 1fr",
              alignItems: "center",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* Member A Selector */}
            <div
              style={{
                padding: 16,
                borderRadius: 14,
                border: "2px solid #2563eb",
                background: "#eff6ff",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <img
                src={currentMember.avatar}
                alt={currentMember.name}
                style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #2563eb" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#1d4ed8" }}>THÀNH VIÊN A (MÀU XANH)</div>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #bfdbfe",
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#1e293b",
                    marginTop: 4,
                  }}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Impact", color: "#2563eb" }}>
                  {currentTier.rank}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#1e40af" }}>{currentStats.overallAvg}/10</div>
              </div>
            </div>

            {/* VS Badge */}
            <div style={{ textAlign: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "6px 12px",
                  borderRadius: 20,
                  background: "#0f172a",
                  color: "#ffffff",
                  fontSize: 12,
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
                padding: 16,
                borderRadius: 14,
                border: "2px solid #ea580c",
                background: "#fff7ed",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <img
                src={compareMember.avatar}
                alt={compareMember.name}
                style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "2px solid #ea580c" }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#ea580c" }}>THÀNH VIÊN B (MÀU CAM NÉT ĐỨT)</div>
                <select
                  value={compareMemberId}
                  onChange={(e) => setCompareMemberId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #fed7aa",
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#1e293b",
                    marginTop: 4,
                  }}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "Impact", color: "#ea580c" }}>
                  {compareTier.rank}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#c2410c" }}>{compareStats.overallAvg}/10</div>
              </div>
            </div>
          </div>

          {/* Overlaid Radar Chart & Stat Comparison Table */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 460px) 1fr", gap: 24, alignItems: "center" }}>
            {/* The Overlaid Triangle Radar Chart */}
            <div style={{ display: "flex", justifyContent: "center" }}>
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
                size={440}
              />
            </div>

            {/* Comparison Table */}
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#1e293b", marginBottom: 12 }}>
                Bảng So Sánh Chỉ Số Chi Tiết
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "#475569" }}>Trụ Cột Năng Lực</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", color: "#1d4ed8" }}>{currentMember.name}</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", color: "#ea580c" }}>{compareMember.name}</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", color: "#475569" }}>Chênh lệch (Δ)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Nhóm 1 */}
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "12px", fontWeight: 700, color: "#1e3a8a" }}>
                      1. Quản Lý & Đối Ngoại
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#1d4ed8" }}>
                      {currentStats.group1.avg} ({getRankTier(currentStats.group1.avg).rank})
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#ea580c" }}>
                      {compareStats.group1.avg} ({getRankTier(compareStats.group1.avg).rank})
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 800 }}>
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
                    <td style={{ padding: "12px", fontWeight: 700, color: "#065f46" }}>
                      2. Kỹ Thuật & Hệ Thống
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#1d4ed8" }}>
                      {currentStats.group2.avg} ({getRankTier(currentStats.group2.avg).rank})
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#ea580c" }}>
                      {compareStats.group2.avg} ({getRankTier(compareStats.group2.avg).rank})
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 800 }}>
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
                    <td style={{ padding: "12px", fontWeight: 700, color: "#581c87" }}>
                      3. Research & AI
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#1d4ed8" }}>
                      {currentStats.group3.avg} ({getRankTier(currentStats.group3.avg).rank})
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: 800, color: "#ea580c" }}>
                      {compareStats.group3.avg} ({getRankTier(compareStats.group3.avg).rank})
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", fontWeight: 800 }}>
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
                    <td style={{ padding: "14px 12px", color: "#0f172a" }}>TỔNG QUAN (OVERALL)</td>
                    <td style={{ padding: "14px 12px", textAlign: "center", color: "#1d4ed8", fontSize: 15 }}>
                      {currentStats.overallAvg} (Hạng {currentTier.rank})
                    </td>
                    <td style={{ padding: "14px 12px", textAlign: "center", color: "#ea580c", fontSize: 15 }}>
                      {compareStats.overallAvg} (Hạng {compareTier.rank})
                    </td>
                    <td style={{ padding: "14px 12px", textAlign: "right", fontSize: 14 }}>
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

              <div style={{ marginTop: 20, padding: 14, borderRadius: 12, background: "#f1f5f9", fontSize: 12, color: "#475569" }}>
                💡 <strong>Nhận định chuyên môn:</strong>{" "}
                {currentStats.overallAvg > compareStats.overallAvg
                  ? `${currentMember.name} có tổng thể năng lực dẫn trước ${compareMember.name} (+${(currentStats.overallAvg - compareStats.overallAvg).toFixed(1)} điểm), đặc biệt mạnh ở ${currentStats.group3.avg >= currentStats.group2.avg && currentStats.group3.avg >= currentStats.group1.avg ? "Nghiên cứu & Học thuật" : currentStats.group2.avg >= currentStats.group1.avg ? "Kỹ thuật & Hệ thống" : "Quản lý & Đối ngoại"}.`
                  : `${compareMember.name} có điểm tổng thể nhỉnh hơn ${currentMember.name} (+${(compareStats.overallAvg - currentStats.overallAvg).toFixed(1)} điểm).`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: FULL MATRIX TABLE VIEW (MA TRẬN 16 THÀNH VIÊN)     */}
      {/* ======================================================== */}
      {viewMode === "matrix" && (
        <div style={{ background: "#ffffff", borderRadius: 20, padding: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.05)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: "0 0 4px 0" }}>
                MA TRẬN ĐÁNH GIÁ NĂNG LỰC TOÀN BỘ LAB (TÀI LIỆU CHUẨN)
              </h2>
              <p style={{ fontSize: 12.5, color: "#64748b", margin: 0 }}>
                Dữ liệu đồng bộ từ bảng tổng kết 18 tiêu chí của 16 thành viên • Màu sắc phân cấp trực quan
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleResetData}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#475569",
                }}
              >
                <RefreshCw size={13} />
                Khôi phục gốc PDF
              </button>
              <button
                onClick={handleExportCSV}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: "#059669",
                  color: "#ffffff",
                }}
              >
                <Download size={13} />
                Tải bảng CSV
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#0f172a", color: "#ffffff" }}>
                  <th style={{ padding: "12px 10px", textAlign: "left", borderRadius: "10px 0 0 0" }}>Mã TV</th>
                  <th style={{ padding: "12px 10px", textAlign: "left" }}>Họ Tên</th>
                  <th style={{ padding: "12px 10px", textAlign: "left" }}>Vai Trò Hiện Tại</th>
                  <th style={{ padding: "12px 10px", textAlign: "center", background: "#1e3a8a" }}>
                    Nhóm 1 (Tối đa 60)
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", background: "#1e40af" }}>
                    TB Nhóm 1
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", background: "#065f46" }}>
                    Nhóm 2 (Tối đa 60)
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", background: "#047857" }}>
                    TB Nhóm 2
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", background: "#581c87" }}>
                    Nhóm 3 (Tối đa 60)
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", background: "#6b21a8" }}>
                    TB Nhóm 3
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", background: "#334155" }}>
                    Tổng Điểm (180)
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center", background: "#1e293b" }}>
                    TB Toàn Bộ
                  </th>
                  <th style={{ padding: "12px 10px", textAlign: "center" }}>Hạng</th>
                  <th style={{ padding: "12px 10px", textAlign: "center", borderRadius: "0 10px 0 0" }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => {
                  const st = calculateMemberStats(m.scores);
                  const tier = getRankTier(st.overallAvg);

                  // Helper for heatmap cell background
                  const getScoreBg = (score) => {
                    if (score >= 7.0) return "rgba(16, 185, 129, 0.15)";
                    if (score >= 4.0) return "rgba(245, 158, 11, 0.15)";
                    if (score > 0) return "rgba(239, 68, 68, 0.12)";
                    return "transparent";
                  };

                  return (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <td style={{ padding: "10px", fontWeight: 700, color: "#64748b" }}>{m.id}</td>
                      <td style={{ padding: "10px", fontWeight: 800, color: "#0f172a" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <img
                            src={m.avatar}
                            alt=""
                            style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }}
                          />
                          <span>{m.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px", color: "#475569" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 6,
                            background:
                              m.roleLevel === "Lead"
                                ? "#ede9fe"
                                : m.roleLevel === "Core"
                                ? "#dbeafe"
                                : "#f1f5f9",
                            color:
                              m.roleLevel === "Lead"
                                ? "#6d28d9"
                                : m.roleLevel === "Core"
                                ? "#1d4ed8"
                                : "#475569",
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          {m.role}
                        </span>
                      </td>

                      {/* Nhóm 1 */}
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 700 }}>
                        {st.group1.sum > 0 ? st.group1.sum : "--"}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          textAlign: "center",
                          fontWeight: 800,
                          background: getScoreBg(st.group1.avg),
                          color: st.group1.avg >= 7 ? "#047857" : st.group1.avg >= 4 ? "#b45309" : "#b91c1c",
                        }}
                      >
                        {st.group1.avg > 0 ? st.group1.avg : "--"}
                      </td>

                      {/* Nhóm 2 */}
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 700 }}>
                        {st.group2.sum > 0 ? st.group2.sum : "--"}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          textAlign: "center",
                          fontWeight: 800,
                          background: getScoreBg(st.group2.avg),
                          color: st.group2.avg >= 7 ? "#047857" : st.group2.avg >= 4 ? "#b45309" : "#b91c1c",
                        }}
                      >
                        {st.group2.avg > 0 ? st.group2.avg : "--"}
                      </td>

                      {/* Nhóm 3 */}
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 700 }}>
                        {st.group3.sum > 0 ? st.group3.sum : "--"}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          textAlign: "center",
                          fontWeight: 800,
                          background: getScoreBg(st.group3.avg),
                          color: st.group3.avg >= 7 ? "#047857" : st.group3.avg >= 4 ? "#b45309" : "#b91c1c",
                        }}
                      >
                        {st.group3.avg > 0 ? st.group3.avg : "--"}
                      </td>

                      {/* Grand Total & Average */}
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 800 }}>
                        {st.total > 0 ? st.total : "--"}
                      </td>
                      <td style={{ padding: "10px", textAlign: "center", fontWeight: 900, fontSize: 13, color: "#0f172a" }}>
                        {st.overallAvg > 0 ? st.overallAvg : "--"}
                      </td>

                      {/* Rank Stamp */}
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: tier.bg,
                            border: `1px solid ${tier.border}`,
                            color: tier.textColor,
                            fontWeight: 900,
                            fontSize: 12,
                            fontFamily: "Impact, sans-serif",
                          }}
                        >
                          {tier.rank}
                        </span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: "10px", textAlign: "center" }}>
                        <button
                          onClick={() => {
                            setSelectedMemberId(m.id);
                            setViewMode("scorecard");
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            background: "#eff6ff",
                            color: "#2563eb",
                            border: "1px solid #bfdbfe",
                          }}
                        >
                          <Eye size={12} />
                          Xem thẻ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
export default CompetencyScorecardPage;
