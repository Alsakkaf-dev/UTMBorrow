import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardText, DownloadSimple, CaretDown, CaretUp } from "@phosphor-icons/react";
import { adminApi, formatApiError } from "../../lib/api";
import { useRealtimeEvent } from "../../lib/realtime";
import { EmptyState, Spinner, SearchBar, PageHeader } from "../../components/ui";
import { toast } from "../../components/Toast";

const TINT = {
  Session_Elevated: { text: "text-brand-600",   bg: "bg-brand-50"   },
  Force_Cancel:     { text: "text-rose-600",    bg: "bg-rose-50"    },
  Force_Complete:   { text: "text-emerald-600", bg: "bg-emerald-50" },
  Reminder_Sent:    { text: "text-amber-600",   bg: "bg-amber-50"   },
  Penalty_Applied:  { text: "text-rose-600",    bg: "bg-rose-50"    },
  User_Suspended:   { text: "text-rose-600",    bg: "bg-rose-50"    },
  User_Reinstated:  { text: "text-emerald-600", bg: "bg-emerald-50" },
  Report_Resolved:  { text: "text-emerald-600", bg: "bg-emerald-50" },
  Report_Dismissed: { text: "text-slate-600",   bg: "bg-slate-100"  },
  Item_Deleted:     { text: "text-rose-600",    bg: "bg-rose-50"    },
  User_Deleted:     { text: "text-rose-600",    bg: "bg-rose-50"    },
  Desk_Handover:    { text: "text-emerald-600", bg: "bg-emerald-50" },
  Desk_Return:      { text: "text-blue-600",    bg: "bg-blue-50"    },
};

const ALL_ACTION_TYPES = Object.keys(TINT);

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(entries) {
  const headers = ["Timestamp", "Admin", "Role", "Action", "Summary"];
  const rows = entries.map((e) => [
    (e.created_at || "").slice(0, 16).replace("T", " "),
    e.admin_name || "",
    (e.admin_role || "").replace(/_/g, " "),
    (e.action_type || "").replace(/_/g, " "),
    e.summary || "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Single entry row ─────────────────────────────────────────────────────────

function AuditRow({ entry, index }) {
  const [expanded, setExpanded] = useState(false);
  const tint = TINT[entry.action_type] || { text: "text-slate-600", bg: "bg-slate-100" };
  const hasDetails = entry.details && Object.keys(entry.details).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.25) }}
      className="relative bg-surface border border-line rounded-2xl shadow-soft overflow-hidden"
      data-testid={`admin-audit-${entry.id}`}
    >
      {/* Timeline dot */}
      <span className="absolute -left-[18px] top-4 w-3 h-3 rounded-full bg-brand-gradient ring-2 ring-white" />

      {/* Main row */}
      <button
        className={`w-full text-left px-4 py-3.5 ${hasDetails ? "hover:bg-canvas transition-colors" : ""}`}
        onClick={() => hasDetails && setExpanded((v) => !v)}
        disabled={!hasDetails}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${tint.bg} ${tint.text}`}>
              {(entry.action_type || "").replace(/_/g, " ")}
            </span>
            <span className="text-[11px] text-muted font-medium shrink-0 whitespace-nowrap">
              {(entry.created_at || "").slice(0, 16).replace("T", " ")}
            </span>
          </div>
          {hasDetails && (
            <span className="text-muted shrink-0 mt-0.5">
              {expanded ? <CaretUp size={13} weight="bold" /> : <CaretDown size={13} weight="bold" />}
            </span>
          )}
        </div>
        <p className="text-sm text-ink mt-1.5 leading-snug">{entry.summary}</p>
        <p className="text-[11px] text-muted mt-1">
          by <span className="font-semibold">{entry.admin_name || "Admin"}</span>
          {entry.admin_role ? ` · ${entry.admin_role.replace(/_/g, " ")}` : ""}
        </p>
      </button>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-line"
          >
            <pre className="px-4 py-3 text-[11px] text-muted font-mono bg-canvas overflow-x-auto leading-relaxed">
              {JSON.stringify(entry.details, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AdminAudit() {
  const [entries, setEntries] = useState(null);
  const [q, setQ] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await adminApi.get("/admin/audit", { params: { limit: 500 } });
      setEntries(data.entries || []);
    } catch (err) {
      // Never leave the page spinning forever or throw an unhandled rejection.
      setEntries([]);
      toast.error(formatApiError(err.response?.data?.detail) || "Could not load the audit log.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeEvent("admin.changed", load);

  // ─── Filter ────────────────────────────────────────────────────────────────

  const filtered = (entries || []).filter((e) => {
    if (q) {
      const term = q.toLowerCase();
      const match =
        (e.summary || "").toLowerCase().includes(term) ||
        (e.admin_name || "").toLowerCase().includes(term) ||
        (e.action_type || "").toLowerCase().replace(/_/g, " ").includes(term);
      if (!match) return false;
    }
    if (actionFilter && e.action_type !== actionFilter) return false;
    if (dateFrom && (e.created_at || "") < dateFrom) return false;
    return true;
  });

  const hasFilter = q || actionFilter || dateFrom;

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        eyebrow="Accountability"
        title="Audit log"
        subtitle={entries ? `${filtered.length} of ${entries.length} entries` : ""}
        action={
          <button
            onClick={() => filtered.length && exportCSV(filtered)}
            disabled={!filtered.length}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink disabled:opacity-40 transition-colors px-3 py-2 rounded-xl hover:bg-canvas border border-transparent hover:border-line"
            data-testid="audit-export-csv"
          >
            <DownloadSimple size={15} weight="bold" /> Export CSV
          </button>
        }
      />

      {/* Filter bar — full-width search + two selects stacked on 430px */}
      <div className="flex flex-col gap-2.5">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Search by admin, action, summary…"
          className="w-full"
          testid="audit-search"
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="appearance-none w-full px-3 pr-8 py-2.5 bg-surface border border-line rounded-xl text-sm text-ink outline-none focus:border-brand-500 font-plex cursor-pointer"
              data-testid="audit-type-filter"
            >
              <option value="">All actions</option>
              {ALL_ACTION_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-2.5 bg-surface border border-line rounded-xl text-xs text-ink outline-none focus:border-brand-500 font-plex w-[130px] sm:w-auto"
            title="Show entries from this date"
            data-testid="audit-date-filter"
          />
        </div>
        {hasFilter && (
          <button
            onClick={() => { setQ(""); setActionFilter(""); setDateFrom(""); }}
            className="text-xs text-brand-600 font-semibold hover:underline text-left"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Timeline */}
      {!entries ? (
        <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={hasFilter ? "No entries match" : "No actions yet"}
          subtitle={hasFilter ? "Try adjusting your filters." : "Every admin action will be recorded here, immutably."}
          icon={<ClipboardText size={26} />}
        />
      ) : (
        <div className="relative pl-6 space-y-2.5" data-testid="admin-audit-list">
          {/* Vertical timeline line */}
          <div className="absolute left-2 top-2 bottom-2 w-px bg-line" />
          {filtered.map((e, i) => (
            <AuditRow key={e.id} entry={e} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
