import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, DownloadSimple, CalendarBlank } from "@phosphor-icons/react";
import { adminApi } from "../../lib/api";
import { useRealtimeEvent } from "../../lib/realtime";
import {
  EmptyState, StatusBadge, UrgentBadge, Spinner,
  SearchBar, DataTable, SlideDrawer, Button, Chip,
} from "../../components/ui";
import AdminTransactionDetail from "./AdminTransactionDetail";

const FILTERS = ["All", "Pending", "Approved", "Borrowed", "Completed", "Rejected", "Cancelled"];

// ─── CSV export helper ────────────────────────────────────────────────────────

function exportCSV(transactions) {
  const headers = ["ID", "Item", "Borrower", "Lender", "Status", "Start Date", "Due Date"];
  const rows = transactions.map((tx) => [
    tx.id,
    tx.item?.title || "",
    tx.borrower?.full_name || "",
    tx.lender?.full_name || "",
    tx.status,
    tx.borrow_start_date || "",
    tx.borrow_end_date || "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Table columns ────────────────────────────────────────────────────────────

const TABLE_COLS = [
  {
    key: "item", label: "Item", render: (v, row) => (
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 bg-brand-gradient flex items-center justify-center">
          {v?.photo_url
            ? <img src={v.photo_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-white font-bold text-sm">{v?.title?.[0]}</span>}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-ink text-sm truncate leading-tight">{v?.title}</p>
          <p className="text-xs text-muted truncate">{v?.category}</p>
        </div>
      </div>
    ),
  },
  {
    key: "status", label: "Status", sortable: true, render: (v, row) => {
      const urgent = row.status === "Borrowed" && row.lease && (row.lease.is_overdue || row.lease.due_within_24h);
      return (
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={v} />
          {urgent && <UrgentBadge overdue={row.lease?.is_overdue} />}
        </div>
      );
    },
  },
  {
    key: "borrower", label: "Borrower → Lender", render: (v, row) => (
      <p className="text-sm text-ink truncate">
        {v?.full_name} <span className="text-muted">→</span> {row.lender?.full_name}
      </p>
    ),
  },
  {
    key: "borrow_end_date", label: "Due", sortable: true, render: (v) => (
      <span className="text-sm text-muted font-medium tabular-nums whitespace-nowrap">{v || "—"}</span>
    ),
  },
];

export default function AdminTransactions() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "All";
  const [q, setQ] = useState("");
  const [items, setItems] = useState(null);
  const [sortKey, setSortKey] = useState("borrow_end_date");
  const [sortDir, setSortDir] = useState("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [drawerTxId, setDrawerTxId] = useState(null);

  const load = useCallback(async () => {
    const p = { status, q: q || undefined };
    const { data } = await adminApi.get("/admin/transactions", { params: p });
    setItems(data.transactions);
  }, [status, q]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const tmr = useRef(null);
  useRealtimeEvent("transaction.updated", () => { clearTimeout(tmr.current); tmr.current = setTimeout(load, 250); });
  useRealtimeEvent("admin.changed", () => { clearTimeout(tmr.current); tmr.current = setTimeout(load, 250); });

  const setStatus = (s) => setParams(s === "All" ? {} : { status: s });

  // ─── Sort ────────────────────────────────────────────────────────────────────

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ─── Filter by date ──────────────────────────────────────────────────────────

  const filtered = (items || []).filter((tx) => {
    if (dateFrom && tx.borrow_start_date && tx.borrow_start_date < dateFrom) return false;
    if (dateTo && tx.borrow_end_date && tx.borrow_end_date > dateTo) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const activeDateFilter = dateFrom || dateTo;

  return (
    <div data-testid="admin-transactions-page" className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-eyebrow">Oversight</p>
          <h1 className="font-head font-extrabold text-xl md:text-2xl tracking-tight text-ink">Transactions</h1>
          {items && <p className="text-xs text-muted mt-0.5">{sorted.length} of {items.length}</p>}
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => exportCSV(sorted)}
          disabled={!sorted.length}
          data-testid="export-csv"
        >
          <DownloadSimple size={15} weight="bold" />
          <span className="hidden sm:inline">Export CSV</span>
        </Button>
      </div>

      {/* Search + date range — stacked on mobile */}
      <div className="flex flex-col gap-2.5">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Search item, borrower or lender…"
          className="w-full"
          testid="admin-tx-search"
        />
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Button
              variant={activeDateFilter ? "soft" : "secondary"}
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setDateOpen((v) => !v)}
              data-testid="date-filter-btn"
            >
              <CalendarBlank size={15} weight="bold" />
              {activeDateFilter ? "Date filtered" : "Date range"}
            </Button>
            <AnimatePresence>
              {dateOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 z-30 bg-surface border border-line rounded-2xl shadow-pop p-4 w-[280px] max-w-[calc(100vw-2rem)]"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Date range</p>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-muted">
                      From
                      <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-canvas border border-line rounded-xl text-sm text-ink outline-none focus:border-brand-500 font-plex" />
                    </label>
                    <label className="block text-xs font-medium text-muted">
                      To
                      <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                        className="mt-1 w-full px-3 py-2 bg-canvas border border-line rounded-xl text-sm text-ink outline-none focus:border-brand-500 font-plex" />
                    </label>
                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button>
                      <Button size="sm" className="flex-1" onClick={() => setDateOpen(false)}>Apply</Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <Chip key={f} active={status === f} onClick={() => setStatus(f)} data-testid={`admin-filter-${f}`}>
            {f}
          </Chip>
        ))}
      </div>

      {/* Table / loading / empty */}
      {!items ? (
        <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div>
      ) : sorted.length === 0 ? (
        <EmptyState title="No transactions" subtitle="Nothing matches this filter." icon="✓" />
      ) : (
        <>
          {/* Desktop: DataTable */}
          <div className="hidden sm:block">
            <DataTable
              columns={[...TABLE_COLS, {
                key: "_caret", label: "", render: () => <ArrowRight size={15} className="text-slate-300" />, tdClassName: "text-right", width: "40px",
              }]}
              rows={sorted}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onRowClick={(row) => setDrawerTxId(row.id)}
              testid="admin-tx-table"
              rowTestid="admin-tx-row"
            />
          </div>

          {/* Mobile: card list */}
          <div className="sm:hidden space-y-3" data-testid="admin-tx-list">
            <AnimatePresence mode="popLayout">
              {sorted.map((tx, i) => {
                const urgent = tx.status === "Borrowed" && tx.lease && (tx.lease.is_overdue || tx.lease.due_within_24h);
                return (
                  <motion.button
                    layout key={tx.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: Math.min(i * 0.03, 0.2) }}
                    whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
                    onClick={() => navigate(`/admin/transactions/${tx.id}`)}
                    data-testid={`admin-tx-${tx.id}`}
                    className="w-full text-left bg-surface border border-line rounded-3xl p-3.5 flex items-center gap-3.5 shadow-card hover:shadow-pop hover:border-brand-200 transition-all"
                  >
                    <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-brand-gradient">
                      {tx.item?.photo_url ? <img src={tx.item.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="font-head font-bold text-xl text-white/90">{tx.item?.title?.[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusBadge status={tx.status} />
                        {urgent && <UrgentBadge overdue={tx.lease.is_overdue} />}
                      </div>
                      <p className="font-head font-semibold text-ink truncate">{tx.item?.title}</p>
                      <p className="text-xs text-muted truncate mt-0.5">{tx.borrower?.full_name} → {tx.lender?.full_name} · due {tx.borrow_end_date}</p>
                    </div>
                    <ArrowRight size={18} className="text-slate-300 shrink-0" />
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Transaction detail slide drawer (desktop quick-view) */}
      <SlideDrawer
        open={!!drawerTxId}
        onClose={() => setDrawerTxId(null)}
        title="Transaction detail"
        width="sm:w-[640px]"
        testid="admin-tx-drawer"
      >
        {drawerTxId && (
          <div>
            {/* Reuse the full detail page component but embedded */}
            <AdminTransactionDetail embedded txId={drawerTxId} />
          </div>
        )}
      </SlideDrawer>
    </div>
  );
}
