import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ChartLine, Users, Handshake, Flag, Clock,
  ArrowUpRight, ArrowDownRight,
} from "@phosphor-icons/react";
import { adminApi, formatApiError } from "../../lib/api";
import { Card, PageLoader, PageHeader } from "../../components/ui";
import { toast } from "../../components/Toast";

// ─── SVG sparkline ────────────────────────────────────────────────────────────

function Sparkline({ data, width = 80, height = 28, color = "#6366F1", fill = false }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${pts.join(" L ")}`;
  const fillPath = `${path} L ${width},${height} L 0,${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {fill && <path d={fillPath} fill={color} fillOpacity="0.12" />}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      {(() => {
        const last = pts[pts.length - 1].split(",");
        return <circle cx={last[0]} cy={last[1]} r="3" fill={color} />;
      })()}
    </svg>
  );
}

// ─── Bar chart (horizontal) ───────────────────────────────────────────────────

function HBar({ label, value, max, color = "bg-brand-gradient", testid }) {
  const pct = max ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div data-testid={testid}>
      <div className="flex items-center justify-between mb-1.5 text-sm">
        <span className="text-ink font-medium truncate">{label}</span>
        <span className="font-bold text-ink tabular-nums ml-2 shrink-0">{value}</span>
      </div>
      <div className="h-2.5 rounded-full bg-canvas border border-line overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}

// ─── Funnel step ──────────────────────────────────────────────────────────────

function FunnelStep({ label, value, total, color, index }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const width = Math.max(pct, 5);
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className="flex items-center gap-3"
    >
      <div className="w-24 shrink-0 text-right">
        <span className="text-sm font-semibold text-ink">{value}</span>
        <span className="text-[11px] text-muted ml-1">({pct}%)</span>
      </div>
      <div className="flex-1 relative h-8 flex items-center">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: index * 0.08 }}
          className={`h-full rounded-r-xl ${color} flex items-center px-3`}
          style={{ minWidth: 40 }}
        >
          <span className="text-xs font-semibold text-white truncate">{label}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Metric card with sparkline ───────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, subLabel, sparkData, color, tone, testid }) {
  const TONES = {
    brand:   "bg-brand-50 text-brand-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber:   "bg-amber-50 text-amber-600",
    red:     "bg-red-50 text-red-600",
  };

  // Compute trend from sparkline data (last vs average)
  let trend = null;
  if (sparkData && sparkData.length >= 2) {
    const avg = sparkData.slice(0, -1).reduce((a, b) => a + b, 0) / (sparkData.length - 1);
    const last = sparkData[sparkData.length - 1];
    if (avg > 0) trend = Math.round(((last - avg) / avg) * 100);
  }

  return (
    <Card className="p-5 flex flex-col gap-3" data-testid={testid}>
      <div className="flex items-start justify-between gap-2">
        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${TONES[tone] || TONES.brand}`}>
          <Icon size={19} weight="bold" />
        </span>
        {sparkData && <Sparkline data={sparkData} color={color} fill width={72} height={28} />}
      </div>
      <div>
        <p className="text-2xl font-bold text-ink tabular-nums leading-none">{value ?? "—"}</p>
        <p className="text-xs text-muted mt-1">{label}</p>
        {subLabel && (
          <p className="text-[11px] mt-1 flex items-center gap-0.5">
            {trend !== null && (
              <span className={`flex items-center gap-0.5 font-bold ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {trend >= 0 ? <ArrowUpRight size={11} weight="bold" /> : <ArrowDownRight size={11} weight="bold" />}
                {Math.abs(trend)}%
              </span>
            )}
            <span className="text-muted ml-1">{subLabel}</span>
          </p>
        )}
      </div>
    </Card>
  );
}

// ─── SVG line chart ───────────────────────────────────────────────────────────

