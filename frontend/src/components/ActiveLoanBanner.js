import React from "react";
import { motion } from "framer-motion";
import { Clock, ArrowRight } from "@phosphor-icons/react";

/** Prominent active-loan card — same visual weight as hero / urgent banners */
export default function ActiveLoanBanner({ loan, onReturn, onOpen }) {
    if (!loan) return null;

    const urgent = loan.lease?.is_overdue || loan.lease?.due_within_24h;
    const dueText = loan.lease?.is_overdue
        ? "Overdue — return as soon as possible"
        : loan.lease?.due_within_24h
            ? "Due back in less than 24 hours"
            : `Due back by ${loan.borrow_end_date}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-4xl p-5 mb-5 shadow-card border ${
                urgent
                    ? "bg-gradient-to-br from-rose-500 to-red-600 border-red-400/30 text-white"
                    : "bg-gradient-to-br from-indigo-600 to-brand-700 border-brand-500/20 text-white"
            }`}
            data-testid="active-loan-banner"
        >
            <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Clock size={28} weight="fill" className={urgent ? "text-white animate-pulse" : "text-white"} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-white/75">Active loan</p>
                    <p className="font-head font-extrabold text-xl leading-tight mt-1 truncate">{loan.item?.title}</p>
                    <p className="text-sm text-white/90 mt-1.5">{dueText}</p>
                </div>
            </div>
            <div className="flex gap-2.5 mt-4">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onReturn?.(); }}
                    className="flex-1 py-3 rounded-2xl bg-white text-brand-700 font-head font-bold text-sm shadow-soft hover:scale-[1.01] transition-transform"
                >
                    Return now
                </button>
                <button
                    type="button"
                    onClick={onOpen}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-white/15 border border-white/25 font-semibold text-sm hover:bg-white/25 transition-colors"
                >
                    Details <ArrowRight size={16} weight="bold" />
                </button>
            </div>
        </motion.div>
    );
}