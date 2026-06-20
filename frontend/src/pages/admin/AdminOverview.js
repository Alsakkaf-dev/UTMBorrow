import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, Package, Handshake, Clock, Flag, WarningOctagon, ShieldCheck,
  QrCode, ClipboardText, ArrowsLeftRight, ChartLine,
  ArrowUpRight, CheckCircle, XCircle, BellRinging, Scales,
  UserMinus, UserPlus, SealCheck,
} from "@phosphor-icons/react";
import { adminApi, formatApiError } from "../../lib/api";
import { useRealtimeEvent, useRealtimeStatus } from "../../lib/realtime";
import { StatCard, PageLoader, LiveDot, Card } from "../../components/ui";
import { toast } from "../../components/Toast";
import { motion, AnimatePresence } from "framer-motion";

// ─── Action icon map ──────────────────────────────────────────────────────────
const ACTION_ICON = {
  Force_Cancel:     { icon: XCircle,    cls: "text-red-500 bg-red-50" },
  Force_Complete:   { icon: CheckCircle, cls: "text-emerald-500 bg-emerald-50" },
  Reminder_Sent:    { icon: BellRinging, cls: "text-amber-500 bg-amber-50" },
  Penalty_Applied:  { icon: Scales,     cls: "text-rose-500 bg-rose-50" },
  User_Suspended:   { icon: UserMinus,  cls: "text-red-500 bg-red-50" },
  User_Reinstated:  { icon: UserPlus,   cls: "text-emerald-500 bg-emerald-50" },
  Desk_Handover:    { icon: SealCheck,  cls: "text-emerald-500 bg-emerald-50" },
  Desk_Return:      { icon: SealCheck,  cls: "text-blue-500 bg-blue-50" },
  Session_Elevated: { icon: ShieldCheck, cls: "text-brand-500 bg-brand-50" },
};

function ActivityItem({ action, index }) {
  const map = ACTION_ICON[action.action_type] || { icon: ClipboardText, cls: "text-slate-500 bg-slate-100" };
  const Icon = map.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="flex items-start gap-3 py-2.5 border-b border-line last:border-0"
    >
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${map.cls}`}>
        <Icon size={14} weight="bold" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink leading-snug line-clamp-2">{action.summary}</p>
        <p className="text-[11px] text-muted mt-0.5">
          {action.admin_name || "Admin"} · {(action.created_at || "").slice(0, 16).replace("T", " ")}
        </p>
      </div>
    </motion.div>
  );
}

function HealthBar({ label, value, max = 100, color = "bg-brand-gradient", sublabel }) {
  const pct = max ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-ink">{label}</span>
        <div className="text-right">
          <span className="text-sm font-bold text-ink">{pct}%</span>
          {sublabel && <span className="text-[11px] text-muted ml-1">({sublabel})</span>}
        </div>
      </div>
      <div className="h-2 rounded-full bg-canvas border border-line overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}

function PriorityAlert({ icon, label, count, to, tone }) {
  if (!count || count === 0) return null;
  const TONES = {
    red:   "border-red-200 bg-red-50/60 text-red-700",
    amber: "border-amber-200 bg-amber-50/60 text-amber-700",
    blue:  "border-blue-200 bg-blue-50/60 text-blue-700",
  };
  const Icon = icon;
  return (
    <Link to={to}>
      <motion.div
        whileHover={{ x: 2 }}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border ${TONES[tone]} transition-all`}
      >
        <Icon size={16} weight="fill" className="shrink-0" />
        <span className="text-sm font-semibold flex-1">{count} {label}</span>
        <ArrowUpRight size={15} className="shrink-0 opacity-70" />
      </motion.div>
    </Link>
  );
}

function QuickAction({ to, icon, label, testid }) {
  const Icon = icon;
  return (
    <Link
      to={to}
      data-testid={testid}
      className="group flex flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface px-1.5 py-3 text-center shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
    >
      <span className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center transition-all group-hover:bg-brand-gradient group-hover:text-white group-hover:shadow-glow-sm">
        <Icon size={16} weight="bold" />
      </span>
      <span className="text-[10px] font-semibold text-ink-soft leading-tight">{label}</span>
    </Link>
  );
}

