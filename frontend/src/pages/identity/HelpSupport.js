import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    MagnifyingGlass,
    CaretDown,
    Copy,
    EnvelopeSimple,
    Flag,
    CaretRight,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { Button, Input, Textarea } from "../../components/ui";
import { toast } from "../../components/Toast";
import { api, formatApiError } from "../../lib/api";

const SUPPORT_EMAIL = "support@utmborrow.app";

const FAQ_CATEGORIES = [
    {
        id: "getting-started",
        title: "Getting started",
        items: [
            { q: "How do I create an account?", a: "Register with your UTM email and matric number. Verify your email to start borrowing and lending." },
            { q: "What can I borrow?", a: "Browse the catalog for textbooks, electronics, lab tools, and more listed by fellow students." },
            { q: "Is UTM Borrow free?", a: "Yes — it's a peer-to-peer sharing platform with no listing or borrowing fees." },
        ],
    },
    {
        id: "borrowing-lending",
        title: "Borrowing & lending",
        items: [
            { q: "How does a borrow request work?", a: "Find an item, send a request with your preferred dates, and wait for the lender to approve." },
            { q: "What happens at handover?", a: "Both parties scan the transaction QR code to confirm the item exchange on the spot." },
            { q: "What if I'm late returning?", a: "Late returns affect your trust score. You'll receive reminders before and after the due date." },
        ],
    },
    {
        id: "safety-trust",
        title: "Safety & trust",
        items: [
            { q: "How is trust score calculated?", a: "Your score reflects on-time returns, ratings, completed exchanges, and any upheld reports." },
            { q: "How do I report a problem?", a: "Use the report button on a user's profile or item listing. Moderators review all reports." },
            { q: "What if an item is damaged?", a: "Document the condition at handover and return. File a report if there's a dispute." },
        ],
    },
];

function FaqItem({ item, open, onToggle }) {
    return (
        <div className="border-b border-line last:border-0">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between gap-3 py-3.5 text-left"
            >
                <span className="text-sm font-semibold text-ink">{item.q}</span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <CaretDown size={16} className="text-muted shrink-0" weight="bold" />
                </motion.span>
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <p className="text-sm text-muted pb-3.5 leading-relaxed">{item.a}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function HelpSupport() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [query, setQuery] = useState("");
    const [openKey, setOpenKey] = useState(null);
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);

    const submitHelp = async (e) => {
        e.preventDefault();
        if (subject.trim().length < 2 || message.trim().length < 2) {
            toast.error("Add a short subject and message.");
            return;
        }
        setSending(true);
        try {
            await api.post("/help", { subject: subject.trim(), message: message.trim() });
            toast.success("Help request sent — an admin has been notified.");
            setSubject("");
            setMessage("");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Could not send help request.");
        } finally {
            setSending(false);
        }
    };

    const normalizedQuery = query.trim().toLowerCase();

    const filteredCategories = FAQ_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.items.filter(
            (item) =>
                !normalizedQuery ||
                item.q.toLowerCase().includes(normalizedQuery) ||
                item.a.toLowerCase().includes(normalizedQuery)
        ),
    })).filter((cat) => cat.items.length > 0);

    const emailSupport = () => {
        const subject = encodeURIComponent("UTM Borrow — support request");
        const body = encodeURIComponent(`\n\n———\nFrom: ${user.email}`);
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    };

    const copyEmail = async () => {
        try {
            await navigator.clipboard.writeText(SUPPORT_EMAIL);
            toast.success("Support email copied to clipboard.");
        } catch {
            toast.info(`Reach us at ${SUPPORT_EMAIL}`);
        }
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

            <h1 className="font-head font-extrabold text-3xl tracking-tight mb-1">Help & Support</h1>
            <p className="text-sm text-muted mb-5">Find answers or reach out to the UTM Borrow team.</p>

            <div className="mb-5">
                <Input
                    placeholder="Search help articles..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    icon={<MagnifyingGlass size={18} />}
                    data-testid="help-search"
                />
            </div>

            {/* Submission status — view the reports this user has filed (UC3301) */}
            <button
                type="button"
                onClick={() => navigate("/settings/reports")}
                className="w-full flex items-center gap-3 bg-surface border border-line rounded-3xl p-4 shadow-card mb-5 hover:border-brand-200 transition-colors text-left"
                data-testid="help-my-reports"
            >
        <span className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
          <Flag size={18} weight="fill" />
        </span>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm">My reports</p>
                    <p className="text-xs text-muted mt-0.5">Track the status of reports you've submitted.</p>
                </div>
                <CaretRight size={16} className="text-slate-300 shrink-0" />
            </button>

            <div className="space-y-4 mb-6">
                {filteredCategories.length === 0 ? (
                    <div className="text-center py-8 bg-surface border border-line rounded-3xl text-sm text-muted">
                        No articles match your search.
                    </div>
                ) : (
                    filteredCategories.map((cat, ci) => (
                        <motion.div
                            key={cat.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: ci * 0.04 }}
                            className="bg-surface border border-line rounded-3xl shadow-card px-4 py-2"
                            data-testid={`faq-category-${cat.id}`}
                        >
                            <p className="label-eyebrow pt-2">{cat.title}</p>
                            {cat.items.map((item, ii) => {
                                const key = `${cat.id}-${ii}`;
                                return (
                                    <FaqItem
                                        key={key}
                                        item={item}
                                        open={openKey === key}
                                        onToggle={() => setOpenKey(openKey === key ? null : key)}
                                    />
                                );
                            })}
                        </motion.div>
                    ))
                )}
            </div>

            {/* Get help — opens a live ticket that pings admins in real time */}
            <form onSubmit={submitHelp} className="bg-surface border border-line rounded-3xl p-5 shadow-card" data-testid="get-help-card">
                <p className="label-eyebrow">Still need help?</p>
                <h2 className="font-head font-bold text-lg text-ink mt-1">Get help</h2>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                    Send a request and an administrator is notified instantly. We'll follow up with{" "}
                    <span className="font-semibold text-ink break-all">{user.email}</span>.
                </p>
                <div className="space-y-3 mt-4">
                    <Input
                        placeholder="Subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        maxLength={150}
                        data-testid="help-subject"
                    />
                    <Textarea
                        placeholder="Describe your issue..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={4}
                        maxLength={2000}
                        data-testid="help-message"
                    />
                </div>
                <Button type="submit" className="w-full mt-4" loading={sending} data-testid="get-help-btn">
                    Get help now
                </Button>

                <div className="flex gap-2.5 mt-3">
                    <Button type="button" variant="secondary" className="flex-1" onClick={emailSupport} data-testid="message-support-btn">
                        <EnvelopeSimple size={16} weight="bold" /> Email support
                    </Button>
                    <Button type="button" variant="secondary" className="flex-1" onClick={copyEmail} data-testid="copy-support-email-btn">
                        <Copy size={16} weight="bold" /> Copy email
                    </Button>
                </div>
            </form>
        </motion.div>
    );
}