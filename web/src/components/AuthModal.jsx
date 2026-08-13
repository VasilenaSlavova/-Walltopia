import { useState } from "react";

export default function AuthModal({ mode: initial, onClose, onLogin, onRegister }) {
  const [mode, setMode] = useState(initial);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reg = mode === "register";
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (reg) await onRegister(form.name.trim(), form.email.trim(), form.password);
      else await onLogin(form.email.trim(), form.password);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wt-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wt-modal" role="dialog" aria-modal="true">
        <button className="wt-modal-close" aria-label="Close" onClick={onClose}>&times;</button>
        <div className="wt-tabs" role="tablist">
          <button type="button" aria-selected={!reg} onClick={() => setMode("login")}>Log in</button>
          <button type="button" aria-selected={reg} onClick={() => setMode("register")}>Register</button>
        </div>
        <h2 className="wt-modal-title">{reg ? "Create your account" : "Welcome back"}</h2>
        <form onSubmit={submit} noValidate>
          {reg && (
            <label className="wt-field"><span>Name</span>
              <input value={form.name} onChange={set("name")} autoComplete="name" /></label>
          )}
          <label className="wt-field"><span>Email</span>
            <input type="email" value={form.email} onChange={set("email")} autoComplete="email" /></label>
          <label className="wt-field"><span>Password</span>
            <input type="password" value={form.password} onChange={set("password")} autoComplete={reg ? "new-password" : "current-password"} /></label>
          {error && <p className="wt-error">{error}</p>}
          <button type="submit" className="wt-submit" disabled={busy}>{busy ? "Please wait…" : reg ? "Create account" : "Log in"}</button>
          <p className="wt-switch">
            {reg ? "Already have an account? " : "New here? "}
            <a href="#" onClick={(e) => { e.preventDefault(); setMode(reg ? "login" : "register"); }}>{reg ? "Log in" : "Create an account"}</a>
          </p>
        </form>
      </div>
    </div>
  );
}