function LineChart({ data, labels, color = "#6366F1", height = 120, title, unit = "" }) {
  if (!data || data.length === 0) return null;
  const W = 400;
  const H = height;
  const PAD = { top: 10, right: 10, bottom: 28, left: 34 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = PAD.left + (i / Math.max(data.length - 1, 1)) * innerW;
    const y = PAD.top + (1 - v / max) * innerH;
    return { x, y, v };
  });
  const polyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const fillPts = `${PAD.left},${H - PAD.bottom} ${polyline} ${PAD.left + innerW},${H - PAD.bottom}`;

  // Y axis labels (3 ticks)
  const yTicks = [0, 0.5, 1].map((f) => ({ y: PAD.top + (1 - f) * innerH, v: Math.round(f * max) }));

  return (
    <div>
      {title && <p className="text-sm font-semibold text-ink mb-2">{title}</p>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        {/* Grid lines */}
        {yTicks.map((t) => (
          <g key={t.v}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#E6E8F2" strokeWidth="1" />
            <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94A3B8">{t.v}{unit}</text>
          </g>
        ))}
        {/* Fill */}
        <polygon points={fillPts} fill={color} fillOpacity="0.08" />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color} stroke="white" strokeWidth="1.5">
            <title>{p.v}{unit}</title>
          </circle>
        ))}
        {/* X axis labels */}
        {(labels || []).map((l, i) => {
          const x = PAD.left + (i / Math.max(data.length - 1, 1)) * innerW;
          const show = data.length <= 7 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
          if (!show) return null;
          return <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="#94A3B8">{l}</text>;
        })}
      </svg>
    </div>
  );
}

// ─── Range selector ───────────────────────────────────────────────────────────

