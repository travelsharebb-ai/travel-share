import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, Camera, Compass, LayoutDashboard, LogOut, Map, Menu, ShieldCheck, ShoppingBag, Sparkles, UserCircle, X } from "lucide-react";
import { clearSession, currentUser } from "../lib/api";
import { useState, useRef, useEffect } from "react";

export default function Shell({ children }) {
  const user = currentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = ["admin", "platform_admin"].includes(user?.role);
  const isOrganizer = ["organizer", "admin", "platform_admin"].includes(user?.role);
  const links = user
    ? [
        ["Dashboard", "/dashboard", LayoutDashboard],
        ["Tourist", "/tourist", Compass],
        ...(isOrganizer ? [["Events", "/events", CalendarDays]] : []),
        ["Store", "/store", ShoppingBag],
        ["Settings", "/settings", ShieldCheck],
        ...(isAdmin ? [["Admin", "/admin", ShieldCheck]] : [])
      ]
    : [];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const firstLinkRef = useRef(null);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    // focus first actionable element in drawer for accessibility
    requestAnimationFrame(() => firstLinkRef.current?.focus?.());
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen bg-sand text-navy">
      {user ? (
        <div className="grid min-h-screen lg:grid-cols-[284px_1fr]">
          <aside className="hidden border-r border-borderline bg-panel/80 lg:flex lg:flex-col">
            <Link to="/dashboard" className="flex items-center gap-3 px-6 py-7 text-primary">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
                <Compass size={22} />
              </span>
              <span className="font-serif text-2xl font-black">TravelShare</span>
            </Link>
            <nav className="flex flex-1 flex-col gap-2 px-4">
              {links.map(([label, href, Icon]) => (
                <NavLink key={href} to={href} className={({ isActive }) => isActive ? "side-link side-link-active" : "side-link"}>
                  <Icon size={19} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div className="m-4 rounded-lg border border-borderline bg-skysoft p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary"><UserCircle size={20} /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{user.name}</p>
                  <p className="truncate text-xs capitalize text-slatebody">{user.role.replace("_", " ")}</p>
                </div>
              </div>
              <button
                className="btn-ghost mt-3 w-full"
                onClick={() => {
                  clearSession();
                  navigate("/");
                }}
              >
                <LogOut size={18} /> Sign out
              </button>
            </div>
          </aside>
          <div className="min-w-0">
            <div className="hidden px-6 pt-4 lg:block">
              <button className="btn-ghost" onClick={() => navigate(-1)}><ArrowLeft size={18} /> Back</button>
            </div>
            <header className="sticky top-0 z-40 border-b border-borderline bg-sand/95 backdrop-blur lg:hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <Link to="/dashboard" className="flex min-w-0 items-center gap-2 font-serif text-xl font-black text-primary">
                  <Compass size={22} />
                  <span className="truncate">TravelShare</span>
                </Link>
                <button aria-label="Open menu" className="btn-ghost" onClick={() => setDrawerOpen(true)}><Menu size={22} /></button>
              </div>
            </header>
            {children}

            {/* Mobile drawer overlay */}
            {drawerOpen && (
              <div className="fixed inset-0 z-50 flex">
                <div className="fixed inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
                  <aside className="relative w-72 bg-panel p-4" role="dialog" aria-modal="true" aria-label="Navigation menu">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Compass size={20} />
                      <span className="font-serif text-lg font-black">TravelShare</span>
                    </div>
                    <button className="btn-ghost" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><X size={18} /></button>
                  </div>
                  <nav className="flex flex-col gap-2">
                    {links.map(([label, href, Icon], i) => (
                      <Link key={href} to={href} className="side-link" onClick={() => setDrawerOpen(false)} ref={i === 0 ? firstLinkRef : null}>
                        <Icon size={18} />
                        {label}
                      </Link>
                    ))}
                  </nav>
                  <div className="mt-4">
                    {user ? (
                      <div>
                        <p className="truncate text-sm font-bold">{user.name}</p>
                        <p className="truncate text-xs capitalize text-slatebody">{user.role.replace("_", " ")}</p>
                        <button className="btn-ghost mt-3 w-full" onClick={() => { clearSession(); setDrawerOpen(false); navigate('/'); }}><LogOut size={18} /> Sign out</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Link className="btn-ghost" to="/login" onClick={() => setDrawerOpen(false)}>Login</Link>
                        <Link className="btn-primary" to="/signup" onClick={() => setDrawerOpen(false)}><Sparkles size={18} /> Sign up</Link>
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <header className="sticky top-0 z-40 border-b border-borderline bg-sand/95 backdrop-blur">
            <div className="page-shell flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {location.pathname !== "/" && (
                  <button className="btn-ghost shrink-0" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft size={17} /> Back</button>
                )}
                <Link to="/" className="flex min-w-0 items-center gap-2 font-serif text-xl font-black text-primary">
                  <Camera size={22} />
                  <span className="truncate">TravelShare</span>
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <Link className="btn-ghost" to="/login">Login</Link>
                <Link className="btn-primary" to="/signup"><Sparkles size={18} /> Sign up</Link>
              </div>
            </div>
          </header>
          {children}
        </>
      )}
    </div>
  );
}
