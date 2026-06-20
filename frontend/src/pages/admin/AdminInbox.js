import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flag, Lifebuoy, WarningOctagon, CheckCircle, ArrowRight,
  ShieldWarning, Clock,
} from "@phosphor-icons/react";
import { adminApi, formatApiError } from "../../lib/api";
import { useRealtimeEvent } from "../../lib/realtime";
import { Button, Card, EmptyState, PageLoader, StatusBadge, PriorityBadge, SLABadge, PageHeader } from "../../components/ui";
import { toast } from "../../components/Toast";

// ─── SLA config per type (hours to resolve) ───────────────────────────────────
const SLA_HOURS = { P1: 24, P2: 72, P3: 168 };

// Derive priority from complaint severity or flag severity
function complainPriority(item) {
  if (!item) return "P3";
  const sev = (item.severity || item.priority || "").toLowerCase();
  if (sev === "high" || sev === "critical" || sev === "p1") return "P1";
  if (sev === "medium" || sev === "p2") return "P2";
  return "P3";
}

const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2 };

function SectionTitle({ icon: Icon, label, color, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} weight="bold" className={color} />
      <span className="font-semibold text-ink">{label}</span>
      {count > 0 && (
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-canvas border border-line text-muted">{count}</span>
      )}
    </div>
  );
}

