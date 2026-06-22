import React, { useState, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Eye, PencilSimple, Trash, Check, X,
  ArrowRight, CalendarBlank, ChatTeardropText, Globe, Lock, ArrowClockwise,
} from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeEvent } from "../../lib/realtime";
import { useRouteRefresh } from "../../hooks/useRouteRefresh";
import { Button, StatusBadge, Avatar, PageLoader, EmptyState, Modal, Textarea } from "../../components/ui";
import { toast } from "../../components/Toast";

export default function Lend() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState("listings"); // listings | requests
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null); // tx pending rejection
  const [rejectReason, setRejectReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null); // item pending deletion

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load own listed items — defensively filter to the current user only.
      const mineRes = await api.get("/items/mine");
      const mine = (mineRes.data.items || []).filter(
        (it) => !user?.id || it.owner_id === user.id
      );
      setItems(mine);

      // Load transactions to build incoming requests queue
      const dashRes = await api.get("/dashboard");
      // filter transactions where user is lender and status is active (Pending, Approved, Borrowed)
      const incoming = dashRes.data.lending.filter(
        t => ["Pending", "Approved", "Borrowed"].includes(t.status)
      );
      setRequests(incoming);
    } catch (err) {
      console.error("Failed to load lend data:", err);
      toast.error("Failed to retrieve listings and requests.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useRouteRefresh(loadData, "/lend");

  // Realtime updates
  const t = useRef(null);
  useRealtimeEvent("transaction.updated", () => {
    clearTimeout(t.current);
    t.current = setTimeout(loadData, 200);
  });
  useRealtimeEvent("catalog.changed", () => {
    clearTimeout(t.current);
    t.current = setTimeout(loadData, 200);
  });

  const handleApprove = async (txId) => {
    setBusyId(txId);
    try {
      await api.post(`/transactions/${txId}/approve`);
      toast.success("Request approved!");
      loadData();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusyId(null);
    }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const txId = rejectTarget.id;
    setBusyId(txId);
    try {
      await api.post(`/transactions/${txId}/reject`, { reason: rejectReason.trim() });
      toast.success("Request rejected.");
      setRejectTarget(null);
      setRejectReason("");
      loadData();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusyId(null);
    }
  };

  const toggleVisibility = async (item) => {
    const next = item.visibility === "Private" ? "Public" : "Private";
    // Optimistic update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, visibility: next } : i));
    try {
      await api.patch(`/items/${item.id}/visibility`, { visibility: next });
    } catch (e) {
      // Revert on failure
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, visibility: item.visibility } : i));
      toast.error(formatApiError(e.response?.data?.detail) || "Failed to update visibility.");
    }
  };

  // SRS UC2103 (Refresh): bump the listing so it rises in "Recently Added".
  const refreshListing = async (item) => {
    try {
      const { data } = await api.post(`/items/${item.id}/refresh`);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, last_refreshed_at: data.item.last_refreshed_at } : i));
      toast.success("Listing refreshed! It will appear higher in 'Recently Added' sort.");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed to refresh listing.");
    }
  };

  // SRS UC2103 A1: removal is allowed on active listings after a confirmation —
  // the warning copy in the modal reflects whether a transaction is in flight.
  const requestDelete = (item) => setDeleteTarget(item);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await api.delete(`/items/${deleteTarget.id}`);
      toast.success("Listing removed.");
      setDeleteTarget(null);
      loadData();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Title Header */}
      <div className="mb-5">
        <p className="label-eyebrow">Lender hub</p>
        <h1 className="font-head font-extrabold text-3xl tracking-tight text-ink">Lend</h1>
      </div>

      {/* Segmented Control */}
      <div className="flex bg-surface border border-line rounded-full p-1 mb-5 shadow-soft">
        {[
          { key: "listings", label: `My Items (${items.length})` },
          { key: "requests", label: `Requests Queue (${requests.length})` }
        ].map((item) => (
          <button 
            key={item.key} 
            onClick={() => setTab(item.key)} 
            data-testid={`lend-tab-${item.key}`} 
            className="relative flex-1 py-2.5 rounded-full text-sm font-semibold"
          >
            {tab === item.key && (
              <motion.span 
                layoutId="lend-segmented-tab" 
                transition={{ type: "spring", stiffness: 400, damping: 32 }} 
                className="absolute inset-0 bg-brand-gradient rounded-full shadow-glow-sm" 
              />
            )}
            <span className={`relative z-10 ${tab === item.key ? "text-white" : "text-muted"}`}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {tab === "listings" ? (
            <motion.div 
              key="listings-pane"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {items.length === 0 ? (
                <EmptyState
                  title="No items listed yet"
                  subtitle="Start lending active assets to other students by publishing a listing."
                  action={<Button onClick={() => navigate("/items/new")}><Plus size={18} /> List an Asset</Button>}
                />
              ) : (
                items.map((it) => (
                  <div
                    key={it.id}
                    data-testid={`lend-item-${it.id}`}
                    className="bg-surface border border-line rounded-3xl p-3.5 shadow-card hover:border-brand-200 transition-all"
                  >
                    {/* Top: thumbnail + title + status/category (own row, can wrap) */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center bg-brand-gradient">
                        {it.photo_url ? (
                          <img src={it.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-head font-bold text-xl text-white/90">{it.title[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-head font-semibold text-ink truncate leading-tight">{it.title}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <StatusBadge status={it.availability_status} />
                          <span className="text-[11px] font-medium text-muted truncate">{it.category}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions on their own line — visibility pill left, tools right.
                        Keeps everything tappable without overlapping on mobile. */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-line">
                      {/* Visibility toggle — instant, no edit page needed */}
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        onClick={() => toggleVisibility(it)}
                        title={it.visibility === "Private" ? "Private — tap to make Public" : "Public — tap to make Private"}
                        data-testid={`visibility-toggle-${it.id}`}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-colors shrink-0 ${
                          it.visibility === "Private"
                            ? "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                            : "bg-emerald-50 border-emerald-200 text-emerald-600 hover:border-emerald-300"
                        }`}
                      >
                        {it.visibility === "Private"
                          ? <><Lock size={11} weight="bold" /> Private</>
                          : <><Globe size={11} weight="bold" /> Public</>}
                      </motion.button>
                      <div className="flex-1" />
                      <IconButton onClick={() => navigate(`/items/${it.id}`)} label="View item details" className="bg-slate-50 border border-line text-ink hover:border-brand-300">
                        <Eye size={16} />
                      </IconButton>
                      <IconButton
                        onClick={() => refreshListing(it)}
                        disabled={it.availability_status !== "Available"}
                        label="Refresh listing"
                        data-testid={`refresh-listing-${it.id}`}
                        className="bg-slate-50 border border-line text-ink hover:border-brand-300 disabled:opacity-50"
                      >
                        <ArrowClockwise size={16} />
                      </IconButton>
                      <IconButton
                        onClick={() => navigate(`/items/${it.id}/edit`)}
                        disabled={it.availability_status === "Removed"}
                        label="Edit listing"
                        data-testid={`edit-listing-${it.id}`}
                        className="bg-slate-50 border border-line text-ink hover:border-brand-300 disabled:opacity-50"
                      >
                        <PencilSimple size={16} />
                      </IconButton>
                      <IconButton
                        onClick={() => requestDelete(it)}
                        disabled={it.availability_status === "Removed"}
                        label="Delete listing"
                        data-testid={`delete-listing-${it.id}`}
                        className="bg-slate-50 border border-line text-status-cancelled hover:border-red-200 disabled:opacity-50"
                      >
                        <Trash size={16} />
                      </IconButton>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="requests-pane"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-3.5"
            >
              {requests.length === 0 ? (
                <EmptyState
                  title="No active requests"
                  subtitle="You don't have any incoming requests or active loan handovers."
                />
              ) : (
                requests.map((tx) => (
                  <div
                    key={tx.id}
                    data-testid={`lend-request-${tx.id}`}
                    className="bg-surface border border-line rounded-3xl p-4.5 shadow-card hover:shadow-pop hover:border-brand-200 transition-all space-y-4"
                  >
                    {/* Header: status + request id, then item title */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={tx.status} />
                      <span className="text-[11px] font-plex text-muted uppercase tracking-wider font-bold">
                        Request #{tx.id.slice(0, 8)}
                      </span>
                    </div>
                    <h3 className="font-head font-bold text-base text-ink leading-snug break-words line-clamp-2 -mt-1.5">
                      {tx.item?.title}
                    </h3>

                    {/* Meta: loan period + borrower (clickable), wraps on narrow widths */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        <CalendarBlank size={14} weight="bold" className="shrink-0" />
                        <span className="tabular-nums">{tx.borrow_start_date} → {tx.borrow_end_date}</span>
                      </div>
                      {tx.borrower && (
                        <Link
                          to={`/profile/${tx.borrower.id}`}
                          className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 bg-canvas border border-line hover:border-brand-300 transition-colors min-w-0"
                          data-testid={`request-borrower-${tx.id}`}
                        >
                          <Avatar name={tx.borrower.full_name} src={tx.borrower.profile_picture} size={24} />
                          <span className="text-xs font-semibold text-ink leading-none truncate max-w-[8rem]">
                            {tx.borrower.full_name?.split(" ")[0]}
                          </span>
                        </Link>
                      )}
                    </div>

                    {/* Borrower note — integrated, not a disconnected box */}
                    {tx.request_message && (
                      <div className="rounded-2xl bg-brand-50/50 border border-brand-100 p-3.5">
                        <p className="flex items-center gap-1.5 label-eyebrow !text-brand-600 mb-1">
                          <ChatTeardropText size={13} weight="fill" /> Borrower's note
                        </p>
                        <p className="text-sm text-ink/80 leading-relaxed break-words">{tx.request_message}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-0.5">
                      {tx.status === "Pending" ? (
                        <>
                          <Button
                            variant="danger"
                            size="sm"
                            className="flex-1 !rounded-2xl"
                            disabled={busyId === tx.id}
                            onClick={() => { setRejectReason(""); setRejectTarget(tx); }}
                            data-testid={`reject-${tx.id}`}
                          >
                            <X size={15} weight="bold" /> Reject
                          </Button>
                          <Button
                            variant="success"
                            size="sm"
                            className="flex-1 !rounded-2xl"
                            loading={busyId === tx.id}
                            disabled={busyId === tx.id}
                            onClick={() => handleApprove(tx.id)}
                            data-testid={`approve-${tx.id}`}
                          >
                            <Check size={15} weight="bold" /> Approve
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="w-full !rounded-2xl"
                          onClick={() => navigate(`/transactions/${tx.id}`)}
                          data-testid={`manage-${tx.id}`}
                        >
                          Manage Handover / Return <ArrowRight size={14} weight="bold" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reject request modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject request"
        testid="lend-reject-modal"
      >
        <p className="text-sm text-muted mb-4 leading-relaxed">
          Decline the request for{" "}
          <span className="font-semibold text-ink">{rejectTarget?.item?.title}</span>. The borrower
          is notified instantly.
        </p>
        <Textarea
          label="Reason (optional)"
          rows={3}
          placeholder="Let them know why, e.g. already promised to someone else."
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          data-testid="lend-reject-reason"
        />
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => setRejectTarget(null)}>
            Keep request
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={busyId === rejectTarget?.id}
            disabled={busyId === rejectTarget?.id}
            onClick={confirmReject}
            data-testid="lend-reject-confirm"
          >
            Reject
          </Button>
        </div>
      </Modal>

      {/* Delete listing modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove listing?"
        testid="lend-delete-modal"
      >
        {["Pending", "Approved", "Borrowed"].includes(deleteTarget?.availability_status) ? (
          // SRS UC2103 A1: warn-and-allow. Removing it does NOT cancel the
          // in-flight transaction.
          <p className="text-sm text-muted leading-relaxed" data-testid="lend-delete-active-warning">
            This item is currently borrowed. Removing it won't cancel the transaction. Continue?
          </p>
        ) : (
          <p className="text-sm text-muted leading-relaxed">
            <span className="font-semibold text-ink">{deleteTarget?.title}</span> will be permanently
            removed from the catalog. This can't be undone.
          </p>
        )}
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>
            Keep
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={busyId === deleteTarget?.id}
            disabled={busyId === deleteTarget?.id}
            onClick={confirmDelete}
            data-testid="lend-delete-confirm"
          >
            <Trash size={15} weight="bold" /> Delete
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
}

// Utility mini component for icon button
function IconButton({ onClick, disabled, label, className = "", children, ...rest }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`w-9 h-9 flex items-center justify-center rounded-2xl transition-colors shrink-0 ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
