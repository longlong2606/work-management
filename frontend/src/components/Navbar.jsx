import React from "react";
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
  History
} from "lucide-react";

export function Navbar({ activeTab, setActiveTab }) {
  const { user, logout, isAdmin } = useAuth();
  const { unreadCount, setIsOpen } = useNotifications();

  const navItems = [
    { id: "schedule", label: "Lịch Làm Việc (9 Ca)", icon: Calendar },
    { id: "history", label: "Lịch Sử Ca (Audit Log)", icon: History },
    { id: "notes", label: "Sổ Ghi Chú Ca Làm", icon: FileText },
    { id: "feedback", label: "Góp Ý Toàn Công Ty", icon: MessageSquare },
  ];

  if (isAdmin) {
    navItems.push({ id: "staff", label: "Quản Lý Nhân Viên", icon: Users });
    navItems.push({ id: "emails", label: "Nhật Ký Email", icon: Mail });
    navItems.push({ id: "smtp", label: "Cài Đặt Email", icon: Settings });
  }

  return (
    <header style={{
      background: "#ffffff",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)"
    }}>
      <div style={{
        maxWidth: 1280,
        margin: "0 auto",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 68
      }}>
        {/* Logo & App Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 4px 10px rgba(37, 99, 235, 0.3)"
          }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.3px", color: "#0f172a" }}>
              WorkShift<span style={{ color: "#2563eb" }}>Pro</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              Hệ thống Quản lý 9 Ca & Nội bộ
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.2s ease",
                  background: isActive ? "#eff6ff" : "transparent",
                  color: isActive ? "#2563eb" : "#475569",
                  boxShadow: isActive ? "inset 0 0 0 1.5px #bfdbfe" : "none"
                }}
              >
                <Icon size={16} color={isActive ? "#2563eb" : "#64748b"} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User profile & Notification Bell */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Notification button */}
          <button
            onClick={() => setIsOpen(true)}
            style={{
              position: "relative",
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "#f8fafc",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            title="Xem thông báo"
          >
            <Bell size={19} color="#475569" />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute",
                top: -4,
                right: -4,
                background: "#ef4444",
                color: "#ffffff",
                fontSize: 10,
                fontWeight: 700,
                width: 18,
                height: 18,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid #ffffff",
                boxShadow: "0 2px 5px rgba(239, 68, 68, 0.4)"
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* User info */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "5px 12px 5px 6px",
            background: "#f8fafc",
            borderRadius: 12,
            border: "1px solid var(--border)"
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: isAdmin ? "#ede9fe" : "#dbeafe",
              color: isAdmin ? "#6d28d9" : "#1d4ed8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 13
            }}>
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
                {user?.full_name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                {isAdmin ? (
                  <span className="badge badge-purple" style={{ padding: "1px 6px", fontSize: 10 }}>
                    <ShieldCheck size={11} /> Admin
                  </span>
                ) : (
                  <span className="badge badge-blue" style={{ padding: "1px 6px", fontSize: 10 }}>
                    <UserCheck size={11} /> Nhân viên
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={logout}
            className="btn btn-secondary btn-sm"
            style={{ padding: "8px 12px", color: "#dc2626" }}
            title="Đăng xuất"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}