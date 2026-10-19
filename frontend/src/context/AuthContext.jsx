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

  // 5 Chuẩn Role theo phân cấp: Admin > Core > Leader > Contributor > Learning
    const role = user?.role || "contributor";
  const isAdmin = role === "admin";
  const isManagerRole = role === "manager" || role === "quan_ly";
  const isCore = isAdmin || isManagerRole || role === "core";
  const isLeader = isCore || role === "leader" || role === "supervisor";
  const isContributor = isLeader || role === "contributor" || role === "technician" || role === "staff";
  const isLearning = !!user;

  // Quyen han thuc te theo Database: Admin & Manager luon co quyen toi cao, hoac quyen theo vai tro role
  const canManageStaff = isAdmin || isManagerRole || (user?.can_manage_staff !== undefined ? Boolean(user.can_manage_staff) : isCore);
  const canManageSchedule = isAdmin || isManagerRole || (user?.can_manage_schedule !== undefined ? Boolean(user.can_manage_schedule) : isLeader);
  const canManageTasks = isAdmin || isManagerRole || (user?.can_manage_tasks !== undefined ? Boolean(user.can_manage_tasks) : isLeader);
  const canEvaluate = isAdmin || isManagerRole || (user?.can_evaluate !== undefined ? Boolean(user.can_evaluate) : (isCore || isLeader));

  // Alias tuong thich
  const isManager = isCore || isManagerRole;
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
