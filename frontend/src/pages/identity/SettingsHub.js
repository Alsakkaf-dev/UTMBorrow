import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ShieldCheck,
    Bell,
    Star,
    Question,
    Scales,
    CaretRight,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { Avatar, StarRating } from "../../components/ui";

const MENU_ITEMS = [
    {
        to: "/settings/security",
        icon: ShieldCheck,
        title: "Account & Security",
        subtitle: "Email, password, 2FA, sessions",
    },
    {
        to: "/settings/notifications",
        icon: Bell,
        title: "Notifications",
        subtitle: "Email, push, and in-app alerts",
    },
    {
        to: "/settings/reputation",
        icon: Star,
        title: "Reputation & Trust",
        subtitle: "Score, badges, and history",
    },
    {
        to: "/settings/help",
        icon: Question,
        title: "Help & Support",
        subtitle: "FAQ, contact, and guides",
    },
    {
        to: "/settings/governance",
        icon: Scales,
        title: "Governance",
        subtitle: "Community rules and bylaws",
    },
];

function MenuRow({ item, onClick, index }) {
    const Icon = item.icon;
    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-brand-50/40 transition-colors first:rounded-t-3xl last:rounded-b-3xl"
            data-testid={`settings-link-${item.to.split("/").pop()}`}
        >
            <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                <Icon size={20} weight="fill" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm">{item.title}</p>
                <p className="text-xs text-muted mt-0.5 truncate">{item.subtitle}</p>
            </div>
            <CaretRight size={18} className="text-slate-300 shrink-0" weight="bold" />
        </motion.button>
    );
}

export default function SettingsHub() {
    const { user } = useAuth();
    const navigate = useNavigate();

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-head font-extrabold text-3xl tracking-tight mb-5">Settings</h1>

            {/* Profile card */}
            <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface border border-line rounded-3xl p-5 shadow-card mb-5 relative overflow-hidden"
                data-testid="settings-profile-card"
            >
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-brand-50 blur-xl pointer-events-none" />
                <div className="relative flex items-center gap-3.5">
                    <Avatar name={user.full_name} src={user.profile_picture} size={52} />
                    <div className="flex-1 min-w-0">
                        <p className="font-head font-bold text-lg text-ink truncate">{user.full_name}</p>
                        <p className="text-xs text-muted mt-0.5 truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                            <StarRating value={user.trust_score} size={12} />
                            <span className="text-xs font-semibold text-ink">{Number(user.trust_score).toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Menu list */}
            <div className="bg-surface border border-line rounded-3xl shadow-card divide-y divide-line overflow-hidden">
                {MENU_ITEMS.map((item, i) => (
                    <MenuRow
                        key={item.to}
                        item={item}
                        index={i}
                        onClick={() => navigate(item.to)}
                    />
                ))}
            </div>

            <p className="text-center text-xs text-muted mt-6">
                Manage account deletion under{" "}
                <button
                    type="button"
                    onClick={() => navigate("/settings/security")}
                    className="font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                    data-testid="settings-go-security"
                >
                    Account &amp; Security
                </button>
                .
            </p>
        </motion.div>
    );
}