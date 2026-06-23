import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, TrendUp, TrendDown, Star } from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Button, PageLoader, StarRating } from "../../components/ui";

const REPUTATION_FACTORS = [
    { label: "On-time return", delta: "+10", positive: true },
    { label: "Positive rating received", delta: "+5", positive: true },
    { label: "Completed exchange", delta: "+3", positive: true },
    { label: "Late return", delta: "-15", positive: false },
    { label: "Report upheld against you", delta: "-25", positive: false },
    { label: "Cancelled after approval", delta: "-10", positive: false },
];

function formatDate(iso) {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
        return iso.slice(0, 10);
    }
}

export default function Reputation() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await api.get(`/profile/${user.id}`);
                setProfile(data);
            } catch {
                setProfile(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user.id]);

    if (loading) return <PageLoader />;

    const score = Number(user.trust_score);
    const isTrustedLender = score >= 4.5;

    const timeline = profile?.rating_history?.length
        ? profile.rating_history.map((r, i) => ({
            id: `r-${i}`,
            title: r.stars >= 4 ? "Positive rating" : "Rating received",
            delta: r.stars >= 4 ? "+5" : r.stars <= 2 ? "-5" : "+2",
            date: r.created_at,
            detail: r.feedback || `Rated ${r.stars} stars by ${r.rater_name}`,
        }))
        : [];

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <button
                type="button"
                onClick={() => navigate("/settings")}
                className="flex items-center gap-1.5 text-muted text-sm mb-4 font-medium hover:text-ink transition-colors"
                data-testid="back-to-settings"
            >
                <ArrowLeft size={16} weight="bold" /> Back to settings
            </button>

            <h1 className="font-head font-extrabold text-3xl tracking-tight mb-5">Reputation & Trust</h1>

            {/* Score card */}
            <div className="relative overflow-hidden bg-brand-glow text-white rounded-4xl p-6 shadow-glow mb-5" data-testid="reputation-score-card">
                <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex items-start justify-between gap-4">
                    <div>
                        {isTrustedLender && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wider mb-3">
                <ShieldCheck size={14} weight="fill" /> Trusted Lender
              </span>
                        )}
                        <p className="label-eyebrow !text-white/60">Trust score</p>
                        <div className="flex items-end gap-2 mt-1">
                            <span className="font-head font-extrabold text-4xl leading-none">{score.toFixed(1)}</span>
                            <span className="text-white/60 text-sm mb-1">/ 5.0</span>
                        </div>
                        <div className="mt-2"><StarRating value={score} size={14} /></div>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                        <Star size={28} weight="fill" className="text-amber-300" />
                    </div>
                </div>
                {profile && (
                    <p className="relative text-sm text-white/70 mt-4 pt-4 border-t border-white/15">
                        {profile.completed_transactions} completed exchange{profile.completed_transactions !== 1 ? "s" : ""}
                        {" · "}
                        {profile.rating_count} rating{profile.rating_count !== 1 ? "s" : ""}
                    </p>
                )}
            </div>

            {/* Reputation factors */}
            <h2 className="font-head font-bold text-lg mb-3">How your score works</h2>
            <div className="bg-surface border border-line rounded-3xl shadow-card divide-y divide-line overflow-hidden mb-6">
                {REPUTATION_FACTORS.map((f) => (
                    <div key={f.label} className="flex items-center gap-3 p-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            f.positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                        }`}>
                            {f.positive ? <TrendUp size={16} weight="bold" /> : <TrendDown size={16} weight="bold" />}
                        </div>
                        <span className="flex-1 text-sm text-ink">{f.label}</span>
                        <span className={`text-sm font-bold ${f.positive ? "text-emerald-600" : "text-red-600"}`}>
              {f.delta}
            </span>
                    </div>
                ))}
            </div>

            {/* History timeline */}
            <h2 className="font-head font-bold text-lg mb-3">History</h2>
            <div className="space-y-3 mb-6">
                {timeline.length === 0 && (
                    <div className="bg-surface border border-line rounded-3xl p-4 shadow-card text-sm text-muted" data-testid="reputation-empty">
                        No reputation history yet — complete a borrow or return to start building your record.
                    </div>
                )}
                {timeline.map((entry, i) => (
                    <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="bg-surface border border-line rounded-3xl p-4 shadow-card"
                        data-testid={`reputation-event-${i}`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-ink text-sm">{entry.title}</span>
                            <span className={`text-sm font-bold ${
                                entry.delta.startsWith("+") ? "text-emerald-600" : "text-red-600"
                            }`}>
                {entry.delta}
              </span>
                        </div>
                        <p className="text-xs text-muted mt-1">{formatDate(entry.date)}</p>
                        {entry.detail && <p className="text-sm text-muted mt-2 leading-relaxed">{entry.detail}</p>}
                    </motion.div>
                ))}
            </div>

            <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate("/settings/governance")}
                data-testid="view-bylaws-btn"
            >
                View Full Bylaws
            </Button>
        </motion.div>
    );
}