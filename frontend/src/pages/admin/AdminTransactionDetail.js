import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, XCircle, CheckSquare, BellRinging, Scales, Star, Trash, Globe, Lock, EyeSlash } from "@phosphor-icons/react";
import { adminApi, api, formatApiError } from "../../lib/api";
import { Button, Modal, Textarea, Input, PageLoader, StatusBadge, UrgentBadge, Avatar } from "../../components/ui";
import { toast } from "../../components/Toast";

const SCAN_LABEL = {
  Success: "text-emerald-600", Already_Used: "text-amber-600",
  State_Mismatch: "text-amber-600", Wrong_Transaction: "text-rose-600",
  Invalid_Token: "text-rose-600", Expired: "text-rose-600", Camera_Error: "text-slate-500",
};

function PartyCard({ role, person }) {
  if (!person) return null;
  return (
    <Link to={`/profile/${person.id}`} className="border border-line rounded-3xl p-4 bg-surface shadow-card block hover:border-brand-200 transition-colors">
      <p className="label-eyebrow">{role}</p>
      <div className="flex items-center gap-2 mt-2">
        <Avatar name={person.full_name} src={person.profile_picture} size={32} />
        <div className="min-w-0">
          <p className="font-semibold text-ink text-sm truncate leading-tight">{person.full_name}</p>
          <p className="text-xs text-muted flex items-center gap-0.5"><Star size={11} weight="fill" className="text-amber-400" /> {Number(person.trust_score ?? 5).toFixed(1)}</p>
        </div>
      </div>
    </Link>
  );
}

