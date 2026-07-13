import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CalendarDays, Camera, CheckSquare, Compass, Globe2, Images, LayoutDashboard, LogOut, Map, Menu, QrCode, ShieldCheck, Share2, ShoppingBag, Sparkles, UserCircle, X, ChevronsLeft, ChevronsRight } from "lucide-react";
import { api, clearSession, currentUser } from "../lib/api";
import { LANGUAGES, useLanguage } from "../lib/i18n";
import { getTheme, setTheme } from "../lib/theme.js";
import ThemeToggleButton from "./ThemeToggleButton";
import { useState, useRef, useEffect } from "react";
import { APP_NAME } from "../lib/appConfig.js";
const SIDEBAR_KEY = "travelShareSidebarCollapsed";

function translatedRole(role, t) {
  const roles = {
    admin: t("shell.roles.admin"),
    guest: t("shell.roles.guest"),
    organizer: t("shell.roles.organizer"),
    platform_admin: t("shell.roles.platformAdmin"),
    tourist: t("shell.roles.tourist"),
    user: t("shell.roles.user")
  };
  return roles[role] || t("shell.roles.user");
}

function translatedNotificationType(type, t) {
  const types = {
    error: t("shell.notificationTypes.error"),
    info: t("shell.notificationTypes.info"),
    success: t("shell.notificationTypes.success"),
    warning: t("shell.notificationTypes.warning")
  };
  return types[type] || t("shell.notificationTitleFallback", "Update");
}

