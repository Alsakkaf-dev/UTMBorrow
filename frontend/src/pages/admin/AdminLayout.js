import React, { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gauge, ArrowsLeftRight, Clock, UsersThree, QrCode, ClipboardText, Flag,
  SignOut, Bell, DotsThreeOutline, Lock, CaretRight, UserCircle,
  ChartLine, MagnifyingGlass, CaretDoubleLeft, CaretDoubleRight,
} from "@phosphor-icons/react";
import { adminApi, setAdminToken } from "../../lib/api";
import { PageLoader, Avatar, IconButton, Modal } from "../../components/ui";
import { useRealtimeStatus } from "../../lib/realtime";
import { useAuth } from "../../context/AuthContext";
import AdminElevate from "./AdminElevate";
import AdminCommandPalette from "./AdminCommandPalette";

// ─── Navigation config ───────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Monitoring",
    items: [
      { to: "/admin",            label: "Overview",     icon: Gauge,            end: true },
      { to: "/admin/analytics",  label: "Analytics",    icon: ChartLine },
    ],
  },
  {
    label: "Oversight",
    items: [
      { to: "/admin/transactions", label: "Transactions", icon: ArrowsLeftRight },
      { to: "/admin/overdue",      label: "Overdue",      icon: Clock },
      { to: "/admin/reports",      label: "Reports",      icon: Flag },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/users",  label: "Users",  icon: UsersThree },
      { to: "/admin/inbox",  label: "Inbox",  icon: Bell },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/scan",  label: "Desk Scan",  icon: QrCode },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/audit", label: "Audit Log", icon: ClipboardText },
    ],
  },
];

// Mobile bottom-nav primary tabs (max 4 + more)
const PRIMARY_MOBILE = [
  { to: "/admin",              label: "Overview", icon: Gauge,            end: true },
  { to: "/admin/inbox",        label: "Inbox",    icon: Bell },
  { to: "/admin/transactions", label: "Deals",    icon: ArrowsLeftRight },
  { to: "/admin/users",        label: "Users",    icon: UsersThree },
];

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

