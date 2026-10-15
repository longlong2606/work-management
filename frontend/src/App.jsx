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
import { CompetencyScorecardPage } from "./pages/CompetencyScorecardPage";
import { CpLeaderboardPage } from "./pages/CpLeaderboardPage";
import { EmailOutboxPage } from "./pages/EmailOutboxPage";
import { EmailSettingsPage } from "./pages/EmailSettingsPage";
import { TvDisplayPage } from "./pages/TvDisplayPage";

const VALID_TABS = ["schedule", "tasks", "cp", "competency", "history", "notes", "feedback", "staff", "emails", "smtp"];

function getTabFromUrl() {
  if (typeof window === "undefined") return "schedule";

  // 1. Pathname check (ví dụ: /tv, /schedule, /tasks, /competency, /staff, ...)
  const path = window.location.pathname.replace(/^\/+/, "").split("/")[0].toLowerCase();
  if (path === "tv") {
    return "tv";
  }
  if (path === "" || path === "schedule") {
    return "schedule";
  }
  if (VALID_TABS.includes(path)) {
    return path;
  }

  // 2. Hash check (fallback cho bookmark hoặc host tĩnh: #/tv, #/schedule, #competency)
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (hash === "tv") {
    return "tv";
  }
  if (hash === "" || hash === "schedule") {
    return "schedule";
  }
  if (VALID_TABS.includes(hash)) {
    return hash;
  }

  // Mặc định truy cập root ("/") -> Schedule (Lịch làm việc)
  return "schedule";
}

function MainContent() {
  const { user, loading, isAdmin, canManageStaff } = useAuth();
  const [activeTab, setActiveTabState] = useState(getTabFromUrl);

  // Chuyển tab và cập nhật HTML5 history URL
  const navigateToTab = useCallback((newTab) => {
    setActiveTabState(newTab);
    // Index route "/" tương ứng với Schedule
    const targetPath = newTab === "schedule" ? "/" : `/${newTab}`;
    if (window.location.pathname !== targetPath || window.location.hash) {
      window.history.pushState({ tab: newTab }, "", targetPath);
    }
  }, []);

  // Lắng nghe nút Back / Forward của trình duyệt (popstate)
  useEffect(() => {
    const initial = getTabFromUrl();
    setActiveTabState(initial);
    const targetPath = initial === "schedule" ? "/" : `/${initial}`;
    if (window.location.pathname !== targetPath && !window.location.pathname.startsWith(`/${initial}`)) {
      window.history.replaceState({ tab: initial }, "", targetPath);
    }

    const handlePopState = (e) => {
      const tab = e.state?.tab || getTabFromUrl();
      setActiveTabState(tab);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Nếu tab là "tv" (truy cập /tv):
  // Hiển thị trực tiếp màn hình Kiosk TV mà KHÔNG yêu cầu đăng nhập
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-page)", width: "100%", maxWidth: "100vw", overflowX: "hidden" }}>
      <Navbar activeTab={activeTab} setActiveTab={navigateToTab} />
      <NotificationModal />

      <main style={{ flex: 1, paddingBottom: 40, width: "100%", maxWidth: "100vw", overflowX: "hidden" }}>
        {activeTab === "schedule" && <SchedulePage />}
        {activeTab === "tasks" && <TasksPage />}
        {activeTab === "cp" && <CpLeaderboardPage />}
        {activeTab === "competency" && <CompetencyScorecardPage />}
        {activeTab === "history" && <ShiftHistoryPage />}
        {activeTab === "notes" && <ShiftNotesPage />}
        {activeTab === "feedback" && <FeedbackPage />}
        {activeTab === "staff" && canManageStaff && <StaffManagementPage onNavigateToCompetency={() => navigateToTab("competency")} />}
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
        WorkShiftPro &copy; 2026 - Hệ Thống Quản Lý 9 Ca Làm Việc & Đánh Giá Năng Lực Thành Viên
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
