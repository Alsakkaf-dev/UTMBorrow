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

