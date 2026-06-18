import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trash, UserMinus, Prohibit, Warning, ArrowSquareOut, ArrowRight } from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { Button, Modal, Textarea, Select, PageLoader, StatusBadge, StarRating, Avatar } from "../../components/ui";
import { toast } from "../../components/Toast";

export default function ReportDetail() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminCtx = location.pathname.startsWith("/admin");
  const base = isAdminCtx ? "/admin/reports" : "/moderation";
  // Where to send the admin to inspect a user's account: the full admin
  // account page in the portal, or the public profile in the student surface.
  const accountPath = (uid) => (isAdminCtx ? `/admin/users/${uid}` : `/profile/${uid}`);
  const [report, setReport] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [dismissOpen, setDismissOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [suspType, setSuspType] = useState("3_Day");
  const [transcript, setTranscript] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);

  const viewTranscript = async (txId) => {
    setLoadingChat(true);
    try {
      const { data } = await api.get(`/chat/admin/by-transaction/${txId}`);
      setTranscript(data.messages || []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Transcript locked.");
    } finally { setLoadingChat(false); }
  };

  const load = async () => {
    try {
      const { data } = await api.get(`/admin/reports/${reportId}`);
      setReport(data.report);
    } catch (e) { setErr(formatApiError(e.response?.data?.detail)); }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const run = async (fn, successMsg) => {
    setBusy(true); setErr("");
    try { await fn(); toast.success(successMsg || "Action applied."); navigate(base); }
    catch (e) { setErr(formatApiError(e.response?.data?.detail) || e.message); setBusy(false); }
  };

  if (err && !report) return <div className="text-center py-16 text-muted">{err}</div>;
  if (!report) return <PageLoader />;

  const resolved = ["Dismissed", "Actioned"].includes(report.report_status);
  const item = report.item;
  const owner = report.owner;
  const itemBorrowed = item && item.availability_status === "Borrowed";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-muted text-sm mb-4 font-medium hover:text-ink transition-colors" data-testid="back-btn"><ArrowLeft size={16} weight="bold" /> Back</button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-head font-extrabold text-2xl tracking-tight">Report review</h1>
        <StatusBadge status={report.report_status === "Actioned" ? "Removed" : report.report_status === "Dismissed" ? "Completed" : "Pending"} />
      </div>

      {err && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mb-4">{err}</div>}

      <div className="bg-surface border border-line rounded-3xl p-4 shadow-card" data-testid="report-claim">
        <p className="label-eyebrow !text-status-cancelled">{report.report_category.replace(/_/g, " ")}</p>
        {report.incident_when && (
          <p className="text-xs text-muted mt-2" data-testid="report-incident-when">
            <span className="font-semibold text-ink">When:</span> {report.incident_when}
          </p>
        )}
        <p className="text-ink mt-2 leading-relaxed">{report.description || "No additional details provided."}</p>
        {report.evidence?.length > 0 && (
          <div className="mt-3" data-testid="report-evidence">
            <p className="label-eyebrow mb-2">Evidence ({report.evidence.length})</p>
            <div className="flex flex-wrap gap-2.5">
              {report.evidence.map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-20 h-20 rounded-2xl overflow-hidden border border-line block"
                  data-testid={`report-evidence-thumb-${i}`}
                >
                  <img src={src} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-muted mt-3">
          Reported by{" "}
          {report.reporter?.id ? (
            <Link to={accountPath(report.reporter.id)} className="font-semibold text-brand-600 hover:underline" data-testid="report-view-reporter">
              {report.reporter.full_name}
            </Link>
          ) : (report.reporter?.full_name || "Unknown")}
        </p>
      </div>

      {/* Item */}
      <div className="bg-surface border border-line rounded-3xl p-4 mt-3 shadow-card">
        <p className="label-eyebrow mb-2">{report.is_user_report ? "Report type" : "Reported item"}</p>
        {report.is_user_report ? (
          <p className="text-sm text-ink">This is a report about a <b>community member</b> (see profile below). Resolve via dismiss or suspend/ban.</p>
        ) : item ? (
          <Link
            to={`/items/${item.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 group rounded-2xl -m-1 p-1 hover:bg-brand-50/50 transition-colors"
            data-testid="report-view-item"
          >
            <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shrink-0 bg-brand-gradient">
              {item.photo_url ? <img src={item.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="font-head font-bold text-xl text-white/90">{item.title[0]}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-head font-semibold text-ink truncate group-hover:text-brand-700">{item.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge status={item.availability_status} />
                <span className="text-xs text-muted">{item.report_count} report(s)</span>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 whitespace-nowrap">
              View listing <ArrowSquareOut size={13} weight="bold" />
            </span>
          </Link>
        ) : <p className="text-sm text-muted">Item no longer exists.</p>}
      </div>

      {/* Owner / reported member */}
      {owner && (
        <div className="bg-surface border border-line rounded-3xl p-4 mt-3 shadow-card" data-testid="report-owner">
          <p className="label-eyebrow mb-2">{report.is_user_report ? "Reported member" : "Listing owner"}</p>
          <div className="flex items-center justify-between gap-3">
            <Link to={accountPath(owner.id)} className="flex items-center gap-3 min-w-0 group" data-testid="report-view-owner">
              <Avatar name={owner.full_name} src={owner.profile_picture} size={40} />
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate group-hover:text-brand-700">{owner.full_name}</p>
                <p className="text-xs text-muted truncate">{owner.matric_no} · {report.owner_transaction_count} tx · {owner.account_status}</p>
              </div>
            </Link>
            <div className="flex items-center gap-1 shrink-0">
              <StarRating value={owner.trust_score} size={14} />
              <span className="text-sm font-bold ml-0.5">{Number(owner.trust_score).toFixed(1)}</span>
            </div>
          </div>
          <Link
            to={accountPath(owner.id)}
            className="mt-3 flex items-center justify-center gap-1.5 w-full py-2.5 rounded-2xl border border-line text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors"
            data-testid="report-view-account"
          >
            View full account <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      )}

      {/* Report-gated chat transcript (decrypted for review) */}
      {(report.transaction_id || report.target_transaction_id) && (
        <div className="bg-surface border border-line rounded-3xl p-4 mt-3 shadow-card" data-testid="report-transcript">
          <div className="flex items-center justify-between">
            <p className="label-eyebrow">Reported conversation</p>
            {transcript === null && (
              <Button variant="secondary" loading={loadingChat} onClick={() => viewTranscript(report.transaction_id || report.target_transaction_id)} data-testid="view-transcript">
                Decrypt transcript
              </Button>
            )}
          </div>
          {transcript !== null && (
            <div className="mt-3 space-y-2 max-h-80 overflow-y-auto" data-testid="transcript-thread">
              {transcript.length === 0 && <p className="text-sm text-muted">No messages in this conversation.</p>}
              {transcript.map((m) => (
                <div key={m.id} className="text-sm bg-surface-2 rounded-2xl px-3 py-2" data-testid={`transcript-msg-${m.id}`}>
                  <span className="text-xs text-muted">{m.sender_id === report.reporter?.id ? "Reporter" : "Reported"} · {m.kind}</span>
                  {m.kind === "text" ? <p className="text-ink">{m.body}</p> : <p className="text-brand-600">[{m.kind}{m.file_name ? `: ${m.file_name}` : ""}]</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enforcement */}
      {!resolved ? (
        <div className="mt-6 space-y-3">
          <p className="label-eyebrow">Take enforcement action</p>
          <Button variant="secondary" className="w-full justify-start" onClick={() => { setNote(""); setDismissOpen(true); }} data-testid="action-dismiss">Dismiss report</Button>
          <Button variant="secondary" className="w-full justify-start" onClick={() => { setReason(""); setRemoveOpen(true); }} disabled={!item} data-testid="action-remove"><Trash size={16} weight="bold" /> Remove item</Button>
          <Button variant="danger" className="w-full justify-start" onClick={() => { setReason(""); setSuspType("3_Day"); setSuspendOpen(true); }} data-testid="action-suspend"><UserMinus size={16} weight="bold" /> Suspend / ban user</Button>
        </div>
      ) : (
        <div className="mt-6 text-center text-sm text-muted py-3" data-testid="report-resolved">This report has been {report.report_status.toLowerCase()}.</div>
      )}

      {/* Dismiss */}
      <Modal open={dismissOpen} onClose={() => setDismissOpen(false)} title="Dismiss report" testid="dismiss-modal">
        <Textarea label="Note (optional)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="dismiss-note" />
        <Button className="w-full mt-5" loading={busy} onClick={() => run(() => api.post(`/admin/reports/${reportId}/dismiss`, { note }), "Report dismissed.")} disabled={busy} data-testid="dismiss-confirm">Dismiss</Button>
      </Modal>

      {/* Remove item */}
      <Modal open={removeOpen} onClose={() => setRemoveOpen(false)} title="Remove item" testid="remove-modal">
        {itemBorrowed && <div className="bg-amber-50 border border-amber-100 text-amber-800 text-sm rounded-2xl px-3.5 py-2.5 mb-3 flex items-start gap-2" data-testid="active-loan-warning"><Warning size={18} weight="fill" className="shrink-0 mt-0.5" /> This item is currently on an active loan. Removing it will override the active transaction.</div>}
        <Textarea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="remove-reason" />
        <Button variant="danger" className="w-full mt-5" loading={busy} onClick={() => run(() => api.post(`/admin/reports/${reportId}/remove-item`, { reason }), "Item removed.")} disabled={busy || reason.trim().length < 2} data-testid="remove-confirm">Remove item</Button>
      </Modal>

      {/* Suspend */}
      <Modal open={suspendOpen} onClose={() => setSuspendOpen(false)} title="Suspend user" testid="suspend-modal">
        <Select label="Duration" value={suspType} onChange={(e) => setSuspType(e.target.value)} data-testid="suspend-type">
          <option value="3_Day">3 Days</option>
          <option value="7_Day">7 Days</option>
          <option value="30_Day">30 Days</option>
          <option value="Permanent">Permanent ban</option>
        </Select>
        <div className="mt-3">
          <Textarea label="Reason (required)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="suspend-reason" />
        </div>
        <Button variant="danger" className="w-full mt-5" loading={busy} onClick={() => run(() => api.post(`/admin/reports/${reportId}/suspend-user`, { suspension_type: suspType, reason }), "Enforcement applied.")} disabled={busy || reason.trim().length < 2} data-testid="suspend-confirm">
          <Prohibit size={16} weight="bold" /> Apply {suspType.replace(/_/g, " ")}
        </Button>
      </Modal>
    </motion.div>
  );
}
