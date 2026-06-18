import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Star,
  HandArrowDown,
  HandArrowUp,
  ChartLineUp,
} from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Chip, EmptyState, PageLoader, StatusBadge } from "../../components/ui";

const ROLE_FILTERS = ["All", "Borrowed", "Lent"];

function formatDate(value) {
  if (!value) return "—";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(value).slice(0, 10);
  }
}

function sortKey(tx) {
  return tx.created_at || tx.updated_at || tx.borrow_start_date || "";
}

export default function TransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("All");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/dashboard");
      const borrowed = (data.borrowing || []).map((tx) => ({
        ...tx,
        role: "borrowed",
      }));
      const lent = (data.lending || []).map((tx) => ({
        ...tx,
        role: "lent",
      }));
      const combined = [...borrowed, ...lent].sort((a, b) =>
        sortKey(b).localeCompare(sortKey(a))
      );
      setTransactions(combined);
    } catch (err) {
      console.error("Failed to load transaction history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = transactions.length;
    const completed = transactions.filter((t) => t.status === "Completed").length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgRating = user?.trust_score != null ? Number(user.trust_score) : null;
    return { total, successRate, avgRating };
  }, [transactions, user?.trust_score]);

  const filtered = useMemo(() => {
    if (roleFilter === "All") return transactions;
    const role = roleFilter === "Borrowed" ? "borrowed" : "lent";
    return transactions.filter((t) => t.role === role);
  }, [transactions, roleFilter]);

  if (loading) return <PageLoader />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <p className="label-eyebrow">Your exchanges</p>
      <h1 className="font-head font-extrabold text-3xl tracking-tight text-ink mb-5">
        Transaction History
      </h1>

      <div className="rounded-3xl border border-line bg-surface p-5 shadow-card mb-5 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-brand-50 blur-xl pointer-events-none" />
        <div className="relative grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-head font-extrabold text-2xl tracking-tight text-brand-600 tabular-nums">
              {stats.total}
            </p>
            <p className="label-eyebrow mt-1 !text-[9px]">Total</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <ChartLineUp size={16} weight="fill" className="text-emerald-500" />
              <p className="font-head font-extrabold text-2xl tracking-tight text-emerald-600 tabular-nums">
                {stats.successRate}%
              </p>
            </div>
            <p className="label-eyebrow mt-1 !text-[9px]">Success rate</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <Star size={16} weight="fill" className="text-amber-400" />
              <p className="font-head font-extrabold text-2xl tracking-tight text-ink tabular-nums">
                {stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"}
              </p>
            </div>
            <p className="label-eyebrow mt-1 !text-[9px]">Avg rating</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1 mb-4">
        {ROLE_FILTERS.map((f) => (
          <Chip
            key={f}
            active={roleFilter === f}
            onClick={() => setRoleFilter(f)}
            data-testid={`history-filter-${f.toLowerCase()}`}
          >
            <span className="inline-flex items-center gap-1.5">
              {f === "Borrowed" && <HandArrowDown size={14} weight="bold" />}
              {f === "Lent" && <HandArrowUp size={14} weight="bold" />}
              {f}
            </span>
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          subtitle="Your completed and past borrows and loans will show up here."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((tx, i) => {
            const counterparty =
              tx.role === "borrowed" ? tx.lender : tx.borrower;
            const roleLabel = tx.role === "borrowed" ? "Borrowed from" : "Lent to";

            return (
              <motion.div
                key={`${tx.role}-${tx.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="rounded-3xl border border-line bg-surface p-4 shadow-card"
                data-testid={`history-tx-${tx.id}`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-brand-gradient">
                    {tx.item?.photo_url ? (
                      <img
                        src={tx.item.photo_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-head font-bold text-xl text-white/90">
                        {tx.item?.title?.[0] || "?"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <StatusBadge status={tx.status} />
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          tx.role === "borrowed"
                            ? "bg-brand-50 text-brand-700 border-brand-100"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100"
                        }`}
                      >
                        {tx.role === "borrowed" ? "Borrowed" : "Lent"}
                      </span>
                    </div>
                    <p className="font-head font-semibold text-ink text-sm truncate">
                      {tx.item?.title || "Unknown item"}
                    </p>
                    {tx.item?.category && (
                      <p className="text-[11px] text-muted mt-0.5">{tx.item.category}</p>
                    )}
                    <p className="text-xs text-muted mt-1.5">
                      {roleLabel}{" "}
                      <span className="font-medium text-ink">
                        {counterparty?.full_name || "Unknown"}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">
                      {formatDate(tx.borrow_start_date)} – {formatDate(tx.borrow_end_date)}
                    </p>
                    <Link
                      to={`/transactions/${tx.id}`}
                      className="inline-flex items-center gap-1 mt-2.5 text-xs font-bold text-brand-600 hover:text-brand-700"
                      data-testid={`history-view-${tx.id}`}
                    >
                      View details
                      <ArrowRight size={14} weight="bold" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
