import React, { useState, useRef, useEffect } from "react";
import ProfileModal from "./ProfileModal";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import {
  Calendar,
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
  ChevronDown
} from "lucide-react";

export function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, isAdmin } = useAuth();
  const { unreadCount, setIsOpen } = useNotifications();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Menu chính cốt lõi (Gọn gàng, 1 dòng)
  const mainNavItems = [
    { id: "schedule", label: "Lịch làm việc", icon: Calendar },
    { id: "notes", label: "Ghi chú ca", icon: FileText },
    { id: "feedback", label: "Góp ý", icon: MessageSquare },
  ];

  if (isAdmin) {
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

  return (
    <header
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        position: "sticky",
        top: 0,
        zIndex: 100,
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.04)"
      }}
    >
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64
        }}
      >
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
              boxShadow: "0 4px 10px rgba(37, 99, 235, 0.25)"
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

        {/* NAVIGATION TABS (TINH GỌN, CHỮ 1 DÒNG) */}
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
                  boxShadow: isActive ? "inset 0 0 0 1.5px #bfdbfe" : "none"
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
                  transition: "all 0.15s"
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
                    transition: "transform 0.2s ease"
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
                    gap: 3
                  }}
                >
                  <div style={{ padding: "6px 10px 4px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Nhật ký & Cấu hình
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
                          transition: "background 0.15s"
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

        {/* RIGHT SIDE: THÔNG BÁO & USER PROFILE GỌN GÀNG */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              transition: "all 0.15s"
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
                  boxShadow: "0 2px 4px rgba(239, 68, 68, 0.4)"
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* User Card (Bấm vào để mở Đổi mật khẩu / Hồ sơ) */}
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
              transition: "all 0.15s"
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
                background: isAdmin ? "#ede9fe" : "#dbeafe",
                color: isAdmin ? "#6d28d9" : "#1d4ed8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 12
              }}
            >
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <div style={{ textAlign: "left", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.1 }}>
                {user?.full_name || user?.username}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 1 }}>
                {isAdmin ? (
                  <span style={{ fontSize: 10, color: "#7c3aed", fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
                    <ShieldCheck size={10} /> Admin
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, display: "flex", alignItems: "center", gap: 2 }}>
                    <UserCheck size={10} /> Nhân viên
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Nút Đổi mật khẩu gọn nhẹ */}
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
              cursor: "pointer"
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
              cursor: "pointer"
            }}
            title="Đăng xuất"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </header>
  );
}
