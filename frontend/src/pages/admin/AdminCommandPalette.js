import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  MagnifyingGlass, Gauge, ArrowsLeftRight, UsersThree, Bell, Flag,
  Clock, QrCode, ClipboardText, ChartLine, ArrowRight, User,
  Package, X,
} from "@phosphor-icons/react";
import { adminApi } from "../../lib/api";

const QUICK_PAGES = [
  { label: "Overview",      to: "/admin",             icon: Gauge,           group: "Navigate" },
  { label: "Analytics",     to: "/admin/analytics",   icon: ChartLine,       group: "Navigate" },
  { label: "Transactions",  to: "/admin/transactions", icon: ArrowsLeftRight, group: "Navigate" },
  { label: "Overdue loans", to: "/admin/overdue",     icon: Clock,           group: "Navigate" },
  { label: "Users",         to: "/admin/users",       icon: UsersThree,      group: "Navigate" },
  { label: "Inbox",         to: "/admin/inbox",       icon: Bell,            group: "Navigate" },
  { label: "Reports",       to: "/admin/reports",     icon: Flag,            group: "Navigate" },
  { label: "Desk scan",     to: "/admin/scan",        icon: QrCode,          group: "Navigate" },
  { label: "Audit log",     to: "/admin/audit",       icon: ClipboardText,   group: "Navigate" },
];

export default function AdminCommandPalette({ open, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [txs, setTxs] = useState([]);
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      setUsers([]);
      setTxs([]);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  // Debounced live search
  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setUsers([]);
      setTxs([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const [uRes, tRes] = await Promise.all([
          adminApi.get("/admin/users", { params: { q: q.trim() } }),
          adminApi.get("/admin/transactions", { params: { q: q.trim() } }),
        ]);
        setUsers((uRes.data.users || []).slice(0, 5));
        setTxs((tRes.data.transactions || []).slice(0, 5));
      } catch {
        // silently ignore
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  // Build flat results list for keyboard navigation
  const pages = q.trim()
    ? QUICK_PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase()))
    : QUICK_PAGES;

  const allResults = [
    ...pages.map((p) => ({ type: "page", ...p })),
    ...users.map((u) => ({ type: "user", label: u.full_name, sub: u.email, id: u.id, icon: User })),
    ...txs.map((t) => ({ type: "tx", label: t.item?.title || "Transaction", sub: `${t.borrower?.full_name} → ${t.lender?.full_name}`, id: t.id, icon: Package })),
  ];

  const safeIdx = Math.min(cursor, Math.max(allResults.length - 1, 0));

  const selectItem = useCallback((item) => {
    if (!item) return;
    if (item.type === "page") navigate(item.to);
    else if (item.type === "user") navigate(`/admin/users/${item.id}`);
    else if (item.type === "tx") navigate(`/admin/transactions/${item.id}`);
    onClose();
  }, [navigate, onClose]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, allResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectItem(allResults[safeIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cursor="true"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeIdx]);

  // Group consecutive items by group label
  const grouped = allResults.reduce((acc, item, i) => {
    const group = item.group || (item.type === "user" ? "Users" : item.type === "tx" ? "Transactions" : "Pages");
    if (!acc.length || acc[acc.length - 1].group !== group) {
      acc.push({ group, items: [{ ...item, idx: i }] });
    } else {
      acc[acc.length - 1].items.push({ ...item, idx: i });
    }
    return acc;
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[12vh] px-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-xl bg-surface rounded-3xl border border-line shadow-pop overflow-hidden"
            data-testid="admin-command-palette"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
              <MagnifyingGlass size={18} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setCursor(0); }}
                onKeyDown={onKeyDown}
                placeholder="Search pages, users, transactions…"
                className="flex-1 outline-none bg-transparent text-sm font-plex text-ink placeholder:text-slate-400"
              />
              <div className="flex items-center gap-2">
                {searching && (
                  <span className="w-4 h-4 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                )}
                <button onClick={onClose} className="text-slate-400 hover:text-ink p-0.5">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Results */}
            <div ref={listRef} className="overflow-y-auto max-h-[420px] py-2">
              {allResults.length === 0 && !searching && q.trim().length >= 2 && (
                <p className="px-4 py-8 text-center text-sm text-muted">No results for "{q}"</p>
              )}
              {grouped.map(({ group, items }) => (
                <div key={group}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted">{group}</p>
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.idx === safeIdx;
                    return (
                      <button
                        key={`${item.type}-${item.id || item.to}`}
                        data-cursor={isActive ? "true" : undefined}
                        onMouseEnter={() => setCursor(item.idx)}
                        onClick={() => selectItem(item)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isActive ? "bg-brand-50" : "hover:bg-slate-50"}`}
                      >
                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-brand-gradient text-white" : "bg-surface-2 text-muted"}`}>
                          <Icon size={15} weight="bold" />
                        </span>
                        <span className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{item.label}</p>
                          {item.sub && <p className="text-xs text-muted truncate">{item.sub}</p>}
                        </span>
                        <ArrowRight size={13} className={`shrink-0 transition-opacity ${isActive ? "text-brand-500 opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100"}`} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="border-t border-line px-4 py-2 flex items-center gap-3 text-[11px] text-muted">
              <span><kbd className="font-plex px-1.5 py-0.5 bg-canvas rounded border border-line">↑↓</kbd> navigate</span>
              <span><kbd className="font-plex px-1.5 py-0.5 bg-canvas rounded border border-line">↵</kbd> open</span>
              <span><kbd className="font-plex px-1.5 py-0.5 bg-canvas rounded border border-line">Esc</kbd> close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
