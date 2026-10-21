import React, { useState, useEffect } from "react";
import ProfileModal from "./ProfileModal";
import { MobileConnectModal } from "./MobileConnectModal";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import {
  Award,
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  MessageSquare,
  Users,
  Bell,
  LogOut,
  Mail,
  ShieldCheck,
  Settings,
  History,
  Key,
  Tv,
  Smartphone,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";

const ROLE_LABELS = {
  admin: { label: "Admin (Quản trị viên)", color: "#7c3aed", bg: "#ede9fe" },
  core: { label: "Core (Cốt cán)", color: "#2563eb", bg: "#dbeafe" },
  leader: { label: "Leader (Trưởng nhóm)", color: "#059669", bg: "#d1fae5" },
  contributor: { label: "Contributor (Đóng góp)", color: "#0891b2", bg: "#cffafe" },
  learning: { label: "Learning (Học viên)", color: "#8b5cf6", bg: "#f3e8ff" },
  manager: { label: "Manager (Quản lý)", color: "#2563eb", bg: "#dbeafe" },
  supervisor: { label: "Leader (Trưởng nhóm)", color: "#059669", bg: "#d1fae5" },
  technician: { label: "Contributor (Đóng góp)", color: "#0891b2", bg: "#cffafe" },
  staff: { label: "Contributor (Đóng góp)", color: "#0891b2", bg: "#cffafe" },
  intern: { label: "Learning (Học viên)", color: "#8b5cf6", bg: "#f3e8ff" },
  viewer: { label: "Learning (Học viên)", color: "#8b5cf6", bg: "#f3e8ff" },
};

const TAB_TITLES = {
  schedule: "Lịch Ca Làm Việc",
  tasks: "Quản Lý Nhiệm Vụ",
  cp: "Điểm Đóng Góp (CP)",
  competency: "Bảng Năng Lực Thành Viên",
  notes: "Sổ Tay Ghi Chú",
  feedback: "Hộp Thư Góp Ý",
  staff: "Quản Lý Nhân Sự",
  history: "Nhật Ký Lịch Sử Ca",
  emails: "Nhật Ký Email",
  smtp: "Cài Đặt Email (SMTP)",
  tv: "Màn Hình Kiosk TV",
};

const TAB_ICONS = {
  schedule: Calendar,
  tasks: CheckSquare,
  cp: Sparkles,
  competency: Award,
  notes: FileText,
  feedback: MessageSquare,
  staff: Users,
  history: History,
  emails: Mail,
  smtp: Settings,
  tv: Tv,
};

export function Navbar({ activeTab, setActiveTab, children }) {
  const { user, logout, isAdmin, canManageStaff } = useAuth();
  const { unreadCount, setIsOpen } = useNotifications();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Desktop sidebar collapse state (persisted in localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && menuDrawerOpen) {
        setMenuDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuDrawerOpen]);

  // 1. Menu chính
  const mainNavItems = [
    { id: "schedule", label: "Lịch ca", icon: Calendar, desc: "Lịch làm việc 9 ca & phân ca" },
    { id: "tasks", label: "Nhiệm vụ", icon: CheckSquare, desc: "Công việc, subtask & tiến độ" },
    { id: "cp", label: "Điểm CP", icon: Sparkles, desc: "Điểm đóng góp & Bảng xếp hạng" },
    { id: "competency", label: "Năng lực", icon: Award, desc: "Đánh giá & thang điểm năng lực" },
    { id: "notes", label: "Ghi chú", icon: FileText, desc: "Sổ tay công việc & ca trực" },
    { id: "feedback", label: "Góp ý", icon: MessageSquare, desc: "Hộp thư góp ý & phản hồi" },
  ];

  if (canManageStaff) {
    mainNavItems.push({ id: "staff", label: "Nhân sự", icon: Users, desc: "Danh sách thành viên & tài khoản" });
  }

  // 2. Menu hệ thống & quản trị
  const systemItems = [
    { id: "history", label: "Lịch sử ca", icon: History, desc: "Nhật ký đăng ký, hủy & đổi ca" },
    ...(isAdmin
      ? [
          { id: "emails", label: "Nhật ký Email", icon: Mail, desc: "Danh sách email đã gửi ra ngoài" },
          { id: "smtp", label: "Cài đặt Email (SMTP)", icon: Settings, desc: "Cấu hình máy chủ gửi email" },
        ]
      : []),
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setMenuDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const userRoleMeta = ROLE_LABELS[user?.role] || {
    label: user?.role || "Thành viên",
    color: "#2563eb",
    bg: "#eff6ff",
  };

  const CurrentActiveIcon = TAB_ICONS[activeTab] || Calendar;
  const currentTabTitle = TAB_TITLES[activeTab] || "Quản Lý Công Việc";

  // Reusable Sidebar Menu Content Component
  const renderSidebarContent = (isMobile = false) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
      {/* 1. BRAND HEADER */}
      <div
        style={{
          padding: "16px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f1f5f9",
          flexShrink: 0,
        }}
      >
        <div
          onClick={() => handleSelectTab("schedule")}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minWidth: 0, flex: 1 }}
          title="Về trang chủ Lịch ca"
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "linear-gradient(135deg, #2563eb, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 4px 10px rgba(37, 99, 235, 0.25)",
              flexShrink: 0,
            }}
          >
            <Clock size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px", color: "#0f172a", lineHeight: 1.2 }}>
              WorkShift<span style={{ color: "#2563eb" }}>Pro</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Quản lý 9 Ca & Năng Lực
            </div>
          </div>
        </div>

        {/* Desktop collapse button: hides sidebar to view full width screen */}
        {!isMobile && (
          <button
            onClick={() => setSidebarCollapsed(true)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#eff6ff";
              e.currentTarget.style.color = "#2563eb";
              e.currentTarget.style.borderColor = "#bfdbfe";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f8fafc";
              e.currentTarget.style.color = "#64748b";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}
            title="Thu gọn menu (Xem toàn màn hình Full)"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Mobile close button */}
        {isMobile && (
          <button
            onClick={() => setMenuDrawerOpen(false)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748b",
              flexShrink: 0,
            }}
          >
            <X size={17} />
          </button>
        )}
      </div>

      {/* 2. SCROLLABLE NAVIGATION LIST */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* SECTION 1: CHỨC NĂNG CHÍNH */}
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            padding: "4px 10px 6px",
            letterSpacing: "0.5px",
          }}
        >
          Chức Năng Chính
        </div>

        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "9px 12px",
                borderRadius: 10,
                border: "none",
                background: isActive ? "#eff6ff" : "transparent",
                color: isActive ? "#1d4ed8" : "#334155",
                fontWeight: isActive ? 700 : 500,
                fontSize: 13.5,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
                <div
                  className="nav-icon-box"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: isActive ? "#dbeafe" : "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: isActive ? "#2563eb" : "#64748b",
                    flexShrink: 0,
                    transition: "all 0.15s ease",
                  }}
                >
                  <Icon size={16} />
                </div>
                <div style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span>{item.label}</span>
                </div>
              </div>
              {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb" }} />}
            </button>
          );
        })}

        {/* SECTION 2: HỆ THỐNG & QUẢN TRỊ */}
        {systemItems.length > 0 && (
          <>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                padding: "14px 10px 6px",
                letterSpacing: "0.5px",
              }}
            >
              Hệ Thống & Quản Trị
            </div>

            {systemItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: isActive ? "#eff6ff" : "transparent",
                    color: isActive ? "#1d4ed8" : "#334155",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 13.5,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
                    <div
                      className="nav-icon-box"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: isActive ? "#dbeafe" : "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isActive ? "#2563eb" : "#64748b",
                        flexShrink: 0,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span>{item.label}</span>
                    </div>
                  </div>
                  {isActive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb" }} />}
                </button>
              );
            })}
          </>
        )}

        {/* SECTION 3: TIỆN ÍCH & KẾT NỐI */}
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            padding: "14px 10px 6px",
            letterSpacing: "0.5px",
          }}
        >
          Tiện Ích & Kết Nối
        </div>

        {/* Kiosk TV */}
        <button
          onClick={() => handleSelectTab("tv")}
          className={`sidebar-nav-item ${activeTab === "tv" ? "active" : ""}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 12px",
            borderRadius: 10,
            border: "none",
            background: activeTab === "tv" ? "#eff6ff" : "transparent",
            color: activeTab === "tv" ? "#1d4ed8" : "#334155",
            fontWeight: activeTab === "tv" ? 700 : 500,
            fontSize: 13.5,
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
            <div
              className="nav-icon-box"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: activeTab === "tv" ? "#dbeafe" : "#f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: activeTab === "tv" ? "#2563eb" : "#64748b",
                flexShrink: 0,
              }}
            >
              <Tv size={16} />
            </div>
            <div style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span>Màn hình TV Kiosk</span>
            </div>
          </div>
          {activeTab === "tv" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb" }} />}
        </button>

        {/* Mobile QR */}
        <button
          onClick={() => {
            if (isMobile) setMenuDrawerOpen(false);
            setShowMobileModal(true);
          }}
          className="sidebar-nav-item"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 12px",
            borderRadius: 10,
            border: "none",
            background: "transparent",
            color: "#334155",
            fontWeight: 500,
            fontSize: 13.5,
            cursor: "pointer",
            textAlign: "left",
            width: "100%",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
            <div
              className="nav-icon-box"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "#f3e8ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#7c3aed",
                flexShrink: 0,
              }}
            >
              <Smartphone size={16} />
            </div>
            <div style={{ minWidth: 0, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span>Mã QR Điện Thoại</span>
            </div>
          </div>
        </button>
      </div>

      {/* 3. USER PROFILE & LOGOUT FOOTER */}
      <div
        style={{
          borderTop: "1px solid #f1f5f9",
          padding: "12px 14px",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div
          onClick={() => {
            if (isMobile) setMenuDrawerOpen(false);
            setShowProfileModal(true);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            minWidth: 0,
            flex: 1,
            cursor: "pointer",
            padding: "4px 6px",
            borderRadius: 8,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          title="Xem hồ sơ & đổi mật khẩu"
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: userRoleMeta.bg,
              color: userRoleMeta.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "#0f172a",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                lineHeight: 1.2,
              }}
              title={user?.full_name || user?.username}
            >
              {user?.full_name || user?.username}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 10,
                  color: userRoleMeta.color,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <ShieldCheck size={10} /> {userRoleMeta.label.split(" ")[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Profile / Change Password quick button */}
        <button
          onClick={() => {
            if (isMobile) setMenuDrawerOpen(false);
            setShowProfileModal(true);
          }}
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#eff6ff";
            e.currentTarget.style.color = "#2563eb";
            e.currentTarget.style.borderColor = "#bfdbfe";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#f8fafc";
            e.currentTarget.style.color = "#64748b";
            e.currentTarget.style.borderColor = "#e2e8f0";
          }}
          title="Đổi mật khẩu"
        >
          <Key size={14} />
        </button>

        {/* Logout button */}
        <button
          onClick={logout}
          style={{
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fef2f2")}
          title="Đăng xuất khỏi hệ thống"
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ========================================================= */}
      {/* 1. PERMANENT DESKTOP SIDEBAR (Màn hình lớn >= 1025px)     */}
      {/* ========================================================= */}
      <aside className={`desktop-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        {renderSidebarContent(false)}
      </aside>

      {/* ========================================================= */}
      {/* 2. MOBILE & TABLET SLIDE-OUT DRAWER OVERLAY (< 1025px)    */}
      {/* ========================================================= */}
      {menuDrawerOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            animation: "fadeInOverlay 0.2s ease-out",
          }}
          onClick={() => setMenuDrawerOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "min(320px, 85vw)",
              height: "100%",
              backgroundColor: "#ffffff",
              boxShadow: "8px 0 35px rgba(0, 0, 0, 0.18)",
              display: "flex",
              flexDirection: "column",
              animation: "slideInLeft 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {renderSidebarContent(true)}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. MAIN CONTENT WRAPPER WITH TOPBARS & CHILDREN           */}
      {/* ========================================================= */}
      <div className={`app-main-wrapper ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        {/* DESKTOP TOPBAR (Màn hình >= 1025px) */}
        <header className="desktop-topbar">
          {/* LEFT: Toggle Sidebar button + Current Tab Info */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Nút Thu Gọn / Mở Rộng Sidebar (Desktop) */}
            <button
              onClick={toggleSidebar}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: sidebarCollapsed ? "7px 13px" : "7px 10px",
                borderRadius: 8,
                border: sidebarCollapsed ? "1.5px solid #93c5fd" : "1.5px solid #e2e8f0",
                background: sidebarCollapsed ? "#eff6ff" : "#f8fafc",
                color: sidebarCollapsed ? "#2563eb" : "#475569",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                transition: "all 0.15s ease",
                boxShadow: sidebarCollapsed ? "0 2px 4px rgba(37,99,235,0.12)" : "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#eff6ff";
                e.currentTarget.style.color = "#2563eb";
                e.currentTarget.style.borderColor = "#93c5fd";
              }}
              onMouseLeave={(e) => {
                if (!sidebarCollapsed) {
                  e.currentTarget.style.background = "#f8fafc";
                  e.currentTarget.style.color = "#475569";
                  e.currentTarget.style.borderColor = "#e2e8f0";
                }
              }}
              title={sidebarCollapsed ? "Mở rộng thanh menu bên trái" : "Thu gọn menu để xem màn hình Full (Rộng tối đa)"}
            >
              <Menu size={18} color="#2563eb" strokeWidth={2.5} />
              {sidebarCollapsed && <span>Mở Menu</span>}
            </button>

            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <CurrentActiveIcon size={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                {currentTabTitle}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                WorkShiftPro • Hệ thống quản lý 9 ca chuẩn
              </div>
            </div>
          </div>

          {/* RIGHT: Actions, Notifications, User */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Nút Toàn Màn Hình Trình Duyệt (Fullscreen) */}
            <button
              onClick={toggleFullscreen}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1.5px solid #e2e8f0",
                background: isFullscreen ? "#eff6ff" : "#f8fafc",
                color: isFullscreen ? "#2563eb" : "#475569",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={isFullscreen ? "Thoát toàn màn hình (F11)" : "Bật toàn màn hình (Fullscreen F11)"}
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>

            {/* Nút Mở trên Điện thoại (Mã QR) */}
            <button
              onClick={() => setShowMobileModal(true)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1.5px solid #e2e8f0",
                background: "#f8fafc",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Quét mã QR để mở trang web trên điện thoại"
            >
              <Smartphone size={17} />
            </button>

            {/* Nút xem Màn hình TV */}
            <button
              onClick={() => setActiveTab("tv")}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1.5px solid #bfdbfe",
                background: activeTab === "tv" ? "#2563eb" : "#eff6ff",
                color: activeTab === "tv" ? "#ffffff" : "#1d4ed8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="Chuyển sang Màn hình Kiosk Smart TV (/tv)"
            >
              <Tv size={17} />
            </button>

            {/* Notification Button */}
            <button
              onClick={() => setIsOpen(true)}
              style={{
                position: "relative",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              title="Xem thông báo"
            >
              <Bell size={18} color="#475569" />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -3,
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 700,
                    width: 17,
                    height: 17,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #ffffff",
                    boxShadow: "0 2px 4px rgba(239, 68, 68, 0.4)",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* User Quick Click */}
            <div
              onClick={() => setShowProfileModal(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 10px 4px 5px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
              title="Hồ sơ người dùng"
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: userRoleMeta.bg,
                  color: userRoleMeta.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 11,
                }}
              >
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>
                {user?.full_name || user?.username}
              </span>
            </div>
          </div>
        </header>

        {/* MOBILE TOPBAR (Màn hình < 1025px) */}
        <header className="mobile-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
              }}
            >
              <Clock size={17} />
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
              WorkShift<span style={{ color: "#2563eb" }}>Pro</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Notification Button */}
            <button
              onClick={() => setIsOpen(true)}
              style={{
                position: "relative",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Bell size={18} color="#475569" />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -3,
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 700,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid #ffffff",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* Hamburger Button to open Drawer */}
            <button
              onClick={() => setMenuDrawerOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1.5px solid #cbd5e1",
                background: "#f8fafc",
                color: "#0f172a",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <Menu size={18} color="#2563eb" strokeWidth={2.5} />
              <span>Menu</span>
            </button>
          </div>
        </header>

        {/* Page Content & Footer */}
        {children}
      </div>

      {/* ========================================================= */}
      {/* 4. CÁC MODAL HỆ THỐNG                                     */}
      {/* ========================================================= */}
      {showProfileModal && <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />}
      {showMobileModal && <MobileConnectModal isOpen={showMobileModal} onClose={() => setShowMobileModal(false)} />}
    </>
  );
}
