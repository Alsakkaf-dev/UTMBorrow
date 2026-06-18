import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Check, HandArrowDown, CheckCircle, Clock, ShieldWarning, Star,
  Package, ArrowRight, Trash, XCircle, Sparkle,
} from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { humanizeType } from "../../lib/format";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeEvent } from "../../lib/realtime";
import { Button, EmptyState, PageLoader } from "../../components/ui";
import { toast } from "../../components/Toast";
import { staggerContainer, riseItem } from "../../lib/motion";

const TABS = ["All", "Requests", "Approvals", "Reminders", "Moderation"];

const TAB_MATCH = {
  Requests:   new Set(["RequestReceived", "RequestCancelled"]),
  Approvals:  new Set(["RequestApproved", "RequestRejected", "HandoverConfirmed", "ReturnConfirmed"]),
  Reminders:  new Set(["ReturnReminder", "OverdueReminder"]),
  Moderation: new Set(["Item_Removed", "Account_Suspended", "Account_Reinstated", "Report_Reviewed",
    "Report_Submitted", "AdminAction", "PenaltyApplied", "UserReported", "RatingReceived"]),
};

/* ── Color scheme by category ── */
function typeStyle(type) {
  if (TAB_MATCH.Requests.has(type))                            return { bg: "bg-blue-50",    text: "text-blue-600",    ring: "ring-blue-100",    bar: "bg-blue-500"    };
  if (type === "RequestApproved")                              return { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100", bar: "bg-emerald-500" };
  if (type === "RequestRejected")                              return { bg: "bg-red-50",     text: "text-red-500",     ring: "ring-red-100",     bar: "bg-red-500"     };
  if (type === "HandoverConfirmed" || type === "ReturnConfirmed") return { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100", bar: "bg-emerald-500" };
  if (TAB_MATCH.Reminders.has(type))                          return { bg: "bg-amber-50",   text: "text-amber-600",   ring: "ring-amber-100",   bar: "bg-amber-500"   };
  if (type === "RatingReceived")                              return { bg: "bg-purple-50",  text: "text-purple-600",  ring: "ring-purple-100",  bar: "bg-purple-500"  };
  if (TAB_MATCH.Moderation.has(type))                         return { bg: "bg-red-50",     text: "text-red-600",     ring: "ring-red-100",     bar: "bg-red-500"     };
  return { bg: "bg-slate-100", text: "text-slate-500", ring: "ring-slate-100", bar: "bg-slate-400" };
}

function iconForType(type) {
  if (TAB_MATCH.Requests.has(type))  return HandArrowDown;
  if (TAB_MATCH.Approvals.has(type)) return CheckCircle;
  if (type === "RequestRejected")    return XCircle;
  if (TAB_MATCH.Reminders.has(type)) return Clock;
  if (type === "RatingReceived")     return Star;
  if (TAB_MATCH.Moderation.has(type)) return ShieldWarning;
  if (type === "HandoverConfirmed" || type === "ReturnConfirmed") return Package;
  return Bell;
}

function formatWhen(iso) {
  if (!iso) return "";
  try {
    const d    = new Date(iso);
    const now  = new Date();
    const mins = Math.floor((now - d) / 60000);
    if (mins < 1)  return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return ""; }
}

function groupByDate(items) {
  const now       = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const yestStart  = new Date(todayStart); yestStart.setDate(yestStart.getDate() - 1);

  const buckets = { Today: [], Yesterday: [], Earlier: [] };
  items.forEach((n) => {
    const d = new Date(n.created_at);
    if (d >= todayStart)     buckets.Today.push(n);
    else if (d >= yestStart) buckets.Yesterday.push(n);
    else                     buckets.Earlier.push(n);
  });
  return ["Today", "Yesterday", "Earlier"]
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ label: k, items: buckets[k] }));
}

/* ── Single notification card ── */
function NotifCard({ n, index, onView, onDelete }) {
  const Icon    = iconForType(n.notification_type);
  const style   = typeStyle(n.notification_type);
  const hasLink = Boolean(n.transaction_id || n.related_report_id);
  const when    = formatWhen(n.created_at);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: "hidden", paddingBottom: 0 }}
      transition={{ duration: 0.28, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }}
      data-testid={`notification-${n.id}`}
      className={`relative rounded-3xl border overflow-hidden bg-surface shadow-card transition-all ${
        n.is_read ? "border-line" : `border-${style.bar.replace("bg-", "")} border-opacity-30`
      }`}
      style={!n.is_read ? { borderColor: undefined } : {}}
    >
      {/* Unread gradient left accent */}
      {!n.is_read && (
        <div className={`absolute inset-y-0 left-0 w-[3.5px] notif-unread-bar`} />
      )}

      <div className={`flex gap-3.5 p-4 ${!n.is_read ? "pl-[18px]" : ""}`}>
        {/* Icon circle */}
        <motion.div
          animate={!n.is_read ? { scale: [1, 1.08, 1] } : {}}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${style.bg} ${style.text} shadow-soft`}
        >
          <Icon size={21} weight="fill" />
        </motion.div>

        <div className="min-w-0 flex-1">
          {/* Top row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${style.text}`}>
              {humanizeType(n.notification_type)}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {when && <span className="text-[11px] text-muted font-medium">{when}</span>}
              {!n.is_read && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-2 h-2 rounded-full bg-brand-500 shrink-0"
                />
              )}
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-ink leading-relaxed">{n.message}</p>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-3">
            {hasLink && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onView(n)}
                data-testid={`view-details-${n.id}`}
                className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
              >
                View details <ArrowRight size={12} weight="bold" />
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onDelete(n.id)}
              data-testid={`delete-notif-${n.id}`}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-red-500 transition-colors ml-auto"
            >
              <Trash size={12} weight="bold" /> Delete
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Tab pill ── */
const TAB_ICONS = {
  All: Sparkle, Requests: HandArrowDown, Approvals: CheckCircle, Reminders: Clock, Moderation: ShieldWarning,
};

