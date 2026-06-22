import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Scales, CheckCircle, Prohibit, Warning } from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui";

const COMMUNITY_RULES = [
    {
        icon: CheckCircle,
        title: "Be honest and transparent",
        body: "Accurately describe item condition, availability, and return expectations in every listing.",
    },
    {
        icon: Scales,
        title: "Honor commitments",
        body: "Approved requests are binding. Cancel only when necessary and communicate promptly.",
    },
    {
        icon: Warning,
        title: "Respect campus property",
        body: "Do not list prohibited, dangerous, or university-owned equipment without authorization.",
    },
    {
        icon: Prohibit,
        title: "Zero tolerance for abuse",
        body: "Harassment, fraud, and repeated no-shows may result in suspension or permanent removal.",
    },
];

const BYLAWS = [
    "All exchanges must be confirmed via QR scan at handover and return.",
    "Trust scores below 3.0 may restrict borrowing privileges.",
    "Reports are reviewed by moderators within 72 hours.",
    "Penalties for overdue returns escalate after 48 hours past due.",
    "Disputes unresolved after 7 days are escalated to campus administration.",
];

export default function Governance() {
    const { user } = useAuth();
    const navigate = useNavigate();

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

            <div className="flex items-center gap-2 mb-1">
                <Scales size={24} weight="fill" className="text-brand-500" />
                <h1 className="font-head font-extrabold text-3xl tracking-tight">Governance</h1>
            </div>
            <p className="text-sm text-muted mb-6">
                Community rules and bylaws for the UTM Borrow platform.
            </p>

            <h2 className="font-head font-bold text-lg mb-3">Community rules</h2>
            <div className="space-y-3 mb-6">
                {COMMUNITY_RULES.map((rule, i) => {
                    const Icon = rule.icon;
                    return (
                        <motion.div
                            key={rule.title}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="bg-surface border border-line rounded-3xl p-4 shadow-card flex gap-3.5"
                        >
                            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                                <Icon size={20} weight="fill" />
                            </div>
                            <div>
                                <p className="font-semibold text-ink text-sm">{rule.title}</p>
                                <p className="text-sm text-muted mt-1 leading-relaxed">{rule.body}</p>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <h2 className="font-head font-bold text-lg mb-3">Platform bylaws</h2>
            <div className="bg-surface border border-line rounded-3xl p-5 shadow-card mb-6">
                <p className="label-eyebrow">Effective for all members</p>
                <ul className="mt-3 space-y-2.5">
                    {BYLAWS.map((line) => (
                        <li key={line} className="flex gap-2.5 text-sm text-muted leading-relaxed">
                            <span className="text-brand-500 font-bold shrink-0">·</span>
                            {line}
                        </li>
                    ))}
                </ul>
                <p className="text-xs text-muted mt-4 pt-4 border-t border-line">
                    Your current trust score: {Number(user.trust_score).toFixed(1)} / 5.0
                </p>
            </div>

            <Button variant="secondary" className="w-full" onClick={() => navigate("/settings")}>
                Back to settings
            </Button>
        </motion.div>
    );
}