export default function AdminTransactionDetail({ embedded = false, txId }) {
  const params = useParams();
  const id = txId || params.id;
  const navigate = useNavigate();
  const [tx, setTx] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [penalOpen, setPenalOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState("0.5");

  const load = useCallback(async () => {
    try {
      const { data } = await adminApi.get(`/admin/transactions/${id}`);
      setTx(data.transaction);
    } catch (e) { setErr(formatApiError(e.response?.data?.detail)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, msg) => {
    setBusy(true); setErr("");
    try { await fn(); toast.success(msg); await load(); setCancelOpen(false); setCompleteOpen(false); setPenalOpen(false); setRemoveOpen(false); }
    catch (e) { setErr(formatApiError(e.response?.data?.detail) || e.message); }
    finally { setBusy(false); }
  };

  // Permanent delete wipes the listing + this transaction — leave the page after.
  const deleteListing = async () => {
    setBusy(true); setErr("");
    try {
      await adminApi.delete(`/admin/items/${tx.item.id}`);
      toast.success("Listing permanently deleted.");
      navigate("/admin/transactions");
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  if (err && !tx) return <div className="text-center py-16 text-muted">{err}</div>;
  if (!tx) return <PageLoader />;

  const nonTerminal = ["Pending", "Approved", "Borrowed"].includes(tx.status);
  const urgent = tx.status === "Borrowed" && tx.lease && (tx.lease.is_overdue || tx.lease.due_within_24h);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {!embedded && <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-muted text-sm mb-4 font-medium hover:text-ink transition-colors" data-testid="back-btn"><ArrowLeft size={16} weight="bold" /> Back</button>}

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-head font-extrabold text-2xl tracking-tight">Transaction</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={tx.status} />
          {urgent && <UrgentBadge overdue={tx.lease.is_overdue} />}
        </div>
      </div>

      {err && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mb-4">{err}</div>}

      {/* Item */}
      <Link to={`/items/${tx.item.id}`} className="w-full text-left flex items-center gap-3.5 p-3.5 border border-line rounded-3xl bg-surface shadow-card">
        <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 bg-brand-gradient">
          {tx.item.photo_url ? <img src={tx.item.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="font-head font-bold text-xl text-white/90">{tx.item.title?.[0]}</span>}
        </div>
        <div>
          <p className="font-head font-semibold text-ink">{tx.item.title}</p>
          <p className="text-xs text-muted">{tx.item.category} · due {tx.borrow_end_date}</p>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <PartyCard role="Borrower" person={tx.borrower} />
        <PartyCard role="Lender" person={tx.lender} />
      </div>

      {tx.lease && (
        <div className="border border-line rounded-3xl p-4 bg-surface shadow-card mt-3 text-sm">
          <p className="label-eyebrow">Lease</p>
          <p className="text-ink mt-1.5">Status: <b>{tx.lease.lease_status}</b>{tx.lease.is_overdue ? <span className="text-status-cancelled font-semibold"> · {tx.lease.overdue_days}d overdue</span> : ""}</p>
          <p className="text-muted">Expected return: {tx.lease.expected_return_date}</p>
        </div>
      )}

      {/* Listing visibility radio control */}
      {tx.item?.id && (
        <div className="mt-3 p-4 rounded-3xl bg-surface border border-line shadow-soft">
          <p className="label-eyebrow mb-3">Listing visibility</p>
          <div className="flex gap-2">
            {[
              { value: "Public", label: "Public", icon: Globe, color: "text-emerald-600 border-emerald-200 bg-emerald-50" },
              { value: "Private", label: "Private", icon: Lock, color: "text-amber-600 border-amber-200 bg-amber-50" },
              { value: "Removed", label: "Removed", icon: EyeSlash, color: "text-red-600 border-red-200 bg-red-50" },
            ].map(opt => {
              const Icon = opt.icon;
              const isCurrent = (tx.item.visibility || "Public") === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={async () => {
                    if (isCurrent) return;
                    try {
                      if (opt.value === "Removed") {
                        await adminApi.post(`/admin/items/${tx.item.id}/remove`);
                      } else {
                        await api.patch(`/items/${tx.item.id}/visibility`, { visibility: opt.value });
                      }
                      toast.success(`Listing set to ${opt.value}.`);
                      await load();
                    } catch (e) {
                      toast.error(formatApiError(e.response?.data?.detail) || e.message);
                    }
                  }}
                  data-testid={`item-visibility-${opt.value}`}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border text-xs font-semibold transition-colors ${
                    isCurrent ? opt.color : "border-line bg-surface text-muted hover:border-brand-200"
                  }`}
                >
                  <Icon size={13} weight={isCurrent ? "fill" : "regular"} /> {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin actions */}
      <div className="mt-6 space-y-3">
        <p className="label-eyebrow">Admin controls</p>
        {nonTerminal && (
          <Button variant="danger" className="w-full justify-start" onClick={() => { setReason(""); setCancelOpen(true); }} data-testid="admin-force-cancel"><XCircle size={16} weight="bold" /> Force-cancel transaction</Button>
        )}
        {tx.status === "Borrowed" && (
          <>
            <Button variant="success" className="w-full justify-start" onClick={() => { setReason(""); setCompleteOpen(true); }} data-testid="admin-force-complete"><CheckSquare size={16} weight="bold" /> Mark as returned (force-complete)</Button>
            <Button variant="secondary" className="w-full justify-start" loading={busy} onClick={() => run(() => adminApi.post(`/admin/transactions/${id}/remind`), "Reminder sent to borrower.")} data-testid="admin-remind"><BellRinging size={16} weight="bold" /> Send return reminder</Button>
          </>
        )}
        <Button variant="secondary" className="w-full justify-start" onClick={() => { setReason(""); setPoints("0.5"); setPenalOpen(true); }} data-testid="admin-penalize"><Scales size={16} weight="bold" /> Apply trust penalty to borrower</Button>
        <Button variant="danger" className="w-full justify-start" onClick={() => setRemoveOpen(true)} data-testid="admin-remove-item"><Trash size={16} weight="bold" /> Delete listing permanently</Button>
      </div>

      {/* Audit: state log + scans */}
      <h3 className="font-head font-bold text-lg mt-7 mb-3">History</h3>
      <div className="space-y-2">
        {(tx.state_logs || []).map((l) => (
          <div key={l.id} className="border border-line rounded-2xl p-3 bg-surface shadow-soft text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{l.previous_status || "—"} → {l.new_status}</span>
              <span className="text-[11px] text-muted">{(l.created_at || "").slice(0, 16).replace("T", " ")}</span>
            </div>
            {l.change_reason && <p className="text-xs text-muted mt-0.5">{l.change_reason}</p>}
          </div>
        ))}
        {(tx.scan_events || []).map((s) => (
          <div key={s.id} className="border border-line rounded-2xl p-3 bg-surface shadow-soft text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">{s.scan_purpose} scan</span>
              <span className={`text-[11px] font-semibold ${SCAN_LABEL[s.scan_result] || "text-muted"}`}>{s.scan_result?.replace(/_/g, " ")}</span>
            </div>
            <p className="text-[11px] text-muted mt-0.5">{(s.scanned_at || "").slice(0, 16).replace("T", " ")}{s.device_info ? ` · ${s.device_info}` : ""}</p>
          </div>
        ))}
        {(!tx.state_logs?.length && !tx.scan_events?.length) && <p className="text-sm text-muted">No history yet.</p>}
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Force-cancel transaction" testid="admin-cancel-modal">
        <Textarea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="admin-cancel-reason" />
        <Button variant="danger" className="w-full mt-5" loading={busy} disabled={busy || reason.trim().length < 2} onClick={() => run(() => adminApi.post(`/admin/transactions/${id}/force-cancel`, { reason }), "Transaction cancelled.")} data-testid="admin-cancel-confirm">Force-cancel</Button>
      </Modal>

      <Modal open={completeOpen} onClose={() => setCompleteOpen(false)} title="Mark as returned" testid="admin-complete-modal">
        <Textarea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="admin-complete-reason" />
        <Button variant="success" className="w-full mt-5" loading={busy} disabled={busy || reason.trim().length < 2} onClick={() => run(() => adminApi.post(`/admin/transactions/${id}/force-complete`, { reason }), "Loan marked returned.")} data-testid="admin-complete-confirm">Force-complete</Button>
      </Modal>

      <Modal open={removeOpen} onClose={() => setRemoveOpen(false)} title="Delete listing permanently" testid="admin-remove-modal">
        <p className="text-sm text-muted mb-3">
          This <b>permanently deletes</b> <b>{tx.item.title}</b> and every transaction tied to it from the server. This cannot be undone.
        </p>
        <Button variant="danger" className="w-full mt-2" loading={busy} disabled={busy} onClick={deleteListing} data-testid="admin-remove-confirm">Delete permanently</Button>
      </Modal>

      <Modal open={penalOpen} onClose={() => setPenalOpen(false)} title="Apply trust penalty" testid="admin-penalty-modal">
        <Input type="number" step="0.1" min="0.1" max="5" label="Points to deduct (0.1 – 5.0)" value={points} onChange={(e) => setPoints(e.target.value)} data-testid="admin-penalty-points" />
        <div className="mt-3"><Textarea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="admin-penalty-reason" /></div>
        <Button variant="danger" className="w-full mt-5" loading={busy} disabled={busy || reason.trim().length < 2} onClick={() => run(() => adminApi.post(`/admin/transactions/${id}/penalize`, { points: parseFloat(points), reason }), "Penalty applied.")} data-testid="admin-penalty-confirm">Apply penalty</Button>
      </Modal>
    </motion.div>
  );
}
