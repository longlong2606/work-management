import React, { useState, useRef, useEffect } from "react";
import ProfileModal from "./ProfileModal";
import { MobileConnectModal } from "./MobileConnectModal";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import {
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
  admin: { label: "Quản trị viên", color: "#7c3aed", bg: "#ede9fe" },
  manager: { label: "Quản lý", color: "#2563eb", bg: "#dbeafe" },
  leader: { label: "Trưởng ca", color: "#059669", bg: "#d1fae5" },
  supervisor: { label: "Giám sát viên", color: "#d97706", bg: "#fef3c7" },
  technician: { label: "Kỹ thuật viên", color: "#0891b2", bg: "#cffafe" },
  staff: { label: "Nhân viên", color: "#3b82f6", bg: "#eff6ff" },
  intern: { label: "Thực tập sinh", color: "#8b5cf6", bg: "#f3e8ff" },
  viewer: { label: "Người xem", color: "#6b7280", bg: "#f3f4f6" },
};

const TAB_TITLES = {
  schedule: "Lịch ca",
  tasks: "Nhiệm vụ",
  notes: "Ghi chú",
  feedback: "Góp ý",
  staff: "Nhân sự",
  history: "Lịch sử ca",
  emails: "Nhật ký Mail",
  smtp: "Cài đặt Mail",
  tv: "TV Kiosk"
};

