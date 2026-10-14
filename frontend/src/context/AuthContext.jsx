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
          console.error("Auth check failed:", err);
          logout();
        }
      }
      setLoading(false);
    };

    checkAuth();

    const handleLogout = () => logout();
    window.addEventListener("auth_logout", handleLogout);
    return () => window.removeEventListener("auth_logout", handleLogout);
  }, []);

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

  // 5 Chuẩn Role theo phân cấp: Admin > Core > Leader > Contributor > Learning
  const role = user?.role || "contributor";
  const isAdmin = role === "admin";
  const isCore = role === "admin" || role === "core" || role === "manager";
  const isLeader = isCore || role === "leader" || role === "supervisor";
  const isContributor = isLeader || role === "contributor" || role === "technician" || role === "staff";
  const isLearning = !!user;

  // Quyền hạn theo phân cấp 5 role
  const canManageStaff = isCore; // Admin & Core có toàn quyền quản lý nhân sự
  const canManageSchedule = isLeader; // Admin, Core & Leader có quyền phân và duyệt ca
  const canManageTasks = isLeader; // Admin, Core & Leader có quyền tạo và điều phối nhiệm vụ

  // Alias tương thích ngược
  const isManager = isCore;
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
      loading, 
      updateCurrentUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
