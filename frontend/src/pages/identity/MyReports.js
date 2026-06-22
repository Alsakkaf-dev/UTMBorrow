import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Flag, Paperclip, Clock } from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { PageLoader, EmptyState } from "../../components/ui";

// report_status → display label + pill styling (SDD report status enum).
const STATUS_META = {
    Pending:       { label: "Pending",       cls: "bg-amber-50 text-amber-700 border-amber-100", dot: "bg-status-pending" },
    Under_Review:  { label: "Under review",  cls: "bg-blue-50 text-blue-700 border-blue-100",     dot: "bg-status-completed" },
    Dismissed:     { label: "Dismissed",     cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
    Actioned:      { label: "Actioned",      cls: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "bg-status-borrowed" },
};

function StatusPill({ status }) {
    const s = STATUS_META[status] || STATUS_META.Pending;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shrink-0 ${s.cls}`} data-testid={`report-status-${status}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {s.label}
    </span>
    );
}

function fmtDate(s) {
    if (!s) return "";
    try {
        return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
        return String(s).slice(0, 10);
    }
}

export default function MyReports() {
    const navigate = useNavigate();
    const [reports, setReports] = useState(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        api.get("/reports/mine")
            .then(({ data }) => setReports(data.reports || []))
            .catch((e) => { setErr(formatApiError(e.response?.data?.detail) || "Could not load your reports."); setReports([]); });
    }, []);

    if (reports === null && !err) return <PageLoader />;

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <button
                type="button"
                onClick={() => navigate("/settings/help")}
                className="flex items-center gap-1.5 text-muted text-sm mb-4 font-medium hover:text-ink transition-colors"
                data-testid="myreports-back"
            >
                <ArrowLeft size={16} weight="bold" /> Back to Help &amp; Support
            </button>

            <h1 className="font-head font-extrabold text-3xl tracking-tight mb-1">My reports</h1>
            <p className="text-sm text-muted mb-5">Track the status of reports you've submitted.</p>

            {err && (
                <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mb-4">{err}</div>
            )}

            {reports && reports.length === 0 ? (
                <EmptyState
                    icon={<Flag size={28} weight="fill" />}
                    title="No reports yet"
                    subtitle="Reports you submit on listings or members will appear here with their status."
                />
            ) : (
                <div className="space-y-3" data-testid="myreports-list">
                    {(reports || []).map((r) => (
                        <div
                            key={r.id}
                            className="bg-surface border border-line rounded-3xl p-4 shadow-card"
                            data-testid={`myreport-${r.id}`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-mono text-xs font-bold text-muted">#RP-{r.id.slice(0, 8).toUpperCase()}</p>
                                    <p className="font-head font-bold text-ink mt-0.5 leading-tight">
                                        {r.report_category.replace(/_/g, " ")}
                                    </p>
                                    <p className="text-xs text-muted mt-0.5 truncate">
                                        {r.is_user_report ? "Member: " : "Listing: "}{r.target_label}
                                    </p>
                                </div>
                                <StatusPill status={r.report_status} />
                            </div>

                            {r.description && (
                                <p className="text-sm text-ink/80 mt-2.5 leading-relaxed line-clamp-2">{r.description}</p>
                            )}

                            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-line text-[11px] text-muted">
                                <span className="inline-flex items-center gap-1"><Clock size={12} weight="bold" /> {fmtDate(r.submitted_at)}</span>
                                {r.incident_when && <span>· {r.incident_when}</span>}
                                {r.evidence_count > 0 && (
                                    <span className="inline-flex items-center gap-1"><Paperclip size={12} weight="bold" /> {r.evidence_count} evidence</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}