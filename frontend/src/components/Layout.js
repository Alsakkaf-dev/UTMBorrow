import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation, Outlet } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  House, HandArrowUp, SquaresFour, User, ShieldCheck, Bell, Check, X,
  ArrowRight,
} from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { humanizeType } from "../lib/format";
import { useRealtimeEvent, useRealtimeStatus } from "../lib/realtime";
import { IconButton, LiveDot, Avatar } from "./ui";
import RatingDialog from "./RatingDialog";
import { api } from "../lib/api";

/* ══════════════════ Notification Quick-Drawer ══════════════════ */
// Slide-in panel (from the right) showing the latest notifications; opened by the bell
function NotificationDrawer({ open, onClose }) {
  const [items, setItems] = useState([]);
  const { refreshUnread } = useAuth();
  const navigate          = useNavigate();

  // Fetch the 12 most recent notifications
  const load = async () => {
    const { data } = await api.get("/notifications");
    setItems(data.notifications.slice(0, 12));
  };

  useEffect(() => { if (open) load(); }, [open]); // reload each time the drawer opens // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeEvent("notification.new", () => { if (open) load(); }); // live-refresh while open

  // Mark everything read, then refresh the list + the unread badge count
  const markAll = async () => {
    await api.post("/notifications/read-all");
    await load();
    refreshUnread();
  };
  // Mark a single notification read
  const markOne = async (id) => {
    await api.post(`/notifications/${id}/read`);
    await load();
    refreshUnread();
  };

  // Pick an icon-badge color based on the notification type
  const typeColor = (type) => {
    if (type === "RequestReceived" || type === "RequestCancelled")       return "bg-blue-50 text-blue-600";
    if (type === "RequestApproved" || type === "HandoverConfirmed" || type === "ReturnConfirmed") return "bg-emerald-50 text-emerald-600";
    if (type === "RequestRejected")                                       return "bg-red-50 text-red-500";
    if (type === "ReturnReminder" || type === "OverdueReminder")          return "bg-amber-50 text-amber-600";
    if (type === "RatingReceived")                                        return "bg-purple-50 text-purple-600";
    return "bg-brand-50 text-brand-600";
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[140]" data-testid="notification-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* the panel itself: slides in from the right edge */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className="absolute top-0 right-0 h-full w-full max-w-[92vw] sm:max-w-sm bg-surface flex flex-col shadow-pop"
          >
            {/* Header */}
            <div className="shrink-0 px-5 pt-5 pb-4 border-b border-line">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-head font-bold text-xl text-ink">Notifications</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={markAll}
                    data-testid="mark-all-read-btn"
                    className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 px-2.5 py-1.5 rounded-xl hover:bg-brand-50 transition-colors"
                  >
                    <Check size={13} weight="bold" /> Mark all
                  </button>
                  <IconButton onClick={onClose} label="Close" data-testid="close-notifications-btn" className="!w-8 !h-8 bg-canvas">
                    <X size={16} />
                  </IconButton>
                </div>
              </div>
              <p className="text-xs text-muted">Tap any notification to mark read</p>
            </div>

            {/* Notification list (or an empty state when there are none) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {items.length === 0 && (
                <div className="flex flex-col items-center text-center py-16 text-muted">
                  <div className="w-16 h-16 rounded-3xl bg-brand-50 text-brand-400 flex items-center justify-center mb-4 shadow-soft">
                    <Bell size={28} weight="fill" />
                  </div>
                  <p className="font-head font-semibold text-ink">All caught up!</p>
                  <p className="text-sm mt-1">No new notifications.</p>
                </div>
              )}
              {items.map((n, i) => (
                <motion.button
                  key={n.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.025 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => markOne(n.id)}
                  data-testid={`notification-${n.id}`}
                  // unread rows get a subtle brand-tinted background
                  className={`w-full text-left p-3.5 rounded-2xl border transition-colors ${
                    n.is_read
                      ? "border-line bg-surface"
                      : "border-brand-100 bg-brand-50/50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[14px] ${typeColor(n.notification_type)}`}>
                      {n.is_read ? "✓" : "●"} {/* ✓ read, ● unread */}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600">
                          {humanizeType(n.notification_type)}
                        </span>
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />}
                      </div>
                      <p className="text-[13px] text-ink leading-snug line-clamp-2">{n.message}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Footer: close the drawer and go to the full notifications page */}
            <div className="shrink-0 border-t border-line px-5 py-4">
              <button
                onClick={() => { onClose(); navigate("/notifications"); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-50 text-brand-700 text-sm font-bold hover:bg-brand-100 transition-colors"
              >
                View all notifications <ArrowRight size={15} weight="bold" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}


/* ══════════════════ Bottom Navigation ══════════════════ */
// Floating mobile tab bar; `tabs` = [{ to, label, icon, badge? }]
function BottomNav({ tabs }) {
  return (
    <nav
      className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-50"
      aria-label="Main navigation"
    >
      {/* Glass pill container */}
      <div className="glass border border-white/50 shadow-pop rounded-full h-[62px] flex items-center justify-around px-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            data-testid={`tab-${t.label.toLowerCase()}`}
            className="relative flex-1"
          >
            {({ isActive }) => (
              <div className="relative flex flex-col items-center justify-center gap-0.5 h-12 py-1.5">
                {/* Active pill background — shared layoutId animates it sliding between tabs */}
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 bg-brand-gradient rounded-full shadow-glow-sm"
                  />
                )}

                {/* Icon + label */}
                <span className={`relative z-10 flex flex-col items-center gap-0.5 transition-colors duration-200 ${
                  isActive ? "text-white" : "text-slate-400 hover:text-slate-600"
                }`}>
                  <t.icon size={22} weight={isActive ? "fill" : "regular"} />
                  <span className="text-[10px] font-bold leading-none">{t.label}</span>
                </span>

                {/* Unread badge (only when this tab has a count); caps at "9+" */}
                <AnimatePresence>
                  {t.badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      data-testid="nav-unread-badge"
                      className="absolute top-0.5 left-1/2 translate-x-2 min-w-[18px] h-[18px] px-1 bg-status-cancelled text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white z-20"
                    >
                      {t.badge > 9 ? "9+" : t.badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

