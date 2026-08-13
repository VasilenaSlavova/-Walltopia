import { NavLink } from "react-router-dom";
import { useAuth } from "../auth";

const links = [
  { to: "/", label: "Load Calculator", end: true },
  { to: "/dashboard", label: "My Projects" },
  { href: "/technical-documentation.html", label: "Technical Documentation" },
  { href: "/ask-engineer.html", label: "Engineering Support" },
];

export default function Masthead() {
  const { user, openAuth, logout } = useAuth();
  return (
    <header className="masthead">
      <div className="wrap">
        <NavLink to="/" className="brand">
          <img className="logo" src="/assets/walltopia-logo-white.svg" alt="Walltopia" />
          <span className="tag">Preliminary&nbsp;<b>Loads</b></span>
        </NavLink>
        <div className="spacer" />
        <nav className="topnav" aria-label="Primary">
          {links.map((l) => (
            l.href ? (
              <a key={l.href} href={l.href}>{l.label}</a>
            ) : (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : "")}>
                {l.label}
              </NavLink>
            )
          ))}
        </nav>
        <div id="auth-slot">
          {user ? (
            <div className="auth-user">
              <NavLink to="/dashboard" className="auth-name" title={user.email}>
                <span className="auth-avatar">{(user.name || "?").trim().charAt(0).toUpperCase()}</span>
                {user.name}
              </NavLink>
              <button className="auth-btn ghost" onClick={logout}>Log out</button>
            </div>
          ) : (
            <>
              <button className="auth-btn ghost" onClick={() => openAuth("login")}>Log in</button>
              <button className="auth-btn solid" onClick={() => openAuth("register")}>Register</button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
