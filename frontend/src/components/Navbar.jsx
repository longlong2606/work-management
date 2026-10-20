import React, { useState, useRef, useEffect } from "react";
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
  UserCheck,
  Settings,
  History,
  Key,
  ChevronDown,
  Tv,
  Smartphone,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  RotateCcw
} from "lucide-react";

const ROLE_LABELS = {
  admin: { label: "Admin (Quản trị viên)", color: "#7c3aed", bg: "#ede9fe" },
  core: { label: "Core (Thành viên Cốt cán)", color: "#2563eb", bg: "#dbeafe" },
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
  schedule: "Lịch ca",
  tasks: "Nhiệm vụ",
  cp: "Điểm Đóng Góp (CP)",
  competency: "Năng lực",
  notes: "Ghi chú",
  feedback: "Góp ý",
  staff: "Nhân sự",
  history: "Lịch sử ca",
  emails: "Nhật ký Mail",
  smtp: "Cài đặt Mail",
  tv: "TV Kiosk"
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
  tv: Tv
};

export function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, isAdmin, canManageStaff } = useAuth();
  const { unreadCount, setIsOpen } = useNotifications();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false);

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
    mainNavItems.push({ id: "staff", label: "Nhân sự", icon: Users, desc: "Danh sách thành viên & phòng ban" });
  }

  // 2. Menu hệ thống & quản trị
  const systemItems = [
    { id: "history", label: "Lịch sử ca (Audit Log)", icon: History, desc: "Nhật ký thay đổi & phân ca" },
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

  return (
    <>
      <header
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          position: "sticky",
          top: 0,
          zIndex: 100,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
          width: "100%",
          overflow: "visible",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1400,
            margin: "0 auto",
            padding: "0 16px",
            boxSizing: "border-box",
            overflow: "visible",
          }}
        >
          {/* ========================================================= */}
          {/* 1. GIAO DIỆN NAVBAR DESKTOP (Màn hình lớn >= 1025px)      */}
          {/* ========================================================= */}
          <div className="navbar-desktop">
            {/* LEFT: NÚT 3 GẠCH MENU + BRAND LOGO + CURRENT PAGE BADGE */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* NÚT 3 GẠCH (HAMBURGER MENU) CHO DESKTOP */}
              <button
                onClick={() => setMenuDrawerOpen(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 13px",
                  borderRadius: 10,
                  border: "1.5px solid #cbd5e1",
                  background: menuDrawerOpen ? "#eff6ff" : "#f8fafc",
                  color: menuDrawerOpen ? "#2563eb" : "#0f172a",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#eff6ff";
                  e.currentTarget.style.borderColor = "#93c5fd";
                  e.currentTarget.style.color = "#2563eb";
                }}
                onMouseLeave={(e) => {
                  if (!menuDrawerOpen) {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.color = "#0f172a";
                  }
                }}
                title="Nhấn 3 gạch để mở toàn bộ Menu chức năng"
              >
                <Menu size={18} color="#2563eb" strokeWidth={2.5} />
                <span>Menu</span>
              </button>

              {/* BRAND LOGO */}
              <div
                onClick={() => handleSelectTab("schedule")}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                title="Về trang chủ Lịch ca"
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    boxShadow: "0 4px 10px rgba(37, 99, 235, 0.25)",
                  }}
                >
                  <Clock size={19} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px", color: "#0f172a", lineHeight: 1.2 }}>
                    WorkShift<span style={{ color: "#2563eb" }}>Pro</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>
                    Quản lý 9 Ca & Kiosk TV
                  </div>
                </div>
              </div>

              {/* CURRENT PAGE BADGE (Clickable to switch tab) */}
              <button
                onClick={() => setMenuDrawerOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 11px",
                  borderRadius: 20,
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#dbeafe";
                  e.currentTarget.style.borderColor = "#93c5fd";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#eff6ff";
                  e.currentTarget.style.borderColor = "#bfdbfe";
                }}
                title="Trang hiện tại. Bấm để mở Menu đổi trang"
              >
                <CurrentActiveIcon size={14} color="#2563eb" />
                <span>{TAB_TITLES[activeTab] || activeTab}</span>
                <ChevronDown size={13} color="#2563eb" />
              </button>
            </div>



            {/* RIGHT SIDE DESKTOP: TIỆN ÍCH, THÔNG BÁO, USER, ĐĂNG XUẤT */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {/* Nút Mở trên Điện thoại (Mã QR) */}
              <button
                onClick={() => setShowMobileModal(true)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
                title="Quét mã QR để mở trang web trên điện thoại"
              >
                <Smartphone size={16} />
              </button>

              {/* Nút xem Màn hình TV */}
              <button
                onClick={() => setActiveTab("tv")}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "1.5px solid #bfdbfe",
                  background: activeTab === "tv" ? "#2563eb" : "#eff6ff",
                  color: activeTab === "tv" ? "#ffffff" : "#1d4ed8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  flexShrink: 0,
                }}
                title="Chuyển sang Màn hình Kiosk Smart TV (/tv)"
              >
                <Tv size={16} />
              </button>

              {/* Notification Button */}
              <button
                onClick={() => setIsOpen(true)}
                style={{
                  position: "relative",
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  flexShrink: 0,
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
                      width: 16,
                      height: 16,
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

              {/* User Card */}
              <div
                onClick={() => setShowProfileModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 10px 4px 5px",
                  background: "#f8fafc",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                title="Click để xem hồ sơ & đổi mật khẩu"
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#bfdbfe")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: userRoleMeta.bg,
                    color: userRoleMeta.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                </div>
                <div style={{ textAlign: "left", whiteSpace: "nowrap" }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#0f172a",
                      lineHeight: 1.1,
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={user?.full_name || user?.username}
                  >
                    {user?.full_name || user?.username}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                    <span style={{ fontSize: 9.5, color: userRoleMeta.color, fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
                      <ShieldCheck size={10} /> {userRoleMeta.label.split(" ")[0]}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#dc2626",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fef2f2")}
                title="Đăng xuất"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. GIAO DIỆN NAVBAR MOBILE & TABLET (< 1025px)            */}
          {/* ========================================================= */}
          <div className="navbar-mobile">
            {/* BRAND & ACTIVE TAB BADGE */}
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
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
                }}
              >
                <Clock size={16} />
              </div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                WorkShift<span style={{ color: "#2563eb" }}>Pro</span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  background: "#eff6ff",
                  color: "#2563eb",
                  padding: "2px 8px",
                  borderRadius: 12,
                  border: "1px solid #bfdbfe",
                  whiteSpace: "nowrap",
                }}
              >
                {TAB_TITLES[activeTab] || activeTab}
              </span>
            </div>

            {/* ACTION ICONS FOR MOBILE */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Nút QR điện thoại */}
              <button
                onClick={() => setShowMobileModal(true)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2563eb",
                  cursor: "pointer",
                }}
                title="Mã QR & Link điện thoại"
              >
                <Smartphone size={17} />
              </button>

              {/* Nút Thông báo */}
              <button
                onClick={() => setIsOpen(true)}
                style={{
                  position: "relative",
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                <Bell size={17} />
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
                      width: 15,
                      height: 15,
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

              {/* Nút Hamburger menu (3 gạch) */}
              <button
                onClick={() => setMenuDrawerOpen(!menuDrawerOpen)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "1.5px solid #2563eb",
                  background: menuDrawerOpen ? "#2563eb" : "#eff6ff",
                  color: menuDrawerOpen ? "#ffffff" : "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Menu tất cả chức năng (3 gạch)"
              >
                {menuDrawerOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. SLIDE-OUT MENU DRAWER OVERLAY (CHO CẢ DESKTOP & MOBILE)*/}
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
                right: 0,
                width: "min(360px, 90vw)",
                height: "100%",
                backgroundColor: "#ffffff",
                boxShadow: "-8px 0 35px rgba(0, 0, 0, 0.18)",
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                padding: "18px 16px",
                gap: 14,
                animation: "slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Drawer Top Header with close button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                    <Clock size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", lineHeight: 1.2 }}>
                      WorkShift<span style={{ color: "#2563eb" }}>Pro</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>Menu Tất Cả Chức Năng</div>
                  </div>
                </div>
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
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fee2e2";
                    e.currentTarget.style.color = "#dc2626";
                    e.currentTarget.style.borderColor = "#fecaca";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#f8fafc";
                    e.currentTarget.style.color = "#64748b";
                    e.currentTarget.style.borderColor = "#e2e8f0";
                  }}
                  title="Đóng menu (Esc)"
                >
                  <X size={17} />
                </button>
              </div>

              {/* User profile card in drawer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px",
                  backgroundColor: "#f8fafc",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: userRoleMeta.bg,
                      color: userRoleMeta.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        color: "#0f172a",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={user?.full_name || user?.username}
                    >
                      {user?.full_name || user?.username}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          color: userRoleMeta.color,
                          fontWeight: 700,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <ShieldCheck size={11} /> {userRoleMeta.label}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMenuDrawerOpen(false);
                    setShowProfileModal(true);
                  }}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: 11, padding: "5px 9px", flexShrink: 0, gap: 4 }}
                  title="Xem hồ sơ & đổi mật khẩu"
                >
                  <Key size={12} />
                  <span>Đổi MK</span>
                </button>
              </div>

              {/* MENU ITEMS LIST */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                {/* 1. CHỨC NĂNG CHÍNH */}
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", padding: "6px 8px 2px", letterSpacing: "0.5px" }}>
                  Chức Năng Chính
                </div>
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectTab(item.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: "none",
                        background: isActive ? "#eff6ff" : "transparent",
                        color: isActive ? "#2563eb" : "#1e293b",
                        fontWeight: isActive ? 800 : 600,
                        fontSize: 13,
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        <div
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
                          }}
                        >
                          <Icon size={16} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: isActive ? 800 : 600 }}>{item.label}</div>
                          {item.desc && (
                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 400, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {item.desc}
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={15} color={isActive ? "#2563eb" : "#cbd5e1"} />
                    </button>
                  );
                })}

                {/* 2. HỆ THỐNG & QUẢN TRỊ */}
                {systemItems.length > 0 && (
                  <>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", padding: "10px 8px 2px", letterSpacing: "0.5px" }}>
                      Hệ Thống & Quản Trị
                    </div>
                    {systemItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectTab(item.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "9px 12px",
                            borderRadius: 10,
                            border: "none",
                            background: isActive ? "#eff6ff" : "transparent",
                            color: isActive ? "#2563eb" : "#1e293b",
                            fontWeight: isActive ? 800 : 600,
                            fontSize: 13,
                            cursor: "pointer",
                            textAlign: "left",
                            width: "100%",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.background = "#f8fafc";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                            <div
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
                              }}
                            >
                              <Icon size={16} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: isActive ? 800 : 600 }}>{item.label}</div>
                              {item.desc && (
                                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 400, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {item.desc}
                                </div>
                              )}
                            </div>
                          </div>
                          <ChevronRight size={15} color={isActive ? "#2563eb" : "#cbd5e1"} />
                        </button>
                      );
                    })}
                  </>
                )}

                {/* 3. TIỆN ÍCH */}
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", padding: "10px 8px 2px", letterSpacing: "0.5px" }}>
                  Tiện Ích & Kết Nối
                </div>

                {/* Chuyển Màn hình TV */}
                <button
                  onClick={() => handleSelectTab("tv")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: activeTab === "tv" ? "#eff6ff" : "transparent",
                    color: activeTab === "tv" ? "#2563eb" : "#1e293b",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== "tv") e.currentTarget.style.background = "#f8fafc";
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== "tv") e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: activeTab === "tv" ? "#dbeafe" : "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#2563eb",
                        flexShrink: 0,
                      }}
                    >
                      <Tv size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Màn hình Kiosk TV</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Chế độ trình chiếu Kiosk Smart TV (/tv)</div>
                    </div>
                  </div>
                  <ChevronRight size={15} color="#cbd5e1" />
                </button>

                {/* Mã QR điện thoại */}
                <button
                  onClick={() => {
                    setMenuDrawerOpen(false);
                    setShowMobileModal(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "transparent",
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                    <div
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
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Mã QR Điện Thoại</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>Quét mã để truy cập nhanh trên mobile</div>
                    </div>
                  </div>
                  <ChevronRight size={15} color="#cbd5e1" />
                </button>
              </div>

              {/* Drawer footer with logout */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12, marginTop: "auto" }}>
                <button
                  onClick={logout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    padding: "10px",
                    borderRadius: 10,
                    border: "1.5px solid #fecaca",
                    background: "#fef2f2",
                    color: "#dc2626",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fef2f2")}
                >
                  <LogOut size={16} />
                  <span>Đăng xuất khỏi hệ thống</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================= */}
      {/* 4. THANH ĐIỀU HƯỚNG DƯỚI CÙNG CHO MOBILE (BOTTOM BAR)     */}
      {/* ========================================================= */}
      <nav className="mobile-bottom-bar">
        {[
          { id: "schedule", label: "Lịch ca", icon: Calendar },
          { id: "tasks", label: "Nhiệm vụ", icon: CheckSquare },
          { id: "cp", label: "Điểm CP", icon: Sparkles },
          { id: "notes", label: "Ghi chú", icon: FileText },
          { id: "menu", label: "Menu", icon: Menu, isMenuToggle: true },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = item.isMenuToggle ? menuDrawerOpen : activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isMenuToggle) {
                  setMenuDrawerOpen(!menuDrawerOpen);
                } else {
                  handleSelectTab(item.id);
                }
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                height: "100%",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px 2px",
                color: isActive ? "#2563eb" : "#64748b",
                transition: "all 0.15s ease",
              }}
            >
              <div
                style={{
                  padding: "3px 12px",
                  borderRadius: 16,
                  background: isActive ? "#eff6ff" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={19} color={isActive ? "#2563eb" : "#64748b"} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 800 : 500,
                  marginTop: 2,
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* ========================================================= */}
      {/* 5. CÁC MODAL HỆ THỐNG                                     */}
      {/* ========================================================= */}
      {showProfileModal && <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />}
      {showMobileModal && <MobileConnectModal isOpen={showMobileModal} onClose={() => setShowMobileModal(false)} />}
    </>
  );
}