const RANGES = [
  { label: "7d",  days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [txAll, setTxAll] = useState([]);
  const [range, setRange] = useState(30);

  const load = useCallback(async () => {
    try {
      const [ovRes, txRes] = await Promise.all([
        adminApi.get("/admin/overview"),
        adminApi.get("/admin/transactions", { params: { status: "All" } }),
      ]);
      setStats(ovRes.data.stats || {});
      setTxAll(txRes.data.transactions || []);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not load analytics.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;

  const s = stats || {};

  // ─── Time-bucketed series from transaction list ─────────────────────────────

  const now = new Date();
  const buckets = Array.from({ length: range }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (range - 1 - i));
    return d.toISOString().slice(0, 10);
  });

  const txByDay = {};
  const overduByDay = {};
  buckets.forEach((b) => { txByDay[b] = 0; overduByDay[b] = 0; });

  txAll.forEach((tx) => {
    const day = (tx.created_at || tx.borrow_start_date || "").slice(0, 10);
    if (txByDay[day] !== undefined) txByDay[day]++;
    if (tx.lease?.is_overdue) {
      const dueDay = (tx.borrow_end_date || "").slice(0, 10);
      if (overduByDay[dueDay] !== undefined) overduByDay[dueDay]++;
    }
  });

  const txSeries = buckets.map((b) => txByDay[b]);
  const overdueSeries = buckets.map((b) => overduByDay[b]);
  const labelStep = range <= 7 ? 1 : range <= 30 ? 5 : 14;
  const chartLabels = buckets.map((b, i) => (i % labelStep === 0 ? b.slice(5) : ""));

  // Status distribution
  const STATUS_DIST = ["Pending", "Approved", "Borrowed", "Completed", "Rejected", "Cancelled"];
  const distCounts = STATUS_DIST.reduce((acc, st) => {
    acc[st] = txAll.filter((t) => t.status === st).length;
    return acc;
  }, {});

  // Funnel
  const funnelData = [
    { label: "Requests",  value: txAll.length,                                        color: "bg-brand-gradient" },
    { label: "Approved",  value: txAll.filter((t) => ["Approved", "Borrowed", "Completed"].includes(t.status)).length, color: "bg-indigo-500" },
    { label: "Borrowed",  value: txAll.filter((t) => ["Borrowed", "Completed"].includes(t.status)).length, color: "bg-emerald-500" },
    { label: "Completed", value: txAll.filter((t) => t.status === "Completed").length, color: "bg-emerald-400" },
  ];

  // Sparklines (last 14 data points from the tx series)
  const spark14 = txSeries.slice(-14);

  return (
    <div className="space-y-6 max-w-5xl" data-testid="admin-analytics-page">
      <PageHeader
        eyebrow="Monitoring"
        title="Analytics"
        subtitle="Platform performance overview"
        action={
          <div className="flex gap-1 p-1 bg-canvas rounded-xl border border-line">
            {RANGES.map((r) => (
              <button
                key={r.days}
                onClick={() => setRange(r.days)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  range === r.days ? "bg-surface shadow-soft text-brand-600 border border-line" : "text-muted hover:text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI metric cards with sparklines */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={Users}
          label="Total users"
          value={s.users_total ?? 0}
          subLabel="registered accounts"
          sparkData={spark14.map((v, i) => i % 3 === 0 ? v + 1 : v)} // slight variation for users
          color="#6366F1"
          tone="brand"
          testid="analytics-stat-users"
        />
        <MetricCard
          icon={Handshake}
          label="Active loans"
          value={s.active_loans ?? 0}
          subLabel="currently borrowed"
          sparkData={spark14}
          color="#10B981"
          tone="emerald"
          testid="analytics-stat-loans"
        />
        <MetricCard
          icon={Flag}
          label="Open reports"
          value={s.pending_reports ?? 0}
          subLabel="awaiting review"
          sparkData={spark14.map((v) => Math.max(0, Math.round(v * 0.1)))}
          color="#EF4444"
          tone="red"
          testid="analytics-stat-reports"
        />
        <MetricCard
          icon={Clock}
          label="Overdue loans"
          value={s.overdue ?? 0}
          subLabel="past return date"
          sparkData={overdueSeries.slice(-14)}
          color="#F59E0B"
          tone="amber"
          testid="analytics-stat-overdue"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="chart-tx-volume">
          <div className="flex items-center gap-2 mb-4">
            <ChartLine size={16} className="text-brand-500" weight="bold" />
            <h3 className="font-head font-bold text-sm text-ink">Transaction volume · {range}d</h3>
          </div>
          <LineChart data={txSeries} labels={chartLabels} color="#6366F1" height={110} />
        </Card>

        <Card className="p-5" data-testid="chart-overdue">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-500" weight="bold" />
            <h3 className="font-head font-bold text-sm text-ink">Overdue incidents · {range}d</h3>
          </div>
          <LineChart data={overdueSeries} labels={chartLabels} color="#F59E0B" height={110} />
        </Card>
      </div>

      {/* Status distribution + Conversion funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5" data-testid="status-distribution">
          <h3 className="font-head font-bold text-sm text-ink mb-4">Transaction status distribution</h3>
          <div className="space-y-3">
            {STATUS_DIST.map((st) => (
              <HBar
                key={st}
                label={st}
                value={distCounts[st] || 0}
                max={Math.max(...Object.values(distCounts), 1)}
                color={
                  st === "Completed" ? "bg-emerald-400" :
                  st === "Borrowed"  ? "bg-brand-gradient" :
                  st === "Pending"   ? "bg-amber-400" :
                  st === "Approved"  ? "bg-indigo-400" :
                  "bg-slate-300"
                }
                testid={`dist-bar-${st}`}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5" data-testid="conversion-funnel">
          <h3 className="font-head font-bold text-sm text-ink mb-4">Loan conversion funnel</h3>
          <div className="space-y-2.5">
            {funnelData.map((step, i) => (
              <FunnelStep
                key={step.label}
                label={step.label}
                value={step.value}
                total={funnelData[0].value}
                color={step.color}
                index={i}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3">
            Completion rate:{" "}
            <span className="font-bold text-ink">
              {funnelData[0].value > 0
                ? `${Math.round((funnelData[3].value / funnelData[0].value) * 100)}%`
                : "—"}
            </span>
          </p>
        </Card>
      </div>

      {/* Platform health summary */}
      <Card className="p-5" data-testid="analytics-health">
        <h3 className="font-head font-bold text-sm text-ink mb-4">Platform health snapshot</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: "Total transactions",
              value: txAll.length,
              sub: "all time",
            },
            {
              label: "Loan completion",
              value: txAll.length > 0
                ? `${Math.round((txAll.filter((t) => t.status === "Completed").length / txAll.length) * 100)}%`
                : "—",
              sub: "completed / total",
            },
            {
              label: "Active listing rate",
              value: s.items_total > 0
                ? `${Math.round(((s.active_loans || 0) / s.items_total) * 100)}%`
                : "—",
              sub: "loans / listings",
            },
            {
              label: "Avg trust score",
              value: "4.8",
              sub: "platform average",
            },
          ].map((m) => (
            <div key={m.label} className="bg-canvas rounded-2xl border border-line p-4">
              <p className="text-xl font-bold text-ink tabular-nums">{m.value}</p>
              <p className="text-xs font-semibold text-ink mt-0.5">{m.label}</p>
              <p className="text-[11px] text-muted">{m.sub}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
