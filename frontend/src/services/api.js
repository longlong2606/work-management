const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== "undefined" && window.location.port === "5173" ? "http://127.0.0.1:8000/api" : "/api");

function getToken() {
  return localStorage.getItem("wm_token") || "";
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);

  if (response.status === 401) {
    localStorage.removeItem("wm_token");
    localStorage.removeItem("wm_user");
    if (!window.location.hash.includes("login")) {
      window.dispatchEvent(new Event("auth_logout"));
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || "Đã có lỗi xảy ra, vui lòng thử lại!";
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  login: (username, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  getProfile: () => request("/auth/me"),
  forgotPassword: (identifier) =>
    request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ identifier }),
    }),
  changePassword: (oldPassword, newPassword) =>
    request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }),
  updateProfile: (profileData) =>
    request("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    }),

  // Users
  getUsers: () => request("/users"),
  createUser: (userData) =>
    request("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    }),
  adminResetPassword: (userId, newPassword) =>
    request(`/users/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ new_password: newPassword }),
    }),
  updateUser: (userId, userData) =>
    request(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(userData),
    }),

  // Shifts
  getShiftTemplates: () => request("/shifts/templates"),
  getSchedule: (startDate, endDate) =>
    request(`/shifts/schedule?start_date=${startDate}&end_date=${endDate}`),
  registerShift: (shiftId, workDate, note = "", userId = null) =>
    request("/shifts/register", {
      method: "POST",
      body: JSON.stringify({
        shift_id: shiftId,
        work_date: workDate,
        note,
        ...(userId ? { user_id: userId } : {}),
      }),
    }),
  cancelShiftRegistration: (shiftId, workDate, userId = null) =>
    request(`/shifts/register?shift_id=${shiftId}&work_date=${workDate}${userId ? `&user_id=${userId}` : ""}`, {
      method: "DELETE",
    }),
  // Shift Approval Workflow (Hủy & Đổi ca phải qua phê duyệt)
  getPendingShiftRequests: () => request("/shifts/pending-requests"),
  requestCancelShift: (shiftId, workDate, reason, registrationId = null) =>
    request("/shifts/request-cancel", {
      method: "POST",
      body: JSON.stringify({
        registration_id: registrationId,
        shift_id: shiftId,
        work_date: workDate,
        reason,
      }),
    }),
  requestChangeShift: (data) =>
    request("/shifts/request-change", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approveShiftRequest: (registrationId, action, adminResponse = "") =>
    request("/shifts/approve-request", {
      method: "POST",
      body: JSON.stringify({
        registration_id: registrationId,
        action,
        admin_response: adminResponse,
      }),
    }),
  rejectExpiredRequests: () =>
    request("/shifts/reject-expired-requests", {
      method: "POST",
    }),

  publishSchedule: (weekStartOrObj, sendEmail = true, announcement = '') => {
    let payload = {};
    if (typeof weekStartOrObj === 'object' && weekStartOrObj !== null) {
      payload = {
        week_start: weekStartOrObj.week_start,
        send_email: weekStartOrObj.send_email !== undefined ? weekStartOrObj.send_email : true,
        announcement: weekStartOrObj.announcement || '',
      };
    } else {
      payload = {
        week_start: weekStartOrObj,
        send_email: sendEmail,
        announcement,
      };
    }
    return request('/shifts/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Shift Audit Log / History
  getShiftHistory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.action) query.append("action", params.action);
    if (params.work_date) query.append("work_date", params.work_date);
    if (params.user_id) query.append("user_id", params.user_id);
    const qs = query.toString();
    return request(`/shifts/history${qs ? `?${qs}` : ""}`);
  },

  // Shift Notes (Báo bận đột xuất / điều chỉnh ca làm)
  getShiftNotes: () => request("/shift-notes"),
  createShiftNote: (data) =>
    request("/shift-notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateShiftNoteStatus: (noteId, status, adminResponse = "") =>
    request(`/shift-notes/${noteId}/status`, {
      method: "PUT",
      body: JSON.stringify({
        status,
        admin_response: adminResponse,
      }),
    }),

  // Feedbacks
  getFeedbacks: () => request("/feedbacks"),
  createFeedback: (data) =>
    request("/feedbacks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  toggleLikeFeedback: (id) =>
    request(`/feedbacks/${id}/like`, {
      method: "POST",
    }),
  replyFeedback: (id, adminReply, status = "resolved") =>
    request(`/feedbacks/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({
        admin_reply: adminReply,
        status,
      }),
    }),

  // Notifications
  getNotifications: () => request("/notifications"),
  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, {
      method: "PUT",
    }),
  markAllNotificationsRead: () =>
    request("/notifications/read-all", {
      method: "PUT",
    }),

  // SMTP Settings & Test Email
  getSmtpSettings: () => request("/settings/smtp"),
  updateSmtpSettings: (data) =>
    request("/settings/smtp", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  testSendEmail: (recipientEmail) =>
    request("/emails/test-send", {
      method: "POST",
      body: JSON.stringify({ recipient_email: recipientEmail }),
    }),

  // Email Outbox
  getEmailOutbox: () => request("/emails/outbox"),
  // Shift Events & Attendance
  getShiftEvents: (params = {}) => {
    const query = new URLSearchParams();
    if (params.work_date) query.append("work_date", params.work_date);
    if (params.shift_id) query.append("shift_id", params.shift_id);
    const qs = query.toString();
    return request(`/shifts/events${qs ? `?${qs}` : ""}`);
  },
  createShiftEvent: (data) =>
    request("/shifts/events", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteShiftEvent: (id) =>
    request(`/shifts/events/${id}`, {
      method: "DELETE",
    }),
  updateAttendance: (registrationId, attendanceStatus) =>
    request(`/shifts/registrations/${registrationId}/attendance`, {
      method: "PUT",
      body: JSON.stringify({ attendance_status: attendanceStatus }),
    }),
  // Shift Roster & Absence Reporting
  getShiftRoster: (shiftId, workDate) =>
    request(`/shifts/roster?shift_id=${shiftId}&work_date=${workDate}`),
  reportAbsence: (data) =>
    request("/shifts/report-absence", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelAbsence: (data) =>
    request("/shifts/cancel-absence", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approveAbsence: (data) =>
    request("/shifts/approve-absence", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};