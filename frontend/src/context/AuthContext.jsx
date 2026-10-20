import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("wm_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("wm_token");
      if (token) {
        try {
          const profile = await api.getProfile();
          setUser(profile);
          localStorage.setItem("wm_user", JSON.stringify(profile));
        } catch (err) {
          console.warn("Auth check error:", err.message || err);
          const isUnauthorized = err?.message?.includes("401") || err?.message?.includes("Phiên đăng nhập") || err?.status === 401;
          if (isUnauthorized) {
            logout();
          } else {
            // Giữ session nếu chỉ là lỗi mạng tạm thời
            const saved = localStorage.getItem("wm_user");
            if (saved) {
              try { setUser(JSON.parse(saved)); } catch (_) {}
            }
          }
        }
      }
      setLoading(false);
    };

    checkAuth();

    const handleLogout = () => logout();
    window.addEventListener("auth_logout", handleLogout);

    const handleRolesUpdated = () => {
      refreshProfile();
    };
    window.addEventListener("roles_updated", handleRolesUpdated);

    return () => {
      window.removeEventListener("auth_logout", handleLogout);
      window.removeEventListener("roles_updated", handleRolesUpdated);
    };
  }, []);

  const refreshProfile = async () => {
    try {
      const profile = await api.getProfile();
      setUser(profile);
      localStorage.setItem("wm_user", JSON.stringify(profile));
      return profile;
    } catch (err) {
      console.error("Refresh profile failed:", err);
    }
  };

  const login = async (username, password) => {
    const res = await api.login(username, password);
    localStorage.setItem("wm_token", res.access_token);
    localStorage.setItem("wm_user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const logout = () => {
    localStorage.removeItem("wm_token");
    localStorage.removeItem("wm_user");
    setUser(null);
  };

  const updateCurrentUser = (updatedUser) => {
    const merged = { ...user, ...updatedUser };
    setUser(merged);
    localStorage.setItem("wm_user", JSON.stringify(merged));
  };

    // 5 Chuẩn Role theo phân cấp: Admin > Leader > Core > Contributor > Learning
  const role = user?.role || "contributor";
  const isAdmin = role === "admin";
  const isLeader = role === "leader" || role === "supervisor";
  const isCore = role === "core";
  const isContributor = role === "contributor" || role === "technician" || role === "staff";
  const isLearning = role === "learning";
  const isManagerRole = role === "manager" || role === "quan_ly";

  // Quyền hạn thực tế theo Database:
  // - Admin luôn có đủ 5 quyền tối cao
  // - Leader có phân ca, quản lý nhân sự, đánh giá năng lực, tính điểm CP; giao subtask (không tạo nhiệm vụ lớn)
  // - Core, Contributor, Learning không được quyền nào hết (mọi quyền = false)
  const canManageStaff = isAdmin ? true : Boolean(user?.can_manage_staff);
  const canManageSchedule = isAdmin ? true : Boolean(user?.can_manage_schedule);
  const canManageTasks = isAdmin ? true : Boolean(user?.can_manage_tasks);
  const canEvaluate = isAdmin ? true : Boolean(user?.can_evaluate);
  const canManageCp = isAdmin ? true : Boolean(user?.can_manage_cp);

  // Quyền tạo nhiệm vụ lớn: Chỉ Admin
  const canCreateRootTask = isAdmin;

  // Quyền giao subtask: Admin và Leader (hoặc ai được cấp can_manage_tasks)
  const canManageSubtasks = isAdmin || isLeader || Boolean(user?.can_manage_tasks);

  // Alias tương thích
  const isManager = isAdmin || isLeader || isManagerRole;
  const isSupervisor = isLeader;

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAdmin, 
      isCore,
      isManager,
      isLeader, 
      isSupervisor,
      isContributor,
      isLearning,
      canManageStaff,
      canManageSchedule,
      canManageTasks,
      canEvaluate,
      canManageCp,
      loading, 
      updateCurrentUser,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
