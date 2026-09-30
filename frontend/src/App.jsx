import React, { useState } from "react";
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

const TAB_LABELS = {
  schedule: "Lịch làm việc",
  notes: "Ghi chú ca",
  feedback: "Góp ý",
  staff: "Nhân sự",
  history: "Lịch sử ca",
  emails: "Nhật ký Email",
  smtp: "Cài đặt Email",
};

function MainContent() {
  const { user, loading, isAdmin } = useAuth();

  const getInitialTab = () => {
    const hash = window.location.hash.replace("#", "");
    const validTabs = ["schedule", "history", "notes", "feedback", "staff", "emails", "smtp"];
    return validTabs.includes(hash) ? hash : "schedule";
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);
  const [tabHistory, setTabHistory] = useState(() => [getInitialTab()]);

  // Navigate to tab and update history
  const navigateToTab = React.useCallback((newTab) => {
    setActiveTabState((prevTab) => {
      if (prevTab !== newTab) {
        setTabHistory((prevHistory) => [...prevHistory, newTab]);
        window.history.pushState({ tab: newTab }, "", `#${newTab}`);
      }
      return newTab;
    });
  }, []);

  // Go back to previous tab
  const handleGoBack = React.useCallback(() => {
    setTabHistory((prevHistory) => {
      if (prevHistory.length > 1) {
        const nextHistory = [...prevHistory];
        nextHistory.pop(); // Remove current tab
        const prevTab = nextHistory[nextHistory.length - 1];
        setActiveTabState(prevTab);
        window.history.replaceState({ tab: prevTab }, "", `#${prevTab}`);
        return nextHistory;
      } else {
        // Fallback to schedule
        setActiveTabState("schedule");
        window.history.replaceState({ tab: "schedule" }, "", `#schedule`);
        return ["schedule"];
      }
    });
  }, []);

  // Listen to browser Back / Forward buttons (popstate)
  React.useEffect(() => {
    const handlePopState = (e) => {
      const targetTab = e.state?.tab || window.location.hash.replace("#", "") || "schedule";
      setActiveTabState(targetTab);
      setTabHistory((prev) => {
        if (prev.length > 1 && prev[prev.length - 2] === targetTab) {
          return prev.slice(0, -1);
        }
        return [...prev, targetTab];
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const previousTab = tabHistory.length > 1 ? tabHistory[tabHistory.length - 2] : "schedule";
  const previousTabLabel = TAB_LABELS[previousTab] || "Lịch làm việc";
  const canGoBack = activeTab !== "schedule" || tabHistory.length > 1;

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
      <Navbar
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        onGoBack={handleGoBack}
        canGoBack={canGoBack}
        previousTabLabel={previousTabLabel}
      />
      <NotificationModal />

      <main style={{ flex: 1, paddingBottom: 40 }}>
        {activeTab === "schedule" && <SchedulePage />}
        {activeTab === "history" && <ShiftHistoryPage onGoBack={handleGoBack} previousTabLabel={previousTabLabel} />}
        {activeTab === "notes" && <ShiftNotesPage onGoBack={handleGoBack} previousTabLabel={previousTabLabel} />}
        {activeTab === "feedback" && <FeedbackPage onGoBack={handleGoBack} previousTabLabel={previousTabLabel} />}
        {activeTab === "staff" && isAdmin && <StaffManagementPage onGoBack={handleGoBack} previousTabLabel={previousTabLabel} />}
        {activeTab === "emails" && isAdmin && <EmailOutboxPage onGoBack={handleGoBack} previousTabLabel={previousTabLabel} />}
        {activeTab === "smtp" && isAdmin && <EmailSettingsPage onGoBack={handleGoBack} previousTabLabel={previousTabLabel} />}
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