function Sidebar({ session, onLock, onLogout, collapsed, onToggle }) {
  const navigate = useNavigate();
  return (
    <aside
      className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-surface border-r border-line shadow-soft z-40 transition-all duration-300 ${collapsed ? "w-[68px]" : "w-56"}`}
    >
      {/* Logo row */}
      <div className={`flex items-center h-16 border-b border-line px-4 ${collapsed ? "justify-center" : "justify-between"}`}>
        {!collapsed && (
          <span className="font-head font-extrabold text-[15px] tracking-tight text-ink">
            UTM<span className="text-brand-600">Borrow</span>
            <span className="ml-1.5 text-[10px] font-bold text-muted bg-canvas px-1.5 py-0.5 rounded-full border border-line">Admin</span>
          </span>
        )}
        <button
          onClick={onToggle}
          className="w-7 h-7 rounded-lg hover:bg-brand-50 text-muted hover:text-brand-600 flex items-center justify-center transition-colors shrink-0"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <CaretDoubleRight size={14} weight="bold" /> : <CaretDoubleLeft size={14} weight="bold" />}
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted/70">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  data-testid={`sidebar-${item.label.toLowerCase().replace(/ /g, "-")}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all group ${
                      isActive
                        ? "bg-brand-gradient text-white shadow-glow-sm"
                        : "text-muted hover:text-ink hover:bg-brand-50/60"
                    } ${collapsed ? "justify-center" : ""}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} weight={isActive ? "fill" : "regular"} className="shrink-0" />
                      {!collapsed && (
                        <span className="text-sm font-semibold truncate">{item.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Account section */}
      <div className={`border-t border-line py-3 px-2 space-y-0.5 ${collapsed ? "" : ""}`}>
        <button
          onClick={() => navigate("/admin/profile")}
          data-testid="sidebar-profile"
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-muted hover:text-ink hover:bg-brand-50/60 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Profile" : undefined}
        >
          <UserCircle size={18} className="shrink-0" />
          {!collapsed && (
            <div className="min-w-0 text-left">
              <p className="text-sm font-semibold text-ink truncate">{session?.full_name || "Admin"}</p>
              <p className="text-[11px] text-muted truncate">{(session?.admin_role || "").replace(/_/g, " ")}</p>
            </div>
          )}
        </button>
        <button
          onClick={onLock}
          data-testid="sidebar-lock"
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-amber-600 hover:bg-amber-50 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Lock session" : undefined}
        >
          <Lock size={16} className="shrink-0" />
          {!collapsed && <span className="text-sm font-semibold">Lock session</span>}
        </button>
        <button
          onClick={onLogout}
          data-testid="sidebar-logout"
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Log out" : undefined}
        >
          <SignOut size={16} className="shrink-0" />
          {!collapsed && <span className="text-sm font-semibold">Log out</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── Mobile bottom nav ────────────────────────────────────────────────────────

function BottomNav({ onMore }) {
  return (
    <nav className="md:hidden fixed bottom-3 left-3 right-3 glass border border-white/40 shadow-pop rounded-full h-[60px] flex items-center justify-around z-50 px-1">
      {PRIMARY_MOBILE.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} data-testid={`admin-tab-${t.label.toLowerCase()}`} className="relative flex-1">
          {({ isActive }) => (
            <div className="relative flex flex-col items-center justify-center gap-0.5 h-11 py-1">
              {isActive && (
                <motion.span layoutId="admin-nav-pill" transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute inset-0 bg-brand-gradient rounded-full shadow-glow-sm" />
              )}
              <span className={`relative z-10 flex flex-col items-center gap-0.5 transition-colors ${isActive ? "text-white" : "text-slate-400"}`}>
                <t.icon size={20} weight={isActive ? "fill" : "regular"} />
                <span className="text-[9px] font-semibold leading-none">{t.label}</span>
              </span>
            </div>
          )}
        </NavLink>
      ))}
      <button onClick={onMore} data-testid="admin-tab-more" className="relative flex-1">
        <div className="relative flex flex-col items-center justify-center gap-0.5 h-11 py-1 text-slate-400">
          <DotsThreeOutline size={20} weight="regular" />
          <span className="text-[9px] font-semibold leading-none">More</span>
        </div>
      </button>
    </nav>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const rtStatus = useRealtimeStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [gate, setGate] = useState("checking");
  const [session, setSession] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    try {
      const { data } = await adminApi.get("/admin/session");
      if (!mounted.current) return;
      setSession(data);
      setGate("ready");
    } catch {
      if (mounted.current) setGate("locked");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    check();
    const onDeauth = () => mounted.current && setGate("locked");
    window.addEventListener("admin-deauth", onDeauth);
    return () => { mounted.current = false; window.removeEventListener("admin-deauth", onDeauth); };
  }, [check]);

  // Ctrl+K opens the command palette globally
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close "More" sheet on navigation
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const lock = useCallback(() => { setAdminToken(null); setGate("locked"); setSession(null); }, []);

  const fullLogout = useCallback(async () => {
    setAdminToken(null);
    await logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  const sidebarWidth = sidebarCollapsed ? "68px" : "224px";

  if (gate === "checking") return <PageLoader />;
  if (gate === "locked") return <AdminElevate onElevated={(d) => { setSession(d); setGate("ready"); }} />;

  return (
    <div className="min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <Sidebar
        session={session}
        onLock={lock}
        onLogout={fullLogout}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Main area — shifts right on desktop to make room for sidebar */}
      <div
        className="md:transition-all md:duration-300 flex flex-col min-h-screen"
        style={{ marginLeft: typeof window !== "undefined" && window.innerWidth >= 768 ? sidebarWidth : 0 }}
      >
        {/* Top header — mobile shows avatar; desktop shows search + session indicator */}
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur-sm border-b border-line">
          <div className="px-4 md:px-8 h-14 md:h-16 flex items-center justify-between gap-3">
            {/* Mobile: avatar/name */}
            <button
              onClick={() => navigate("/admin/profile")}
              data-testid="admin-profile-avatar"
              className="md:hidden flex items-center gap-2"
            >
              <Avatar name={session?.full_name || "Admin"} size={32} className="ring-2 ring-brand-100" />
              <div className="flex flex-col leading-none text-left">
                <span className="font-head font-bold text-[13px] tracking-tight text-ink leading-tight">{session?.full_name || "Admin"}</span>
                <span className="text-[10px] text-muted leading-tight mt-0.5">{(session?.admin_role || "").replace(/_/g, " ")}</span>
              </div>
            </button>

            {/* Desktop: page context title area */}
            <div className="hidden md:block" />

            {/* Right: search trigger + realtime dot + notifications */}
            <div className="flex items-center gap-2">
              {/* Ctrl+K search trigger */}
              <button
                onClick={() => setPaletteOpen(true)}
                data-testid="admin-search-trigger"
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas border border-line text-muted text-sm hover:border-brand-300 hover:text-ink transition-all"
              >
                <MagnifyingGlass size={15} />
                <span className="text-xs font-medium">Search…</span>
                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 bg-surface border border-line rounded-md">⌘K</span>
              </button>

              {/* Realtime status */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${rtStatus === "live" ? "bg-emerald-400" : "bg-slate-300"}`}
                title={`Realtime: ${rtStatus}`}
              />

              {/* Notifications bell */}
              <IconButton onClick={() => navigate("/admin/inbox")} label="Alerts inbox" data-testid="admin-notif-bell">
                <Bell size={20} weight="regular" />
              </IconButton>

              {/* Mobile search */}
              <IconButton onClick={() => setPaletteOpen(true)} label="Search" className="md:hidden">
                <MagnifyingGlass size={20} />
              </IconButton>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-8 py-4 md:py-6 pb-28 md:pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet context={{ refreshGate: check, lock, logout: fullLogout, session }} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav onMore={() => setMoreOpen(true)} />

      {/* Mobile "More" sheet — full-width items, comfortable touch targets */}
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More" testid="admin-more-sheet">
        <div className="space-y-1.5">
          <p className="label-eyebrow mb-1">Tools</p>
          {[
            { to: "/admin/overdue",   label: "Overdue",    icon: Clock },
            { to: "/admin/reports",   label: "Reports",    icon: Flag },
            { to: "/admin/scan",      label: "Desk Scan",  icon: QrCode },
            { to: "/admin/audit",     label: "Audit Log",  icon: ClipboardText },
            { to: "/admin/analytics", label: "Analytics",  icon: ChartLine },
          ].map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              data-testid={`admin-tab-${t.label.split(" ")[0].toLowerCase()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-3 rounded-2xl border transition-colors ${
                  isActive ? "border-brand-200 bg-brand-50/60 text-ink" : "border-line bg-surface text-ink hover:bg-slate-50"
                }`
              }
            >
              <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <t.icon size={18} weight="bold" />
              </span>
              <span className="font-semibold text-sm flex-1">{t.label}</span>
              <CaretRight size={15} className="text-slate-400" />
            </NavLink>
          ))}

          <p className="label-eyebrow mb-1 mt-4">Account</p>
          <button
            onClick={() => { setMoreOpen(false); navigate("/admin/profile"); }}
            data-testid="admin-more-profile"
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-line bg-surface text-ink hover:bg-slate-50 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><UserCircle size={18} weight="bold" /></span>
            <span className="font-semibold text-sm flex-1 text-left">My profile &amp; permissions</span>
            <CaretRight size={15} className="text-slate-400" />
          </button>
          <button
            onClick={lock}
            data-testid="admin-lock"
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-line bg-surface text-ink hover:bg-slate-50 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Lock size={18} weight="bold" /></span>
            <span className="font-semibold text-sm flex-1 text-left">Lock session</span>
            <span className="text-[11px] text-muted">Re-verify MFA</span>
          </button>
          <button
            onClick={fullLogout}
            data-testid="admin-logout"
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-red-100 bg-red-50/60 text-status-cancelled hover:bg-red-50 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-white text-status-cancelled flex items-center justify-center shrink-0"><SignOut size={18} weight="bold" /></span>
            <span className="font-semibold text-sm flex-1 text-left">Log out of UTM Borrow</span>
            <CaretRight size={15} className="text-status-cancelled/60" />
          </button>
        </div>
      </Modal>

      {/* Global command palette */}
      <AdminCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