function ComplaintCard({ item, onClaim }) {
  const p = complainPriority(item);
  return (
    <Link to={`/admin/reports/${item.id}`} onClick={(e) => e.stopPropagation()}>
      <motion.div
        whileHover={{ y: -1 }}
        className="bg-surface border border-line rounded-2xl p-4 flex items-start justify-between gap-3 shadow-soft hover:border-brand-200 transition-all"
        data-testid={`inbox-complaint-${item.id}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <PriorityBadge level={p} />
            <SLABadge createdAt={item.created_at || new Date().toISOString()} slaHours={SLA_HOURS[p]} />
          </div>
          <p className="font-semibold text-ink text-sm truncate">{item.report_type || item.reason_category || "Report"}</p>
          <p className="text-xs text-muted truncate mt-0.5">{item.reason || item.description || "—"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={item.report_status} />
          <ArrowRight size={14} className="text-slate-300" />
        </div>
      </motion.div>
    </Link>
  );
}

function TicketCard({ item, onResolve, resolving }) {
  const p = "P3"; // help tickets are always P3 unless escalated
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className="bg-surface border border-line rounded-2xl p-4 flex items-start justify-between gap-3 shadow-soft"
      data-testid={`inbox-ticket-${item.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <PriorityBadge level={p} />
          <SLABadge createdAt={item.created_at || new Date().toISOString()} slaHours={SLA_HOURS[p]} />
        </div>
        <p className="font-semibold text-ink text-sm truncate">{item.subject}</p>
        <p className="text-xs text-muted line-clamp-2 mt-0.5">{item.message}</p>
        <p className="text-[11px] text-muted mt-1.5 font-medium">From {item.user_name}</p>
      </div>
      <Button
        size="sm" variant="soft"
        onClick={() => onResolve(item.id)}
        loading={resolving === item.id}
        data-testid={`inbox-resolve-${item.id}`}
        className="shrink-0"
      >
        <CheckCircle size={14} weight="bold" /> Resolve
      </Button>
    </motion.div>
  );
}

function FlagCard({ item, index }) {
  const p = complainPriority(item);
  const TONE = {
    high:   "border-red-200 bg-red-50/40",
    medium: "border-amber-200 bg-amber-50/40",
    low:    "border-line bg-surface",
  };
  const tone = TONE[(item.severity || "low").toLowerCase()] || TONE.low;
  return (
    <motion.div
      whileHover={{ y: -1 }}
      className={`border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-soft ${tone}`}
      data-testid={`inbox-flag-${index}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <PriorityBadge level={p} />
        </div>
        <p className="font-semibold text-ink text-sm truncate">
          {(item.kind || "Flag").replace(/_/g, " ")}
          {item.user_name ? ` — ${item.user_name}` : ""}
        </p>
        <p className="text-xs text-muted truncate mt-0.5">{item.detail}</p>
      </div>
      {item.user_id && (
        <Link to={`/admin/users/${item.user_id}`} className="shrink-0">
          <ArrowRight size={14} className="text-slate-300 hover:text-brand-500 transition-colors" />
        </Link>
      )}
    </motion.div>
  );
}

export default function AdminInbox() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "complaints" | "help" | "flags"

  const load = useCallback(async () => {
    try {
      const { data: d } = await adminApi.get("/admin/alerts");
      setData(d);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not load the inbox.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeEvent("moderation.changed", load);
  useRealtimeEvent("admin.changed", load);

  const resolveTicket = async (id) => {
    setResolving(id);
    try {
      await adminApi.post(`/admin/help/${id}/resolve`);
      toast.success("Help request resolved.");
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not resolve ticket.");
    } finally { setResolving(null); }
  };

  if (loading) return <PageLoader />;

  const complaints = [...(data?.complaints || [])].sort(
    (a, b) => PRIORITY_ORDER[complainPriority(a)] - PRIORITY_ORDER[complainPriority(b)]
  );
  const tickets = data?.help_tickets || [];
  const flags = [...(data?.system_flags || [])].sort(
    (a, b) => PRIORITY_ORDER[complainPriority(a)] - PRIORITY_ORDER[complainPriority(b)]
  );
  const counts = data?.counts || {};

  const p1Total = complaints.filter((c) => complainPriority(c) === "P1").length
    + flags.filter((f) => complainPriority(f) === "P1").length;

  const totalUnresolved = complaints.length + tickets.length + flags.length;
  const isEmpty = totalUnresolved === 0;

  const TABS = [
    { value: "all",        label: "All",       count: totalUnresolved },
    { value: "complaints", label: "Complaints", count: counts.complaints || 0 },
    { value: "help",       label: "Help",       count: counts.help || 0 },
    { value: "flags",      label: "Flags",      count: counts.flags || 0 },
  ];

  return (
    <div data-testid="admin-inbox-page" className="space-y-5 max-w-3xl">
      <PageHeader eyebrow="Notification center" title="Admin inbox" />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Complaints", value: counts.complaints ?? 0, icon: Flag,         color: "text-red-500",   bg: "bg-red-50" },
          { label: "Help requests", value: counts.help ?? 0,   icon: Lifebuoy,     color: "text-brand-500", bg: "bg-brand-50" },
          { label: "System flags", value: counts.flags ?? 0,   icon: WarningOctagon, color: "text-amber-500", bg: "bg-amber-50" },
        ].map((s) => {
          const SIcon = s.icon;
          return (
            <Card key={s.label} className="p-3.5 flex items-center gap-3" data-testid={`inbox-count-${s.label.split(" ")[0].toLowerCase()}`}>
              <span className={`w-9 h-9 rounded-xl ${s.bg} ${s.color} flex items-center justify-center shrink-0`}>
                <SIcon size={17} weight="bold" />
              </span>
              <div>
                <p className="text-xl font-bold text-ink tabular-nums leading-tight">{s.value}</p>
                <p className="text-[11px] text-muted leading-tight">{s.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* P1 critical banner */}
      <AnimatePresence>
        {p1Total > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-red-200 bg-red-50"
          >
            <ShieldWarning size={18} weight="fill" className="text-red-500 shrink-0" />
            <p className="text-sm font-semibold text-red-700 flex-1">
              {p1Total} critical item{p1Total > 1 ? "s" : ""} need immediate attention
            </p>
            <Clock size={14} className="text-red-400 shrink-0" />
            <span className="text-xs text-red-500 font-semibold shrink-0">SLA: 24h</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setActiveTab(t.value)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
              activeTab === t.value
                ? "bg-brand-gradient text-white border-transparent shadow-glow-sm"
                : "bg-surface border-line text-muted hover:border-brand-300 hover:text-ink"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.value ? "bg-white/20" : "bg-canvas"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {isEmpty && <EmptyState title="All clear" subtitle="No complaints, help requests, or fraud flags right now." />}

      <AnimatePresence mode="popLayout">
        {/* User complaints */}
        {complaints.length > 0 && (activeTab === "all" || activeTab === "complaints") && (
          <motion.section
            key="complaints"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-2.5"
            data-testid="inbox-complaints"
          >
            <SectionTitle icon={Flag} label="User complaints" color="text-red-500" count={complaints.length} />
            {complaints.map((r) => <ComplaintCard key={r.id} item={r} />)}
          </motion.section>
        )}

        {/* Help tickets */}
        {tickets.length > 0 && (activeTab === "all" || activeTab === "help") && (
          <motion.section
            key="help"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-2.5"
            data-testid="inbox-help"
          >
            <SectionTitle icon={Lifebuoy} label="Help requests" color="text-brand-500" count={tickets.length} />
            {tickets.map((t) => (
              <TicketCard key={t.id} item={t} onResolve={resolveTicket} resolving={resolving} />
            ))}
          </motion.section>
        )}

        {/* System flags */}
        {flags.length > 0 && (activeTab === "all" || activeTab === "flags") && (
          <motion.section
            key="flags"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-2.5"
            data-testid="inbox-flags"
          >
            <SectionTitle icon={WarningOctagon} label="System flags" color="text-amber-500" count={flags.length} />
            {flags.map((f, i) => <FlagCard key={i} item={f} index={i} />)}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
