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

/* ══════════════════ Top Header ══════════════════ */
// Sticky top bar: logo + live-connection dot on the left, bell + avatar on the right
function TopHeader({ user, unread, onBellClick }) {
  const navigate = useNavigate();
  const status   = useRealtimeStatus(); // realtime connection state for the LiveDot

  return (
    <header className="sticky top-0 z-40 glass-strong border-b border-line/60">
      <div className="max-w-2xl mx-auto px-5 h-16 flex items-center justify-between">
        {/* Logo (taps back to /home) */}
        <button
          onClick={() => navigate("/home")}
          className="flex items-center gap-2.5"
          data-testid="app-logo"
        >
          <motion.div
            whileTap={{ scale: 0.92 }}
            whileHover={{ rotate: [0, -4, 4, 0] }}
            transition={{ duration: 0.4 }}
            className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center shadow-glow-sm"
          >
            <span className="text-white font-head font-extrabold text-lg">U</span>
          </motion.div>
          <div className="flex flex-col leading-none">
            <span className="font-head font-extrabold text-[17px] tracking-tight text-ink">UTM Borrow</span>
            <LiveDot status={status} className="mt-0.5" />
          </div>
        </button>

        {/* Right side: Avatar + Bell */}
        <div className="flex items-center gap-1.5">
          {/* Notification bell */}
          <div className="relative">
            <IconButton
              onClick={onBellClick}
              label="Notifications"
              data-testid="notification-bell"
              className="relative hover:bg-brand-50"
            >
              <Bell size={22} weight="regular" className="text-ink" />
            </IconButton>
            {/* red unread-count bubble on the bell (capped at "9+") */}
            <AnimatePresence>
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-status-cancelled text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white pointer-events-none"
                  data-testid="unread-count"
                >
                  {unread > 9 ? "9+" : unread}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Avatar quick-link to profile */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/profile")}
            className="ml-1"
            aria-label="Go to profile"
          >
            <Avatar
              name={user?.full_name}
              src={user?.profile_picture}
              size={36}
              className="ring-2 ring-brand-100 shadow-soft"
            />
          </motion.button>
        </div>
      </div>
    </header>
  );
}


/* ══════════════════ Layout Root ══════════════════ */
// App shell: header + bottom nav wrapped around the routed page (<Outlet/>).
// Chat and item-form routes use a stripped-down, full-height layout instead.
export default function Layout() {
  const { user, unread } = useAuth();
  const navigate         = useNavigate();
  const location         = useLocation();
  const [drawer, setDrawer] = useState(false); // notification drawer open/closed
  // Routes that opt out of the standard chrome (header/bottom-nav)
  const isChat = location.pathname.startsWith("/chat/");
  const isItemForm = location.pathname === "/items/new" ||
    (location.pathname.startsWith("/items/") && location.pathname.endsWith("/edit"));

  // Handover rating prompt — when a borrow completes, ask the borrower to rate the lender
  const [ratingPrompt, setRatingPrompt] = useState(null);

  // Listen for transaction updates; pop the rating dialog only if this user is the
  // borrower and is actually eligible to rate (and hasn't already).
  useRealtimeEvent("transaction.updated", async (p) => {
    if (p.status !== "Borrowed" || !user) return;
    try {
      const { data }     = await api.get(`/transactions/${p.transaction_id}`);
      const tx           = data.transaction || data;
      if (tx.borrower_id !== user.id) return;            // only prompt the borrower
      const { data: elig } = await api.get(`/ratings/transaction/${tx.id}/eligibility`);
      if (!elig.allowed || elig.already_rated) return;   // skip if not allowed / already rated
      setRatingPrompt({
        transactionId: tx.id,
        lenderName:    tx.lender?.full_name || "your lender",
      });
    } catch { /* best-effort */ }
  });

  // Bottom-nav tabs; the Activity tab shows the unread badge
  const tabs = [
    { to: "/home",      label: "Home",     icon: House       },
    { to: "/lend",      label: "Lend",     icon: HandArrowUp },
    { to: "/dashboard", label: "Activity", icon: SquaresFour, badge: unread },
    { to: "/profile",   label: "Profile",  icon: User        },
  ];
  if (user?.is_admin) tabs.push({ to: "/admin", label: "Admin", icon: ShieldCheck }); // admins get an extra tab

  return (
    // Root sizing differs per route: chat fills the screen, item-form is plain,
    // normal pages reserve bottom padding for the floating nav.
    <div className={
      isChat     ? "h-screen overflow-hidden flex flex-col"
      : isItemForm ? "min-h-screen"
      : "min-h-screen pb-28"
    }>
      {/* Top header (hidden on chat + item-form) */}
      {!isChat && !isItemForm && (
        <TopHeader
          user={user}
          unread={unread}
          onBellClick={() => setDrawer(true)}
        />
      )}

      {/* Main content — `key` forces a fresh mount on every route change */}
      <main className={
        isChat      ? "flex-1 overflow-hidden"
        : isItemForm ? ""
        : "max-w-2xl mx-auto px-5 py-6"
      }>
        <Outlet key={location.pathname} />
      </main>

      {/* Bottom nav — hidden on item form (it has its own CTA navigation) */}
      {!isChat && !isItemForm && <BottomNav tabs={tabs} />}

      {/* Notification quick-drawer */}
      <NotificationDrawer open={drawer} onClose={() => setDrawer(false)} />

      {/* Handover rating prompt — returns to home after rating or dismissing */}
      {ratingPrompt && (
        <RatingDialog
          open={!!ratingPrompt}
          onClose={() => { setRatingPrompt(null); navigate("/home"); }}
          transactionId={ratingPrompt.transactionId}
          counterpartyName={ratingPrompt.lenderName}
          onRated={() => { setRatingPrompt(null); navigate("/home"); }}
        />
      )}
    </div>
  );
}