export default function AdminOverview() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const rtStatus = useRealtimeStatus();

  const load = useCallback(async () => {
    try {
      const { data: d } = await adminApi.get("/admin/overview");
      setData(d);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeEvent("admin.changed", load);
  useRealtimeEvent("transaction.updated", load);

  if (loading) return <PageLoader />;

  const s = data?.stats || {};
  const actions = data?.recent_actions || [];

  // Platform health derived metrics
  const totalTransactions = (s.active_loans || 0) + (s.completed_loans || 0) + (s.pending_requests || 0);
  const completionRate = totalTransactions > 0 ? Math.round(((s.completed_loans || 0) / totalTransactions) * 100) : 0;
  const overdueRate = (s.active_loans || 0) > 0 ? Math.round(((s.overdue || 0) / (s.active_loans || 1)) * 100) : 0;
  const reportRate = (s.users_total || 0) > 0 ? Math.round(((s.pending_reports || 0) / (s.users_total || 1)) * 100) : 0;

  const hasPriorityAlerts = (s.overdue || 0) > 0 || (s.pending_reports || 0) > 0 || (s.suspended || 0) > 0;

  return (
    <div data-testid="admin-overview-page" className="space-y-4 md:space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="label-eyebrow">Analytics</p>
          <h1 className="font-head font-extrabold text-xl md:text-2xl tracking-tight text-ink">Platform overview</h1>
        </div>
        <LiveDot status={rtStatus} />
      </div>

      {/* Priority alerts — only shown when there's something to action */}
      <AnimatePresence>
        {hasPriorityAlerts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-4" data-testid="priority-alerts">
              <p className="label-eyebrow mb-3">Needs attention</p>
              <div className="space-y-2">
                <PriorityAlert icon={WarningOctagon} label="overdue loans" count={s.overdue} to="/admin/overdue" tone="red" />
                <PriorityAlert icon={Flag} label="open reports" count={s.pending_reports} to="/admin/reports" tone="amber" />
                <PriorityAlert icon={ShieldCheck} label="suspended users" count={s.suspended} to="/admin/users?status=Suspended" tone="blue" />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI stat cards grid — 2 cols on mobile, 4 on large desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatCard
          icon={<Users size={20} />}
          label="Total users"
          value={s.users_total ?? 0}
          tone="brand"
          testid="stat-users"
        />
        <StatCard
          icon={<Package size={20} />}
          label="Live listings"
          value={s.items_total ?? 0}
          tone="blue"
          testid="stat-items"
        />
        <StatCard
          icon={<Handshake size={20} />}
          label="Active loans"
          value={s.active_loans ?? 0}
          tone="emerald"
          testid="stat-loans"
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Pending requests"
          value={s.pending_requests ?? 0}
          tone="amber"
          testid="stat-pending"
        />
      </div>

      {/* Quick actions — 3 per row on 430px, 6 on desktop */}
      <div>
        <p className="label-eyebrow mb-2">Quick actions</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <QuickAction to="/admin/scan"        icon={QrCode}          label="Desk scan"    testid="quick-scan" />
          <QuickAction to="/admin/transactions" icon={ArrowsLeftRight} label="Deals"        testid="quick-deals" />
          <QuickAction to="/admin/reports"     icon={Flag}            label="Reports"      testid="quick-reports" />
          <QuickAction to="/admin/audit"       icon={ClipboardText}   label="Audit log"    testid="quick-audit" />
          <QuickAction to="/admin/users"       icon={Users}           label="Users"        testid="quick-users" />
          <QuickAction to="/admin/analytics"   icon={ChartLine}       label="Analytics"    testid="quick-analytics" />
        </div>
      </div>

      {/* Two-column: Platform health + Activity feed — stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Platform health */}
        <Card className="p-5" data-testid="platform-health">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-head font-bold text-base text-ink">Platform health</h3>
            <Link to="/admin/analytics" className="text-xs text-brand-600 font-semibold hover:underline">Analytics →</Link>
          </div>
          <div className="space-y-4">
            <HealthBar
              label="Loan completion rate"
              value={completionRate}
              color="bg-emerald-400"
              sublabel={`${s.completed_loans || 0} completed`}
            />
            <HealthBar
              label="Active overdue rate"
              value={overdueRate}
              max={100}
              color={overdueRate > 20 ? "bg-red-400" : overdueRate > 10 ? "bg-amber-400" : "bg-emerald-400"}
              sublabel={`${s.overdue || 0} of ${s.active_loans || 0}`}
            />
            <HealthBar
              label="Report density"
              value={reportRate}
              max={100}
              color={reportRate > 10 ? "bg-red-400" : "bg-brand-gradient"}
              sublabel={`${s.pending_reports || 0} open`}
            />
            <HealthBar
              label="Marketplace fill rate"
              value={s.active_loans || 0}
              max={Math.max(s.items_total || 1, 1)}
              color="bg-brand-gradient"
              sublabel={`${s.items_total || 0} listings`}
            />
          </div>
        </Card>

        {/* Live activity feed */}
        <Card className="p-5" data-testid="activity-feed">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-head font-bold text-base text-ink">Activity feed</h3>
              <LiveDot status={rtStatus} />
            </div>
            <Link to="/admin/audit" className="text-xs text-brand-600 font-semibold hover:underline">Full log →</Link>
          </div>
          <div className="space-y-0 max-h-72 overflow-y-auto -mx-1 px-1">
            {actions.length === 0 && (
              <p className="text-sm text-muted text-center py-6">No activity yet.</p>
            )}
            {actions.slice(0, 12).map((a, i) => (
              <ActivityItem key={a.id} action={a} index={i} />
            ))}
          </div>
        </Card>
      </div>

      {/* Marketplace volume breakdown */}
      <Card className="p-5" data-testid="overview-volume">
        <h3 className="font-head font-bold text-base text-ink mb-4">Marketplace volume</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Listings",       value: s.items_total     ?? 0, color: "bg-brand-gradient" },
            { label: "Active loans",   value: s.active_loans    ?? 0, color: "bg-emerald-400" },
            { label: "Pending",        value: s.pending_requests ?? 0, color: "bg-amber-400" },
            { label: "Overdue",        value: s.overdue         ?? 0, color: "bg-red-400" },
          ].map((item) => {
            const total = Math.max(s.items_total || 1, 1);
            const pct = Math.min(Math.round((item.value / total) * 100), 100);
            return (
              <div key={item.label} className="text-center">
                <div className="relative w-full h-2 bg-canvas rounded-full border border-line overflow-hidden mb-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`absolute left-0 top-0 h-full ${item.color} rounded-full`}
                  />
                </div>
                <p className="text-xl font-bold text-ink tabular-nums">{item.value}</p>
                <p className="text-xs text-muted mt-0.5">{item.label}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