export default function Shell({ children }) {
  const [user, setUser] = useState(currentUser());
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const isAdmin = ["admin", "platform_admin"].includes(user?.role);
  const isOrganizer = ["organizer", "admin", "platform_admin"].includes(user?.role);
  const isGuest = user?.role === "guest";
  const links = user
    ? [
        [t("nav.dashboard", "Dashboard"), "/dashboard", LayoutDashboard],
        [t("nav.tourist", "Tourist"), "/tourist", Compass],
        ...(!isGuest ? [[t("nav.trips", "Trips"), "/trips", Map]] : []),
        [t("nav.map", "Map"), "/map", Map],
        [t("nav.events", "Events"), "/events", CalendarDays],
        ...(!isGuest ? [[t("nav.qrSpaces", "QR Spaces"), "/qr-spaces", QrCode]] : []),
        [t("nav.scan", "Scan QR"), "/scan", QrCode],
        ...(!isGuest ? [[t("nav.myUploads", "My Memories"), "/my-uploads", Images]] : []),
        ...(!isGuest ? [[t("nav.approvals", "Approvals"), "/approvals", CheckSquare]] : []),
        ...(!isGuest ? [[t("nav.sharedAlbums", "Shared Albums"), "/shared-albums", Share2]] : []),
        [t("nav.store", "Store"), "/store", ShoppingBag],
        [t("nav.settings", "Settings"), "/settings", ShieldCheck],
        ...(isAdmin ? [[t("nav.admin", "Admin"), "/admin", ShieldCheck]] : [])
      ]
    : [];

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState(null);
  const [notificationsSupported, setNotificationsSupported] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [remoteUnreadCount, setRemoteUnreadCount] = useState(0);
  const [theme, setThemeState] = useState(getTheme() || "light");
  const [langOpen, setLangOpen] = useState(false);
  const [mobileLangOpen, setMobileLangOpen] = useState(false);
  const firstLinkRef = useRef(null);
  const notificationsButtonRef = useRef(null);
  const notificationsPanelRef = useRef(null);
  const mobileNotificationsButtonRef = useRef(null);
  const mobileNotificationsPanelRef = useRef(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_KEY);
      if (v !== null) setCollapsed(v === "true");
    } catch (err) {}
  }, []);

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

  useEffect(() => {
    // fetch unread count for badge only when the user is authenticated
    let mounted = true;
    async function loadUnread() {
      try {
        const d = await api("/api/notifications/unread-count");
        if (mounted && typeof d.count === "number") setRemoteUnreadCount(d.count);
      } catch (err) {
        // ignore errors here; badge will be 0
      }
    }
    if (!user || user.role === "guest") return;
    loadUnread();
    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    if (!notificationsOpen || !user || user.role === "guest") return;
    async function loadNotifications() {
      setNotificationsLoading(true);
      setNotificationsError(null);
      try {
        const data = await api("/api/notifications");
        const list = Array.isArray(data.notifications)
          ? data.notifications
          : Array.isArray(data)
          ? data
          : [];
        setNotifications(list);
        // sync remote unread count from response
        try {
          const unread = Array.isArray(list) ? list.filter((n) => !n.read).length : 0;
          setRemoteUnreadCount(unread);
        } catch (err) {}
        setNotificationsSupported(true);
      } catch (err) {
        const message = err?.message || "Unable to load notifications.";
        if (
          message.toLowerCase().includes("404") ||
          message.toLowerCase().includes("not found") ||
          message.toLowerCase().includes("unexpected token") ||
          message.toLowerCase().includes("not enabled")
        ) {
          setNotificationsSupported(false);
        } else {
          setNotificationsError(true);
        }
      } finally {
        setNotificationsLoading(false);
      }
    }
    loadNotifications();
  }, [notificationsOpen]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const badgeCount = remoteUnreadCount || unreadCount || 0;

  useEffect(() => {
    if (!notificationsOpen) return;
    function onClick(event) {
      const panels = [notificationsPanelRef.current, mobileNotificationsPanelRef.current].filter(Boolean);
      const triggers = [notificationsButtonRef.current, mobileNotificationsButtonRef.current].filter(Boolean);
      const clickedPanel = panels.some((panel) => panel.contains(event.target));
      const clickedTrigger = triggers.some((trigger) => trigger.contains(event.target));
      if (!clickedPanel && !clickedTrigger) {
        setNotificationsOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === "Escape") setNotificationsOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    function onStoredUserChange() {
      setUser(currentUser());
    }
    window.addEventListener("travelShareUserChanged", onStoredUserChange);
    return () => window.removeEventListener("travelShareUserChanged", onStoredUserChange);
  }, []);

  useEffect(() => {
    function onThemeChanged(event) {
      setThemeState(event?.detail?.theme || getTheme() || "light");
    }
    window.addEventListener("travelShareThemeChanged", onThemeChanged);
    return () => window.removeEventListener("travelShareThemeChanged", onThemeChanged);
  }, []);

  return (
    <div className="min-h-screen bg-sand text-navy">
      {user ? (
        <div className={`grid min-h-screen ${collapsed ? 'lg:grid-cols-[84px_1fr]' : 'lg:grid-cols-[284px_1fr]'}`}>
          <aside className={`shell-desktop-sidebar border-r border-borderline sidebar-shell ${collapsed ? 'collapsed' : ''} sticky top-0 h-screen overflow-hidden relative`}>
            <div style={{ height: 96 }} />
            <button
              aria-label={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
              title={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
              className="sidebar-collapse-button hidden lg:inline-flex btn-ghost"
              onClick={() => {
                const next = !collapsed;
                setCollapsed(next);
                try {
                  localStorage.setItem(SIDEBAR_KEY, next ? "true" : "false");
                } catch (err) {}
              }}
            >
              {collapsed ? <ChevronsRight size={32} /> : <ChevronsLeft size={32} />}
            </button>
            <nav className="flex flex-1 flex-col gap-2 px-4 overflow-y-auto">
              {links.map(([label, href, Icon]) => (
                <NavLink
                  key={href}
                  to={href}
                  title={label}
                  aria-label={label}
                  className={({ isActive }) => (isActive ? "side-link side-link-active" : "side-link")}
                >
                  <Icon size={19} aria-hidden="true" />
                  <span className="link-label">{label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="m-4 rounded-lg border border-borderline bg-skysoft p-3 user-card">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary"><UserCircle size={20} /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold user-name">{user.name}</p>
                  <p className="truncate text-xs capitalize text-slatebody user-role">{translatedRole(user.role, t)}</p>
                  {isGuest && user.guestSession?.status ? (
                    <p className="truncate text-xs text-primary mt-1">
                      {user.guestSession.status === "active"
                        ? t("guestStatus.activeGuest", "Active Guest")
                        : user.guestSession.status === "grace"
                        ? t("guestStatus.graceGuest", "Grace Period")
                        : t("guestStatus.expiredGuest", "Expired Guest")}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                className="btn-ghost mt-3 w-full"
                onClick={() => {
                  clearSession();
                  navigate(isGuest ? "/guest" : "/login");
                }}
              >
                <LogOut size={18} /> {t('shell.signOut', 'Sign out')}
              </button>
            </div>
          </aside>
          <div className="min-w-0">
            {/* Desktop topbar; mobile uses the single compact topbar below. */}
            <header className="shell-desktop-topbar app-topbar app-topbar-shell sticky top-0 z-40 border-b border-borderline bg-sand">
              <div className="page-shell flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <Link to="/dashboard" className="flex min-w-0 items-center gap-2 font-serif text-xl font-black text-primary">
                    <Compass size={22} />
                    <span className="truncate">{APP_NAME}</span>
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  {/* notifications dropdown */}
                  <div className="relative">
                    <button
                      ref={notificationsButtonRef}
                      className="btn-ghost topbar-icon-button notification-trigger relative h-10 w-10 flex items-center justify-center rounded-xl"
                      aria-haspopup="dialog"
                      aria-expanded={notificationsOpen}
                      aria-label={t("nav.notifications")}
                      title={t("nav.notifications")}
                      onClick={() => setNotificationsOpen((open) => !open)}
                    >
                      <Bell className="topbar-bell-icon" size={18} strokeWidth={2.25} fill="none" aria-hidden="true" />
                      {unreadCount > 0 ? (
                        <span className="notification-badge">{badgeCount > 9 ? "9+" : badgeCount}</span>
                      ) : null}
                    </button>
                    {notificationsOpen && (
                      <div ref={notificationsPanelRef} className="notifications-panel">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('shell.notifications', t("nav.notifications"))}</p>
                            <p className="mt-1 text-xs text-slatebody">{t('shell.latestUpdates', 'Latest account updates')}</p>
                          </div>
                          <button className="btn-ghost notifications-close" type="button" onClick={() => setNotificationsOpen(false)}>
                            {t('shell.close', 'Close')}
                          </button>
                        </div>
                        <div className="mt-4 space-y-3">
                          {notificationsLoading ? (
                            <div className="notifications-body">{t('shell.loadingNotifications', 'Loading notifications…')}</div>
                          ) : notificationsError ? (
                            <div className="notifications-body notifications-error">
                              <p className="font-semibold">{t('shell.unableToLoadNotifications', 'Unable to load notifications')}</p>
                              <p className="mt-2 text-sm">{t("shell.notificationLoadErrorDetail")}</p>
                              <button className="btn-primary mt-3 w-full" onClick={() => setNotificationsOpen(false)}>{t('shell.close', 'Close')}</button>
                            </div>
                          ) : !notificationsSupported ? (
                            <div className="notifications-body notifications-empty">
                              <div className="flex items-start gap-3">
                                <span className="empty-icon" aria-hidden>
                                  <Bell size={24} />
                                </span>
                                <div>
                                  <p className="font-semibold">{t('shell.setupPending', 'Notifications setup pending.')}</p>
                                  <p className="mt-2 text-sm">{t('shell.setupPendingHelp', 'Run the latest database migration to enable notifications.')}</p>
                                </div>
                              </div>
                            </div>
                          ) : notifications.length === 0 ? (
                            <div className="notifications-body notifications-empty">
                              <div className="flex items-start gap-3">
                                <span className="empty-icon" aria-hidden>
                                  <Bell size={24} />
                                </span>
                                <div>
                                  <p className="font-semibold">{t('shell.noNotificationsYet', 'No notifications yet.')}</p>
                                  <p className="mt-2 text-sm">{t('shell.notificationsEmptyDescription', 'Updates about trips, events, uploads, and account activity will appear here.')}</p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-slatebody">{t('shell.showingLatestNotifications', 'Showing latest {count} notifications', { count: notifications.length })}</div>
                                {(badgeCount > 0) && (
                                  <button className="btn-ghost" onClick={async () => {
                                    try {
                                      await api('/api/notifications/read-all', { method: 'PATCH' });
                                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                                      setRemoteUnreadCount(0);
                                      } catch (err) {
                                        console.error('mark all read failed', err);
                                      }
                                  }}>{t('shell.markAllRead', 'Mark all read')}</button>
                                )}
                              </div>
                              {notifications.map((notification) => (
                                <div key={notification.id || notification.title} className={`notification-item rounded-3xl border p-3 ${notification.read ? 'notification-read' : 'notification-unread'}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                              <p className="text-sm font-semibold">{notification.title || translatedNotificationType(notification.type, t)}</p>
                                      <p className="mt-1 text-sm leading-6 text-slatebody">{notification.message || notification.body || t('shell.notificationFallback', 'A notification has arrived.')}</p>
                                      {notification.createdAt && <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{new Date(notification.createdAt).toLocaleString(language)}</p>}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                      {notification.targetUrl ? (
                                         <a className="btn-ghost" href={notification.targetUrl}>{t('shell.open', 'Open')}</a>
                                      ) : null}
                                      {!notification.read ? (
                                         <button className="btn-ghost" onClick={async () => {
                                          try {
                                            await api(`/api/notifications/${notification.id}/read`, { method: 'PATCH' });
                                            setNotifications((prev) => prev.map((p) => p.id === notification.id ? { ...p, read: true } : p));
                                            setRemoteUnreadCount((c) => Math.max(0, (c || 0) - 1));
                                          } catch (err) {
                                            console.error('mark read failed', err);
                                          }
                                        }}>{t('shell.markRead', 'Mark read')}</button>
                                         ) : (
                                         <div className="text-xs text-slatebody">{t('shell.read', 'Read')}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <ThemeToggleButton />

                  {/* language globe dropdown */}
                  <div className="relative">
                    <button className="btn-ghost topbar-icon-button language-trigger h-10 w-10 flex items-center justify-center rounded-xl" aria-haspopup="menu" aria-expanded={langOpen} onClick={() => setLangOpen((s) => !s)} aria-label={t('shell.changeLanguage', 'Change language')} title={t('shell.changeLanguage', 'Change language')}>
                      <Globe2
                        className="topbar-globe-icon"
                        size={18}
                        strokeWidth={2.25}
                        aria-hidden="true"
                      />
                    </button>
                    {langOpen && (
                      <div className="lang-menu">
                        {LANGUAGES.map(([code, label]) => (
                          <button
                            key={code}
                            className={`lang-option ${language === code ? 'lang-option-active' : ''}`}
                            onClick={() => { setLanguage(code); setLangOpen(false); }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* user avatar and name */}
                  <div className="flex items-center gap-2 px-2 py-1">
                    <div className="h-8 w-8 rounded-full bg-ocean/10 flex items-center justify-center text-ocean font-bold">{(user?.name || 'U').charAt(0).toUpperCase()}</div>
                    <div className="hidden md:block min-w-0">
                      <div className="truncate font-semibold topbar-user-name">{user?.name}</div>
                      <div className="truncate text-xs text-slatebody topbar-user-role">{translatedRole(user?.role, t)}</div>
                    </div>
                    <button className="btn-ghost" onClick={() => { clearSession(); navigate('/login'); }}>{t('shell.signOut', 'Sign out')}</button>
                  </div>
                </div>
              </div>
            </header>
            <header className="shell-mobile-topbar app-topbar app-topbar-shell sticky top-0 z-40 border-b border-borderline bg-sand">
              <div className="flex items-center justify-between gap-2 px-3 py-3">
                <Link to="/dashboard" className="flex min-w-0 items-center gap-1.5 font-serif text-lg font-black text-primary">
                  <Compass size={22} />
                  <span className="truncate">{APP_NAME}</span>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <div className="relative">
                    <button
                      ref={mobileNotificationsButtonRef}
                      className="btn-ghost topbar-icon-button notification-trigger relative h-10 w-10 flex items-center justify-center rounded-xl"
                      aria-haspopup="dialog"
                      aria-expanded={notificationsOpen}
                      aria-label={t("nav.notifications")}
                      title={t("nav.notifications")}
                      onClick={() => setNotificationsOpen((open) => !open)}
                    >
                      <Bell className="topbar-bell-icon" size={18} strokeWidth={2.25} fill="none" aria-hidden="true" />
                      {badgeCount > 0 ? (
                        <span className="notification-badge">{badgeCount > 9 ? "9+" : badgeCount}</span>
                      ) : null}
                    </button>
                    {notificationsOpen && (
                      <div ref={mobileNotificationsPanelRef} className="notifications-panel">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('shell.notifications', t("nav.notifications"))}</p>
                            <p className="mt-1 text-xs text-slatebody">{t('shell.latestUpdates', 'Latest account updates')}</p>
                          </div>
                          <button className="btn-ghost notifications-close" type="button" onClick={() => setNotificationsOpen(false)}>
                            {t('shell.close', 'Close')}
                          </button>
                        </div>
                        <div className="mt-4 space-y-3">
                          {notificationsLoading ? (
                            <div className="notifications-body">{t('shell.loadingNotifications', 'Loading notifications…')}</div>
                          ) : notificationsError ? (
                            <div className="notifications-body notifications-error">{t('shell.unableToLoadNotifications', 'Unable to load notifications')}</div>
                          ) : !notificationsSupported ? (
                            <div className="notifications-body notifications-empty">{t('shell.setupPending', 'Notifications setup pending.')}</div>
                          ) : notifications.length === 0 ? (
                            <div className="notifications-body notifications-empty">{t('shell.noNotificationsYet', 'No notifications yet.')}</div>
                          ) : (
                            notifications.map((notification) => (
                              <div key={notification.id || notification.title} className={`notification-item rounded-3xl border p-3 ${notification.read ? 'notification-read' : 'notification-unread'}`}>
                                <p className="text-sm font-semibold">{notification.title || translatedNotificationType(notification.type, t)}</p>
                                <p className="mt-1 text-sm leading-6 text-slatebody">{notification.message || notification.body || t('shell.notificationFallback', 'A notification has arrived.')}</p>
                                {notification.targetUrl ? <a className="btn-ghost mt-2" href={notification.targetUrl}>{t('shell.open', 'Open')}</a> : null}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <ThemeToggleButton />
                  <div className="relative">
                    <button
                      className="btn-ghost topbar-icon-button language-trigger h-10 w-10 flex items-center justify-center rounded-xl"
                      aria-haspopup="menu"
                      aria-expanded={mobileLangOpen}
                      onClick={() => setMobileLangOpen((open) => !open)}
                      aria-label={t('shell.changeLanguage', 'Change language')}
                      title={t('shell.changeLanguage', 'Change language')}
                    >
                      <Globe2 className="topbar-globe-icon" size={18} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                    {mobileLangOpen && (
                      <div className="lang-menu">
                        {LANGUAGES.map(([code, label]) => (
                          <button
                            key={code}
                            className={`lang-option ${language === code ? 'lang-option-active' : ''}`}
                            onClick={() => { setLanguage(code); setMobileLangOpen(false); }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button aria-label={t('shell.openMenu', 'Open menu')} className="mobile-menu-button btn-ghost topbar-icon-button h-10 w-10 rounded-xl" onClick={() => setDrawerOpen(true)}><Menu size={22} /></button>
                </div>
              </div>
            </header>
            {children}

            {/* Mobile drawer overlay */}
            {drawerOpen && (
              <div className="shell-mobile-drawer fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
                  <aside className="shell-mobile-drawer-panel relative h-full w-72 max-w-[calc(100vw-2rem)] overflow-y-auto bg-panel p-4" role="dialog" aria-modal="true" aria-label={t("hardcoded.navigationMenu")}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Compass size={20} />
                      <span className="font-serif text-lg font-black">{APP_NAME}</span>
                    </div>
                    <button className="btn-ghost" onClick={() => setDrawerOpen(false)} aria-label={t('shell.closeMenu', 'Close menu')}><X size={18} /></button>
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
                        <p className="truncate text-xs capitalize text-slatebody">{translatedRole(user.role, t)}</p>
                        <button className="btn-ghost mt-3 w-full" onClick={() => { clearSession(); setDrawerOpen(false); navigate(isGuest ? '/guest' : '/login'); }}><LogOut size={18} /> {t('shell.signOut', 'Sign out')}</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Link className="btn-ghost" to="/login" onClick={() => setDrawerOpen(false)}>{t('shell.login', 'Login')}</Link>
                        <Link className="btn-primary btn-signup" to="/signup" onClick={() => setDrawerOpen(false)}>{t('shell.signUp', 'Sign up')}</Link>
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
          <header className="app-topbar app-topbar-shell sticky top-0 z-40 border-b border-borderline bg-sand">
            <div className="page-shell flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {location.pathname !== "/" && !location.pathname.startsWith("/dashboard") && (
                  <button className="btn-ghost shrink-0" onClick={() => navigate(-1)} aria-label={t('shell.goBack', 'Go back')}><ArrowLeft size={17} /> {t('shell.back', 'Back')}</button>
                )}
                <Link to="/" className="flex min-w-0 items-center gap-2 font-serif text-xl font-black text-primary">
                  <Camera size={22} />
                  <span className="truncate">{APP_NAME}</span>
                </Link>
              </div>
                <div className="flex items-center gap-2">
                  <ThemeToggleButton />
                  <div className="relative">
                      <button className="btn-ghost topbar-icon-button language-trigger h-10 w-10 flex items-center justify-center rounded-xl" aria-haspopup="menu" aria-expanded={langOpen} onClick={() => setLangOpen((s) => !s)} aria-label={t('shell.changeLanguage', 'Change language')} title={t('shell.changeLanguage', 'Change language')}>
                        <Globe2
                          className="topbar-globe-icon"
                          size={18}
                          strokeWidth={2.25}
                          aria-hidden="true"
                        />
                      </button>
                      {langOpen && (
                        <div className="lang-menu">
                          {LANGUAGES.map(([code, label]) => (
                            <button
                              key={code}
                              className={`lang-option ${language === code ? 'lang-option-active' : ''}`}
                              onClick={() => { setLanguage(code); setLangOpen(false); }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Link className="btn-ghost" to="/login">{t('shell.login', 'Login')}</Link>
                    <Link className="btn-primary btn-signup" to="/signup">{t('shell.signUp', 'Sign up')}</Link>
              </div>
            </div>
          </header>
          {children}
        </>
      )}
    </div>
  );
}