/* ══════════════════ Main page ══════════════════ */
export default function Notifications() {
  const { refreshUnread } = useAuth();
  const navigate          = useNavigate();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("All");
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data.notifications);
    } catch (err) { console.error("Failed to load notifications:", err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const init = async () => {
      await load();
      try { await api.post("/notifications/read-all"); refreshUnread(); } catch { /* best-effort */ }
    };
    init();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  useRealtimeEvent("notification.new", () => { load(); refreshUnread(); });

  const filtered = useMemo(() => {
    if (tab === "All") return items;
    const set = TAB_MATCH[tab];
    return items.filter((n) => set?.has(n.notification_type));
  }, [items, tab]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await api.post("/notifications/read-all");
      await load();
      refreshUnread();
      toast.success("All notifications marked as read.");
    } catch (err) { console.error("Failed to mark all read:", err); }
    finally { setMarkingAll(false); }
  };

  const viewDetails = (n) => {
    if (n.transaction_id)     navigate(`/transactions/${n.transaction_id}`);
    else if (n.related_report_id) navigate(`/moderation/${n.related_report_id}`);
  };

  const deleteOne = async (id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.delete(`/notifications/${id}`);
      refreshUnread();
    } catch (err) {
      console.error("Failed to delete notification:", err);
      load();
    }
  };

  if (loading) return <PageLoader />;

  const groups = groupByDate(filtered);

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* ── Header ── */}
      <motion.div variants={riseItem} className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="label-eyebrow">Stay in the loop</p>
          <h1 className="font-head font-extrabold text-3xl tracking-tight text-ink leading-tight">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-brand-600 font-semibold mt-1 flex items-center gap-1"
            >
              <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              {unreadCount} unread
            </motion.p>
          )}
        </div>
        <Button
          variant="soft"
          size="sm"
          loading={markingAll}
          disabled={unreadCount === 0}
          onClick={markAll}
          data-testid="mark-all-read-btn"
          className="shrink-0 mt-1"
        >
          <Check size={14} weight="bold" /> Mark all read
        </Button>
      </motion.div>

      {/* ── Tab bar ── */}
      <motion.div variants={riseItem} className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-5 -mx-1 px-1">
        {TABS.map((t) => {
          const TabIcon = TAB_ICONS[t];
          const count   = t === "All"
            ? items.length
            : items.filter((n) => TAB_MATCH[t]?.has(n.notification_type)).length;
          const unread  = t === "All"
            ? items.filter((n) => !n.is_read).length
            : items.filter((n) => TAB_MATCH[t]?.has(n.notification_type) && !n.is_read).length;
          const isActive = tab === t;

          return (
            <motion.button
              key={t}
              whileTap={{ scale: 0.93 }}
              onClick={() => setTab(t)}
              data-testid={`notif-tab-${t.toLowerCase()}`}
              className={`relative shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-all duration-200 ${
                isActive
                  ? "bg-brand-gradient text-white border-transparent shadow-glow-sm"
                  : "bg-surface border-line text-muted hover:border-brand-300 hover:text-ink"
              }`}
            >
              <TabIcon size={14} weight={isActive ? "fill" : "regular"} />
              {t}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-white/25 text-white" : "bg-slate-100 text-muted"
                }`}>
                  {count}
                </span>
              )}
              {/* Unread dot on inactive tab */}
              {!isActive && unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-500" />
              )}
            </motion.button>
          );
        })}
      </motion.div>

      {/* ── Content ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} weight="fill" />}
          title={tab === "All" ? "No notifications yet" : `No ${tab.toLowerCase()} notifications`}
          subtitle="Updates about your borrows, loans, and account will appear here."
        />
      ) : (
        <AnimatePresence initial={false}>
          <div className="space-y-7">
            {groups.map(({ label, items: group }) => (
              <div key={label}>
                {/* Date header */}
                <motion.div
                  variants={riseItem}
                  className="flex items-center gap-3 mb-3"
                >
                  <span className="text-[11px] font-bold uppercase tracking-widest text-muted px-2 py-0.5 bg-canvas rounded-full border border-line">
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-line" />
                </motion.div>

                <div className="space-y-2.5">
                  {group.map((n, i) => (
                    <NotifCard
                      key={n.id}
                      n={n}
                      index={i}
                      onView={viewDetails}
                      onDelete={deleteOne}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </motion.div>
  );
}
