import { Link, NavLink, useNavigate } from "react-router-dom";
import { Camera, LayoutDashboard, LogOut, Menu, ShieldCheck } from "lucide-react";
import { clearSession, currentUser } from "../lib/api";

export default function Shell({ children }) {
  const user = currentUser();
  const navigate = useNavigate();
  const links = user
    ? [
        ["Dashboard", "/dashboard", LayoutDashboard],
        ["Settings", "/settings", ShieldCheck],
        ...(user.role === "admin" ? [["Admin", "/admin", ShieldCheck]] : [])
      ]
    : [];

  return (
    <div className="min-h-screen bg-sand text-navy">
      <header className="sticky top-0 z-40 border-b border-borderline bg-white/95 backdrop-blur">
        <div className="page-shell flex items-center justify-between gap-3 py-3">
          <Link to="/" className="flex min-w-0 items-center gap-2 font-black text-primary">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-skysoft">
              <Camera size={22} />
            </span>
            <span className="truncate text-lg">Travel Share</span>
          </Link>
          <nav className="hidden min-w-0 items-center gap-2 md:flex">
            {links.map(([label, href, Icon]) => (
              <NavLink key={href} to={href} className="btn-ghost">
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <button
                className="btn-ghost"
                onClick={() => {
                  clearSession();
                  navigate("/");
                }}
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Log out</span>
              </button>
            ) : (
              <>
                <Link className="btn-ghost" to="/login">Login</Link>
                <Link className="btn-primary" to="/signup">Sign up</Link>
              </>
            )}
            <Menu className="md:hidden" size={22} />
          </div>
        </div>
        {user && (
          <div className="page-shell flex gap-2 overflow-x-auto py-2 md:hidden">
            {links.map(([label, href, Icon]) => (
              <NavLink key={href} to={href} className="btn-ghost shrink-0">
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
