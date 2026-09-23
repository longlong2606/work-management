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

function MainContent() {
  const { user, loading, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("schedule");

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
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
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