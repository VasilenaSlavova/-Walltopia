import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, loadToken } from "./api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await loadToken();
      try { const r = await api.me(); setUser(r.user); } catch (e) { setUser(null); }
      setReady(true);
    })();
  }, []);

  const login = useCallback(async (email, password) => { const r = await api.login(email, password); setUser(r.user); return r.user; }, []);
  const register = useCallback(async (name, email, password) => { const r = await api.register(name, email, password); setUser(r.user); return r.user; }, []);
  const logout = useCallback(async () => { await api.logout(); setUser(null); }, []);

  return <AuthCtx.Provider value={{ user, ready, login, register, logout }}>{children}</AuthCtx.Provider>;
}
