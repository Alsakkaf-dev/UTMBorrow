import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui";
import { toast } from "../../components/Toast";

const CHANNELS = ["email", "push", "inApp"];

const DEFAULT_GROUPS = {
    requestAlerts: { email: true, push: true, inApp: true },
    approvalAlerts: { email: true, push: true, inApp: true },
    handoverReminders: { email: false, push: true, inApp: true },
    returnReminders: { email: true, push: true, inApp: true },
    moderation: { email: true, push: false, inApp: true },
};

const GROUPS = [
    { key: "requestAlerts", title: "Request alerts", subtitle: "When someone requests your item" },
    { key: "approvalAlerts", title: "Approval alerts", subtitle: "When your borrow request is approved or rejected" },
    { key: "handoverReminders", title: "Handover reminders", subtitle: "Upcoming handover appointments" },
    { key: "returnReminders", title: "Return reminders", subtitle: "Due dates and overdue notices" },
    { key: "moderation", title: "Moderation", subtitle: "Reports, suspensions, and admin actions" },
];

const CHANNEL_LABELS = { email: "Email", push: "Push", inApp: "In-app" };

function Toggle({ checked, onChange, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${
                checked ? "bg-brand-500" : "bg-slate-200"
            }`}
        >
            <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-soft ${
                    checked ? "left-[22px]" : "left-0.5"
                }`}
            />
        </button>
    );
}

export default function NotificationPreferences() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [prefs, setPrefs] = useState(DEFAULT_GROUPS);

    const toggle = (groupKey, channel) => {
        setPrefs((prev) => ({
            ...prev,
            [groupKey]: { ...prev[groupKey], [channel]: !prev[groupKey][channel] },
        }));
    };

    const save = () => {
        toast.success("Notification preferences saved.");
    };

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

            <h1 className="font-head font-extrabold text-3xl tracking-tight mb-1">Notifications</h1>
            <p className="text-sm text-muted mb-5">Choose how {user.full_name.split(" ")[0]} receives updates.</p>

            <div className="space-y-4 mb-6">
                {GROUPS.map((group, gi) => (
                    <motion.div
                        key={group.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: gi * 0.04 }}
                        className="bg-surface border border-line rounded-3xl shadow-card p-4"
                        data-testid={`notif-group-${group.key}`}
                    >
                        <div className="mb-3">
                            <p className="font-semibold text-ink text-sm">{group.title}</p>
                            <p className="text-xs text-muted mt-0.5">{group.subtitle}</p>
                        </div>
                        <div className="space-y-2.5">
                            {CHANNELS.map((ch) => (
                                <div key={ch} className="flex items-center justify-between">
                                    <span className="text-sm text-muted">{CHANNEL_LABELS[ch]}</span>
                                    <Toggle
                                        checked={prefs[group.key][ch]}
                                        onChange={() => toggle(group.key, ch)}
                                        label={`${group.title} ${CHANNEL_LABELS[ch]}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </motion.div>
                ))}
            </div>

            <Button className="w-full" onClick={save} data-testid="save-notif-prefs">
                Save preferences
            </Button>
        </motion.div>
    );
}