import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { api } from "./api";
import AuthModal from "./components/AuthModal";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState({ open: false, mode: "login" });
  const pending = useRef([]);

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  const settle = useCallback((u) => {
    setUser(u);
    const waiters = pending.current; pending.current = [];
    waiters.forEach((p) => p.resolve(u));
    setModal((m) => ({ ...m, open: false }));
  }, []);

  const login = useCallback(async (email, password) => settle((await api.login(email, password)).user), [settle]);
  const register = useCallback(async (name, email, password) => settle((await api.register(name, email, password)).user), [settle]);
  const logout = useCallback(async () => { try { await api.logout(); } catch (e) {} setUser(null); }, []);

  const openAuth = useCallback((mode = "login") => setModal({ open: true, mode }), []);
  const closeAuth = useCallback(() => {
    setModal((m) => ({ ...m, open: false }));
    const waiters = pending.current; pending.current = [];
    waiters.forEach((p) => p.reject(new Error("cancelled")));
  }, []);

  const requireAuth = useCallback((mode = "login") => {
    if (user) return Promise.resolve(user);
    return new Promise((resolve, reject) => { pending.current.push({ resolve, reject }); setModal({ open: true, mode }); });
  }, [user]);

  const value = { user, ready, login, register, logout, openAuth, closeAuth, requireAuth };
  return (
    <AuthCtx.Provider value={value}>
      {children}
      {modal.open && <AuthModal mode={modal.mode} onClose={closeAuth} onLogin={login} onRegister={register} />}
    </AuthCtx.Provider>
  );
}
