import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, BellRinging, ArrowRight } from "@phosphor-icons/react";
import { adminApi, formatApiError } from "../../lib/api";
import { useRealtimeEvent } from "../../lib/realtime";
import { EmptyState, Button, Spinner } from "../../components/ui";
import { toast } from "../../components/Toast";

export default function AdminOverdue() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const { data } = await adminApi.get("/admin/overdue");
    setItems(data.overdue);
  }, []);
  useEffect(() => { load(); }, [load]);
  useRealtimeEvent("transaction.updated", load);

  const remind = async (e, tx) => {
    e.stopPropagation();
    setBusyId(tx.id);
    try {
      await adminApi.post(`/admin/transactions/${tx.id}/remind`);
      toast.success(`Reminder sent to ${tx.borrower?.full_name}.`);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setBusyId(null); }
  };

  return (
    <div>
      <p className="label-eyebrow">Returns at risk</p>
      <h1 className="font-head font-extrabold text-3xl tracking-tight mb-5">Overdue loans</h1>

      {!items ? (
        <div className="flex justify-center py-16"><Spinner className="w-7 h-7" /></div>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing overdue" subtitle="Every active loan is within its return window." icon="✓" />
      ) : (
        <div className="space-y-3" data-testid="admin-overdue-list">
          {items.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.25) }}
              className="bg-surface border border-rose-200 rounded-3xl p-3.5 shadow-card"
              data-testid={`admin-overdue-${tx.id}`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><Clock size={22} weight="fill" /></div>
                <button onClick={() => navigate(`/admin/transactions/${tx.id}`)} className="flex-1 min-w-0 text-left">
                  <p className="font-head font-semibold text-ink truncate">{tx.item?.title}</p>
                  <p className="text-xs text-muted truncate">{tx.borrower?.full_name} · due {tx.borrow_end_date}</p>
                  <p className="text-xs font-bold text-rose-600 mt-0.5">{tx.overdue_days} day{tx.overdue_days !== 1 ? "s" : ""} overdue</p>
                </button>
                <ArrowRight size={18} className="text-slate-300 shrink-0" />
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="secondary" className="flex-1" loading={busyId === tx.id} onClick={(e) => remind(e, tx)} data-testid={`admin-remind-${tx.id}`}><BellRinging size={15} weight="bold" /> Remind borrower</Button>
                <Button size="sm" className="flex-1" onClick={() => navigate(`/admin/transactions/${tx.id}`)}>Manage →</Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
