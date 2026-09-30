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
import { StaffManagementPage } from "./pages/StaffManagementPage";
import { EmailOutboxPage } from "./pages/EmailOutboxPage";
import { EmailSettingsPage } from "./pages/EmailSettingsPage";

const VALID_TABS = ["schedule", "history", "notes", "feedback", "staff", "emails", "smtp"];

function getTabFromUrl() {
  if (typeof window === "undefined") return "schedule";
  // 1. Pathname check (e.g. /notes, /feedback, /schedule)
  const path = window.location.pathname.replace(/^\/+/, "").split("/")[0].toLowerCase();
  if (VALID_TABS.includes(path)) {
    return path;
  }
  // 2. Hash check (e.g. #notes, #feedback, /schedule#feedback)
  const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  if (VALID_TABS.includes(hash)) {
    return hash;
  }
  return "schedule";
}

function MainContent() {
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTabState] = useState(getTabFromUrl);

  // Navigate to tab and push clean HTML5 state to browser history
  const navigateToTab = useCallback((newTab) => {
    if (!VALID_TABS.includes(newTab)) newTab = "schedule";
    setActiveTabState(newTab);
    const targetPath = `/${newTab}`;
    if (window.location.pathname !== targetPath || window.location.hash) {
      window.history.pushState({ tab: newTab }, "", targetPath);
    }
  }, []);

  // Listen to browser Back / Forward buttons (popstate)
  useEffect(() => {
    const initial = getTabFromUrl();
    setActiveTabState(initial);
    // Replace current browser URL with clean HTML5 route without reloading
    window.history.replaceState({ tab: initial }, "", `/${initial}`);

    const handlePopState = (e) => {
      const tab = e.state?.tab || getTabFromUrl();
      if (VALID_TABS.includes(tab)) {
        setActiveTabState(tab);
      } else {
        setActiveTabState("schedule");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
    return <LoginPage />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-page)" }}>
      <Navbar activeTab={activeTab} setActiveTab={navigateToTab} />
      <NotificationModal />

      <main style={{ flex: 1, paddingBottom: 40 }}>
        {activeTab === "schedule" && <SchedulePage />}
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
