import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { Navbar } from "./components/Navbar";
import { NotificationModal } from "./components/NotificationModal";
import { LoginPage } from "./pages/LoginPage";
import { SchedulePage } from "./pages/SchedulePage";
import { ShiftHistoryPage } from "./pages/ShiftHistoryPage";
import { ShiftNotesPage } from "./pages/ShiftNotesPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { TasksPage } from "./pages/TasksPage";
import { StaffManagementPage } from "./pages/StaffManagementPage";
import { EmailOutboxPage } from "./pages/EmailOutboxPage";
import { EmailSettingsPage } from "./pages/EmailSettingsPage";
import { TvDisplayPage } from "./pages/TvDisplayPage";

const VALID_TABS = ["schedule", "tasks", "history", "notes", "feedback", "staff", "emails", "smtp"];

function getTabFromUrl() {
  if (typeof window === "undefined") return "tv";
  // 1. Pathname check (e.g. /notes, /feedback, /schedule)
  const path = window.location.pathname.replace(/^\/+/, "").split("/")[0].toLowerCase();
  if (path === "" || path === "tv") {
    return "tv";
  }
  if (VALID_TABS.includes(path)) {
    return path;
  }
  // 2. Hash check (e.g. #notes, #feedback, /schedule#feedback)
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash === "tv" || hash === "") {
    return "tv";
  }
  if (VALID_TABS.includes(hash)) {
    return hash;
  }
  // Khi không có tiền tố nào (ví dụ http://localhost:5173/ bỏ schedule) -> mặc định là TV
  return "tv";
}

function MainContent() {
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTabState] = useState(getTabFromUrl);

  // Navigate to tab and push clean HTML5 state to browser history
  const navigateToTab = useCallback((newTab) => {
    setActiveTabState(newTab);
    const targetPath = newTab === "tv" ? "/" : `/${newTab}`;
    if (window.location.pathname !== targetPath || window.location.hash) {
      window.history.pushState({ tab: newTab }, "", targetPath);
    }
  }, []);

  // Listen to browser Back / Forward buttons (popstate)
  useEffect(() => {
    const initial = getTabFromUrl();
    setActiveTabState(initial);
    const targetPath = initial === "tv" ? "/" : `/${initial}`;
    if (window.location.pathname !== targetPath) {
      window.history.replaceState({ tab: initial }, "", targetPath);
    }

    const handlePopState = (e) => {
      const tab = e.state?.tab || getTabFromUrl();
      setActiveTabState(tab);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Nếu tab là "tv" (hoặc truy cập root / không có /schedule):
  // Hiển thị trực tiếp màn hình Kiosk TV mà KHÔNG yêu cầu đăng nhập!
  if (activeTab === "tv") {
    return <TvDisplayPage onNavigateToManagement={() => navigateToTab("schedule")} />;
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: 15,
        fontWeight: 600
      }}>
        Đang khởi động hệ thống...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onBackToTv={() => navigateToTab("tv")} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-page)" }}>
      <Navbar activeTab={activeTab} setActiveTab={navigateToTab} />
      <NotificationModal />

      <main style={{ flex: 1, paddingBottom: 40 }}>
        {activeTab === "schedule" && <SchedulePage />}
        {activeTab === "tasks" && <TasksPage />}
        {activeTab === "history" && <ShiftHistoryPage />}
        {activeTab === "notes" && <ShiftNotesPage />}
        {activeTab === "feedback" && <FeedbackPage />}
        {activeTab === "staff" && isAdmin && <StaffManagementPage />}
        {activeTab === "emails" && isAdmin && <EmailOutboxPage />}
        {activeTab === "smtp" && isAdmin && <EmailSettingsPage />}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        background: "#ffffff",
        padding: "16px 20px",
        textAlign: "center",
        fontSize: 12,
        color: "var(--text-dim)"
      }}>
        WorkShiftPro &copy; 2026 - Hệ Thống Quản Lý 9 Ca Làm Việc & Cổng Thông Tin Doanh Nghiệp
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MainContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
