import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("gak_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => {
        setUser(r.data);
        localStorage.setItem("gak_user", JSON.stringify(r.data));
      })
      .catch((err) => {
        if (err.response && err.response.status === 401) {
          localStorage.removeItem("gak_token");
          localStorage.removeItem("gak_user");
        } else {
          // offline / network error -> keep session from cached user
          const cached = localStorage.getItem("gak_user");
          if (cached) setUser(JSON.parse(cached));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("gak_token", data.token);
    localStorage.setItem("gak_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("gak_token");
    localStorage.removeItem("gak_user");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