export function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, isAdmin, canManageStaff } = useAuth();
  const { unreadCount, setIsOpen } = useNotifications();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Click outside to close desktop dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Menu chính
  const mainNavItems = [
    { id: "schedule", label: "Lịch làm việc", icon: Calendar },
    { id: "tasks", label: "Nhiệm vụ & Dự án", icon: CheckSquare },
    { id: "notes", label: "Ghi chú ca", icon: FileText },
    { id: "feedback", label: "Góp ý", icon: MessageSquare },
  ];

  if (canManageStaff) {
    mainNavItems.push({ id: "staff", label: "Nhân sự", icon: Users });
  }

  // 2. Menu hệ thống & quản trị nâng cao
  const systemItems = [
    { id: "history", label: "Lịch sử ca (Audit Log)", icon: History, desc: "Nhật ký thay đổi & phân ca" },
    ...(isAdmin
      ? [
          { id: "emails", label: "Nhật ký Email", icon: Mail, desc: "Danh sách email đã gửi ra ngoài" },
          { id: "smtp", label: "Cài đặt Email (SMTP)", icon: Settings, desc: "Cấu hình máy chủ gửi email" },
        ]
      : []),
  ];

  const isSystemActive = systemItems.some((item) => item.id === activeTab);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const userRoleMeta = ROLE_LABELS[user?.role] || {
    label: user?.role || "Nhân viên",
    color: "#2563eb",
    bg: "#eff6ff",
  };

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
        }}
      >
        <div
          style={{
            maxWidth: 1360,
            margin: "0 auto",
            padding: "0 14px",
          }}
        >
          {/* ========================================================= */}
          {/* 1. GIAO DIỆN NAVBAR DESKTOP (Màn hình lớn >= 1025px)     */}
          {/* ========================================================= */}
          <div className="navbar-desktop">
            {/* LOGO & BRAND */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.3px", color: "#0f172a", lineHeight: 1.2 }}>
                  WorkShift<span style={{ color: "#2563eb" }}>Pro</span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" }}>
                  Quản lý 9 Ca & Kiosk TV
                </div>
              </div>
            </div>

            {/* NAVIGATION TABS DESKTOP */}
            <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "8px 14px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 600,
                      cursor: "pointer",
                      border: "none",
                      transition: "all 0.15s ease",
                      whiteSpace: "nowrap",
                      background: isActive ? "#eff6ff" : "transparent",
                      color: isActive ? "#2563eb" : "#475569",
                      boxShadow: isActive ? "inset 0 0 0 1.5px #bfdbfe" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Icon size={16} color={isActive ? "#2563eb" : "#64748b"} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {/* DROPDOWN MENU HỆ THỐNG */}
              {systemItems.length > 0 && (
                <div style={{ position: "relative" }} ref={dropdownRef}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: isSystemActive ? 700 : 600,
                      cursor: "pointer",
                      border: "none",
                      whiteSpace: "nowrap",
                      background: isSystemActive ? "#f1f5f9" : showDropdown ? "#f8fafc" : "transparent",
                      color: isSystemActive ? "#1e293b" : "#475569",
                      boxShadow: isSystemActive ? "inset 0 0 0 1.5px #cbd5e1" : "none",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSystemActive) e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSystemActive && !showDropdown) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Settings size={15} color={isSystemActive ? "#0f172a" : "#64748b"} />
                    <span>Hệ thống</span>
                    <ChevronDown
                      size={14}
                      style={{
                        transform: showDropdown ? "rotate(180deg)" : "none",
                        transition: "transform 0.2s ease",
                      }}
                    />
                  </button>

                  {/* Popup Dropdown Card */}
                  {showDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: 0,
                        width: 260,
                        backgroundColor: "#ffffff",
                        borderRadius: 14,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 12px 28px -4px rgba(0, 0, 0, 0.12), 0 6px 12px -4px rgba(0, 0, 0, 0.06)",
                        padding: "6px",
                        zIndex: 200,
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      <div style={{ padding: "6px 10px 4px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Nhật Ký & Cấu Hình
                      </div>
                      {systemItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id);
                              setShowDropdown(false);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: "none",
                              background: isActive ? "#eff6ff" : "transparent",
                              cursor: "pointer",
                              textAlign: "left",
                              transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) e.currentTarget.style.background = "#f8fafc";
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) e.currentTarget.style.background = "transparent";
                            }}
                          >
                            <div style={{ marginTop: 2, color: isActive ? "#2563eb" : "#64748b" }}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: isActive ? 700 : 600, color: isActive ? "#2563eb" : "#1e293b" }}>
                                {item.label}
                              </div>
                              {item.desc && (
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>
                                  {item.desc}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* RIGHT SIDE DESKTOP */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Nút Mở trên Điện thoại (Mã QR) */}
              <button
                onClick={() => setShowMobileModal(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#0f172a",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Quét mã QR để mở trang web trên điện thoại di động"
              >
                <Smartphone size={15} color="#2563eb" />
                <span>Điện thoại</span>
              </button>

              {/* Nút xem Màn hình TV */}
              <button
                onClick={() => setActiveTab("tv")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1.5px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Chuyển sang Màn hình Kiosk Smart TV (đường dẫn /tv)"
              >
                <Tv size={15} color="#2563eb" />
                <span>Màn hình TV</span>
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                    {user?.full_name || user?.username}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                    <span style={{ fontSize: 10, color: userRoleMeta.color, fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
                      <ShieldCheck size={10} /> {userRoleMeta.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nút Đổi mật khẩu */}
              <button
                onClick={() => setShowProfileModal(true)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title="Đổi mật khẩu tài khoản"
              >
                <Key size={16} />
              </button>

              {/* Logout Button */}
              <button
                onClick={logout}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                title="Đăng xuất"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. GIAO DIỆN NAVBAR MOBILE & TABLET & LANDSCAPE (< 1025px)*/}
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
                  whiteSpace: "nowrap"
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

              {/* Nút Hamburger menu */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border: "1.5px solid #2563eb",
                  background: mobileMenuOpen ? "#2563eb" : "#eff6ff",
                  color: mobileMenuOpen ? "#ffffff" : "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Menu tất cả chức năng"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. MOBILE DRAWER MENU OVERLAY                             */}
        {/* ========================================================= */}
        {mobileMenuOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              zIndex: 105,
              animation: "fadeIn 0.2s ease-out",
            }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: "min(340px, 88vw)",
                height: "100%",
                backgroundColor: "#ffffff",
                boxShadow: "-8px 0 25px rgba(0, 0, 0, 0.15)",
                display: "flex",
                flexDirection: "column",
                overflowY: "auto",
                padding: "16px 14px",
                gap: 12,
              }}
            >
              {/* Drawer Top Header with close button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={18} color="#2563eb" />
                  <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>Menu Hệ Thống</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
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
                    color: "#64748b"
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* User profile row in drawer */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px",
                  backgroundColor: "#f8fafc",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: userRoleMeta.bg,
                      color: userRoleMeta.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>
                      {user?.full_name || user?.username}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                      <span style={{ fontSize: 10, color: userRoleMeta.color, fontWeight: 700 }}>
                        {userRoleMeta.label}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowProfileModal(true);
                  }}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: 11, padding: "5px 8px" }}
                >
                  <Key size={12} />
                  <span>Đổi MK</span>
                </button>
              </div>

              {/* Landscape tip badge */}
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 10,
                  padding: "8px 10px",
                  fontSize: 11,
                  color: "#1e40af",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <RotateCcw size={14} color="#2563eb" style={{ flexShrink: 0 }} />
                <span>Mẹo: Bạn có thể <strong>xoay ngang điện thoại</strong> để xem toàn bộ 9 ca làm việc cực kỳ rộng rãi!</span>
              </div>

              {/* Menu items list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", padding: "4px 8px" }}>
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
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: isActive ? "#eff6ff" : "transparent",
                        color: isActive ? "#2563eb" : "#1e293b",
                        fontWeight: isActive ? 800 : 600,
                        fontSize: 13,
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Icon size={16} color={isActive ? "#2563eb" : "#64748b"} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={15} color={isActive ? "#2563eb" : "#cbd5e1"} />
                    </button>
                  );
                })}

                <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", padding: "6px 8px 2px" }}>
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
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: isActive ? "#eff6ff" : "transparent",
                        color: isActive ? "#2563eb" : "#1e293b",
                        fontWeight: isActive ? 800 : 600,
                        fontSize: 13,
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Icon size={16} color={isActive ? "#2563eb" : "#64748b"} />
                        <span>{item.label}</span>
                      </div>
                      <ChevronRight size={15} color={isActive ? "#2563eb" : "#cbd5e1"} />
                    </button>
                  );
                })}

                {/* Chuyển Màn hình TV */}
                <button
                  onClick={() => handleSelectTab("tv")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: activeTab === "tv" ? "#eff6ff" : "transparent",
                    color: activeTab === "tv" ? "#2563eb" : "#1e293b",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Tv size={16} color="#2563eb" />
                    <span>Màn hình Kiosk TV (/tv)</span>
                  </div>
                  <ChevronRight size={15} color="#cbd5e1" />
                </button>

                {/* Mã QR điện thoại */}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowMobileModal(true);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "none",
                    background: "transparent",
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Smartphone size={16} color="#7c3aed" />
                    <span>Mã QR kết nối Điện thoại</span>
                  </div>
                  <ChevronRight size={15} color="#cbd5e1" />
                </button>
              </div>

              {/* Drawer footer with logout */}
              <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: "auto" }}>
                <button
                  onClick={logout}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    padding: "10px",
                    borderRadius: 8,
                    border: "1.5px solid #fecaca",
                    background: "#fef2f2",
                    color: "#dc2626",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  <LogOut size={15} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================= */}
      {/* 4. THANH ĐIỀU HƯỚNG DƯỚI CÙNG (BOTTOM BAR PREMIUM CAPSULE) */}
      {/* ========================================================= */}
      <nav className="mobile-bottom-bar">
        {[
          { id: "schedule", label: "Lịch ca", icon: Calendar },
          { id: "tasks", label: "Nhiệm vụ", icon: CheckSquare },
          { id: "notes", label: "Ghi chú", icon: FileText },
          { id: "feedback", label: "Góp ý", icon: MessageSquare },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 0",
                color: isActive ? "#2563eb" : "#64748b",
                transition: "all 0.15s ease",
                userSelect: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 26,
                  borderRadius: 13,
                  background: isActive ? "#eff6ff" : "transparent",
                  transition: "background 0.15s ease",
                }}
              >
                <Icon size={18} color={isActive ? "#2563eb" : "#64748b"} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600, marginTop: 1 }}>
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "2px 0",
            color: (mobileMenuOpen || !["schedule", "tasks", "notes", "feedback"].includes(activeTab)) ? "#2563eb" : "#64748b",
            transition: "all 0.15s ease",
            userSelect: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 26,
              borderRadius: 13,
              background: (mobileMenuOpen || !["schedule", "tasks", "notes", "feedback"].includes(activeTab)) ? "#eff6ff" : "transparent",
            }}
          >
            <Menu size={18} color={(mobileMenuOpen || !["schedule", "tasks", "notes", "feedback"].includes(activeTab)) ? "#2563eb" : "#64748b"} strokeWidth={2} />
          </div>
          <span style={{ fontSize: 10, fontWeight: (mobileMenuOpen || !["schedule", "tasks", "notes", "feedback"].includes(activeTab)) ? 800 : 600, marginTop: 1 }}>
            Menu
          </span>
        </button>
      </nav>

      {/* MODALS */}
      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
      <MobileConnectModal isOpen={showMobileModal} onClose={() => setShowMobileModal(false)} />
    </>
  );
}
