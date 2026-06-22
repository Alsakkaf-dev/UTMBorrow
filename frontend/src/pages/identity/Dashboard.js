import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight, Star, Clock, HandArrowDown, HandArrowUp,
    MagnifyingGlass, Plus, Gear,
} from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeEvent } from "../../lib/realtime";
import { useRouteRefresh } from "../../hooks/useRouteRefresh";
import { EmptyState, StatusBadge, UrgentBadge, Avatar } from "../../components/ui";
import UrgentBanner from "../../components/UrgentBanner";
import { Skeleton } from "../../components/Skeleton";

const TABS = [
    { key: "borrowing", label: "Borrowing", icon: HandArrowDown },
    { key: "lending", label: "Lending", icon: HandArrowUp },
];

export default function Dashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState("borrowing");
    const [data, setData] = useState(null);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const [{ data: res }, pendingRes] = await Promise.all([
                api.get("/dashboard"),
                api.get("/ratings/pending").catch(() => ({ data: { pending: [] } })),
            ]);
            setData(res);
            setPending(pendingRes.data.pending || []);
        } catch (err) {
            console.error("Failed to load dashboard:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    useRouteRefresh(loadData, "/dashboard");

    const t = useRef(null);
    useRealtimeEvent("transaction.updated", () => {
        clearTimeout(t.current);
        t.current = setTimeout(loadData, 200);
    });

    if (loading || !data) return <PageLoader />;

    const { summary, borrowing, lending } = data;

    const borrowingActive = borrowing.filter(tx =>
        ["Pending", "Approved", "Borrowed"].includes(tx.status)
    );
    const lendingActive = lending.filter(tx =>
        ["Pending", "Approved", "Borrowed"].includes(tx.status)
    );

    return (
        <div className="animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <p className="label-eyebrow">Activity hub</p>
                    <h1 className="font-head font-extrabold text-3xl tracking-tight">Dashboard</h1>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100">
                        <Star size={14} weight="fill" className="text-amber-400" />
                        <span className="font-head font-bold text-sm text-ink tabular-nums">
              {user.trust_score != null ? Number(user.trust_score).toFixed(1) : "—"}
            </span>
                    </div>
                </div>
            </div>

            {/* Urgent banner */}
            <UrgentBanner
                count={summary.urgent_returns}
                onClick={() => {
                    const urgent = borrowingActive.find(
                        tx => tx.status === "Borrowed" && (
                            tx.return_requested ||
                            (tx.lease && (tx.lease.is_overdue || tx.lease.due_within_24h))
                        )
                    );
                    if (urgent) navigate(`/transactions/${urgent.id}`);
                }}
            />

            {/* Pending actions (UC1202 A1) — outstanding ratings deferred via
          "Remind me later". Hidden entirely when there's nothing pending. */}
            {pending.length > 0 && (
                <PendingActions pending={pending} navigate={navigate} />
            )}

            {/* Segmented control */}
            <div className="flex bg-surface border border-line rounded-full p-1 mb-5 shadow-soft">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        data-testid={`dashboard-tab-${key}`}
                        className="relative flex-1 py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5"
                    >
                        {tab === key && (
                            <motion.span
                                layoutId="dashboard-pill"
                                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                className="absolute inset-0 bg-brand-gradient rounded-full shadow-glow-sm"
                            />
                        )}
                        <span className={`relative z-10 flex items-center gap-1.5 ${tab === key ? "text-white" : "text-muted"}`}>
              <Icon size={15} weight={tab === key ? "fill" : "regular"} />
                            {label}
            </span>
                    </button>
                ))}
            </div>

            {/* Stats row — swaps based on active tab */}
            <AnimatePresence mode="wait">
                {tab === "borrowing" ? (
                    <motion.div
                        key="borrow-stats"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="grid grid-cols-3 gap-3 mb-5"
                    >
                        <StatCard value={summary.pending_out} label="Awaiting" color="text-amber-500" />
                        <StatCard value={summary.active_borrowed} label="Borrowed" color="text-brand-600" />
                        <StatCard value={summary.urgent_returns} label="Urgent" color="text-red-500" urgent />
                    </motion.div>
                ) : (
                    <motion.div
                        key="lend-stats"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="grid grid-cols-3 gap-3 mb-5"
                    >
                        <StatCard value={summary.pending_in} label="Requests" color="text-amber-500" />
                        <StatCard value={summary.active_lent} label="On loan" color="text-emerald-600" />
                        <StatCard
                            value={lending.filter(t => t.status === "Completed").length}
                            label="Completed"
                            color="text-slate-500"
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Quick actions */}
            <div className="mb-6">
                <h2 className="font-head font-bold text-base text-ink mb-3">Quick actions</h2>
                <div className="grid grid-cols-4 gap-2.5">
                    {[
                        { label: "Request", icon: MagnifyingGlass, color: "bg-brand-50 text-brand-500", to: "/catalog" },
                        { label: "List Item", icon: Plus, color: "bg-emerald-50 text-emerald-500", to: "/items/new" },
                        { label: "History", icon: Clock, color: "bg-purple-50 text-purple-500", to: "/history" },
                        { label: "Settings", icon: Gear, color: "bg-amber-50 text-amber-500", to: "/settings" },
                    ].map(({ label, icon: Icon, color, to }) => (
                        <motion.button
                            key={label}
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => navigate(to)}
                            className="bg-surface border border-line rounded-2xl p-3 flex flex-col items-center justify-center gap-1.5 shadow-soft"
                        >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                                <Icon size={18} weight="bold" />
                            </div>
                            <span className="text-[10px] font-bold text-ink leading-tight">{label}</span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* Activity list */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                >
                    <div className="flex items-center justify-between mb-3.5">
                        <h2 className="font-head font-bold text-base text-ink">
                            {tab === "borrowing" ? "Active borrows" : "Active loans"}
                        </h2>
                        <button onClick={() => navigate("/history")} className="text-xs font-bold text-brand-600">
                            Full history →
                        </button>
                    </div>

                    {(tab === "borrowing" ? borrowingActive : lendingActive).length === 0 ? (
                        <EmptyState
                            title={tab === "borrowing" ? "Nothing borrowed yet" : "No active loans"}
                            subtitle={tab === "borrowing"
                                ? "Browse the catalog to request an item."
                                : "List an item to start lending."}
                            action={
                                tab === "borrowing"
                                    ? <button onClick={() => navigate("/catalog")} className="text-xs font-bold text-brand-600">Browse catalog →</button>
                                    : <button onClick={() => navigate("/items/new")} className="text-xs font-bold text-brand-600">List an item →</button>
                            }
                        />
                    ) : (
                        <div className="space-y-3">
                            {(tab === "borrowing" ? borrowingActive : lendingActive).map(tx => (
                                <TxCard key={tx.id} tx={tx} mode={tab} navigate={navigate} />
                            ))}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function PendingActions({ pending, navigate }) {
    return (
        <div className="mb-5" data-testid="dashboard-pending-actions">
            <div className="flex items-center gap-2 mb-3">
                <Star size={17} weight="fill" className="text-amber-400" />
                <h2 className="font-head font-bold text-base text-ink">Pending actions</h2>
                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
          {pending.length}
        </span>
            </div>
            <div className="space-y-2.5">
                {pending.map((p) => (
                    <motion.button
                        key={p.transaction_id}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => navigate(`/transactions/${p.transaction_id}`, { state: { openRating: true } })}
                        data-testid={`dashboard-pending-${p.transaction_id}`}
                        className="w-full text-left bg-amber-50/60 border border-amber-200 rounded-3xl p-3.5 flex items-center gap-3 shadow-soft hover:bg-amber-50 transition-colors"
                    >
                        <Avatar name={p.counterparty?.full_name} src={p.counterparty?.profile_picture} size={42} />
                        <div className="flex-1 min-w-0">
                            <p className="font-head font-bold text-sm text-ink leading-snug truncate">
                                Rate {p.counterparty?.full_name || (p.role === "borrower" ? "your lender" : "your borrower")}
                            </p>
                            <p className="text-xs text-muted mt-0.5 truncate">{p.item_title}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold">
                            <Star size={12} weight="fill" /> Rate
                        </div>
                    </motion.button>
                ))}
            </div>
        </div>
    );
}

function StatCard({ value, label, color, urgent }) {
    return (
        <div className={`rounded-3xl border p-4 shadow-card text-center flex flex-col items-center justify-center ${
            urgent && value > 0 ? "border-red-200 bg-red-50/30" : "border-line bg-surface"
        }`}>
            <p className={`font-head font-extrabold text-3xl tracking-tight tabular-nums ${color}`}>{value}</p>
            <p className="label-eyebrow mt-1 !text-[9px]">{label}</p>
        </div>
    );
}

function TxCard({ tx, mode, navigate }) {
    const counterparty = mode === "borrowing" ? tx.lender : tx.borrower;
    const urgent = tx.status === "Borrowed" && (
        tx.return_requested ||
        (tx.lease && (tx.lease.is_overdue || tx.lease.due_within_24h))
    );

    let detail = "";
    if (tx.status === "Pending") {
        detail = mode === "borrowing"
            ? `Pending approval from ${counterparty?.full_name?.split(" ")[0] ?? "lender"}`
            : `Awaiting your approval`;
    } else if (tx.status === "Approved") {
        detail = "Approved — arrange QR handover";
    } else if (tx.status === "Borrowed") {
        detail = tx.return_requested
            ? "Lender requested return — arrange now"
            : tx.lease
                ? `Due ${tx.borrow_end_date}`
                : "Active loan";
    }

    return (
        <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => navigate(`/transactions/${tx.id}`)}
            data-testid={`dashboard-tx-${tx.id}`}
            className={`w-full text-left bg-surface border rounded-4xl p-4.5 flex items-center gap-4 shadow-card hover:border-brand-200 transition-colors min-h-[80px] ${
                urgent ? "ring-2 ring-red-200 border-red-200 bg-red-50/30" : "border-line"
            }`}
        >
            <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-brand-gradient">
                {tx.item?.photo_url
                    ? <img src={tx.item.photo_url} alt="" className="w-full h-full object-cover" />
                    : <span className="font-head font-bold text-xl text-white/90">{tx.item?.title?.[0]}</span>}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <StatusBadge status={tx.status} />
                    {urgent && <UrgentBadge overdue={tx.lease?.is_overdue || tx.return_requested} />}
                </div>
                <p className="font-head font-bold text-sm text-ink leading-snug truncate">{tx.item?.title}</p>
                <p className="text-xs text-muted mt-0.5 leading-snug">{detail}</p>
            </div>
            <ArrowRight size={18} className="text-slate-300 shrink-0" />
        </motion.button>
    );
}

function PageLoader() {
    return (
        <div className="flex flex-col items-center justify-center py-20">
            <Skeleton className="w-8 h-8 rounded-full" />
            <p className="mt-3 text-xs text-muted">Loading…</p>
        </div>
    );
}