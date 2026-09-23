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

  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
