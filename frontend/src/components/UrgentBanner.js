import React from "react";
import { motion } from "framer-motion";
import { Warning, ArrowRight } from "@phosphor-icons/react";

/** Full-width urgent returns alert — matches dashboard stat card scale */
export default function UrgentBanner({ count, onClick }) {
    if (!count || count < 1) return null;

    const label = count === 1 ? "1 urgent return" : `${count} urgent returns`;

    return (
        <motion.button
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className="w-full text-left rounded-4xl bg-gradient-to-br from-rose-500 via-red-500 to-red-600 text-white p-5 mb-5 flex items-center gap-4 shadow-glow-sm hover:brightness-[1.03] active:scale-[0.99] transition-all"
            data-testid="urgent-returns-banner"
        >
            <div className="w-14 h-14 rounded-2xl bg-white/25 flex items-center justify-center shrink-0">
                <Warning size={28} weight="fill" className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-head font-extrabold text-xl leading-tight tracking-tight">{label}</p>
                <p className="text-sm text-white/90 mt-1.5 leading-snug">
                    Items due within 24 hours or overdue — tap to review active loans below.
                </p>
            </div>
            <ArrowRight size={22} weight="bold" className="text-white/90 shrink-0" />
        </motion.button>
    );
}