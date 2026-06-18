import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft, QrCode, ChatCircle, Flag, CalendarBlank, ArrowRight,
  Star, ShieldCheck, MapPin, Tag, CheckCircle, XCircle, Hourglass,
  Package, X, Timer, Sparkle,
} from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeEvent } from "../../lib/realtime";
import { Button, Card, PageLoader, StatusBadge, Avatar } from "../../components/ui";
import ReportModal from "../../components/ReportModal";
import { toast } from "../../components/Toast";

// Reasons for reporting a transaction / the other party (maps to valid
// moderation categories). Filing here also unlocks the chat transcript for the
// reviewing admin.
const TX_REPORT_CATEGORIES = [
  ["Inappropriate_Offensive", "Harassment / offensive behaviour"],
  ["False_Scam", "Scam / fraud"],
  ["Damaged_Dangerous", "Item damaged / unsafe"],
  ["False_Listing", "Item not as described"],
  ["Other", "Other"],
];

const STEPS = [
  { key: "Pending",   label: "Requested", icon: Hourglass  },
  { key: "Approved",  label: "Approved",  icon: CheckCircle },
  { key: "Borrowed",  label: "Collected", icon: Package    },
  { key: "Completed", label: "Returned",  icon: Sparkle    },
];
const STEP_INDEX = { Pending: 0, Approved: 1, Borrowed: 2, Completed: 3 };
const TERMINAL   = { Rejected: true, Cancelled: true };

function daysBetween(a, b) {
  if (!a || !b) return null;
  const diff = Math.round((new Date(b) - new Date(a)) / 86400000);
  return Number.isFinite(diff) && diff >= 0 ? diff : null;
}

/* ── Live countdown timer ── */
function CountdownTimer({ endDate }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [isOverdue, setIsOverdue] = useState(false);

  useEffect(() => {
    const update = () => {
      const end  = new Date(endDate);
      const now  = new Date();
      const diff = end - now;
      if (diff <= 0) {
        const over = Math.abs(diff);
        const d    = Math.floor(over / 86400000);
        const h    = Math.floor((over % 86400000) / 3600000);
        const m    = Math.floor((over % 3600000)  / 60000);
        setTimeLeft(d > 0 ? `${d}d ${h}h overdue` : `${h}h ${m}m overdue`);
        setIsOverdue(true);
      } else {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000)  / 60000);
        setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`);
        setIsOverdue(false);
      }
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [endDate]);

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl ${isOverdue ? "bg-red-50 border border-red-100" : "bg-emerald-50 border border-emerald-100"}`}>
      <Timer size={16} weight="fill" className={isOverdue ? "text-red-500" : "text-emerald-600"} />
      <span className={`text-xs font-bold ${isOverdue ? "text-red-600 animate-pulse-soft" : "text-emerald-700"}`}>
        {isOverdue ? "Overdue by" : "Return in"} {timeLeft}
      </span>
    </div>
  );
}

/* ── Premium status timeline ── */
function StatusTimeline({ status }) {
  const current = STEP_INDEX[status] ?? 0;
  return (
    <div className="flex items-start px-1 gap-0" data-testid="tx-timeline">
      {STEPS.map((step, i) => {
        const done   = i < current;
        const active = i === current;
        const StepIcon = step.icon;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-2 shrink-0 flex-1">
              {/* Step node */}
              <motion.div
                animate={active ? { scale: [1, 1.1, 1], boxShadow: ["0 0 0 0 rgba(99,102,241,0.4)", "0 0 0 8px rgba(99,102,241,0)", "0 0 0 0 rgba(99,102,241,0)"] } : {}}
                transition={active ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  done
                    ? "bg-brand-500 text-white shadow-glow-sm"
                    : active
                    ? "bg-brand-gradient text-white shadow-glow ring-4 ring-brand-100"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {done
                  ? <CheckCircle size={20} weight="fill" />
                  : <StepIcon size={18} weight={active ? "fill" : "regular"} />}
              </motion.div>

              {/* Label */}
              <span className={`text-[10px] font-bold text-center whitespace-nowrap leading-tight ${
                active ? "text-brand-700" : done ? "text-ink" : "text-slate-400"
              }`}>
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 mt-5 mx-0.5 rounded-full overflow-hidden bg-slate-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: i < current ? "100%" : "0%" }}
                  transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full bg-brand-gradient rounded-full"
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Meta chip on hero image ── */
function MetaChip({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/18 backdrop-blur-sm text-[11px] font-semibold text-white border border-white/20">
      {icon}{children}
    </span>
  );
}

/* ── Uber-style "what to do next" callout ── */
function NextStepBanner({ status, isBorrower }) {
  const C = {
    borrower_Pending:   { bg: "from-amber-50 to-amber-50/50 border-amber-200",     ib: "bg-amber-100 text-amber-600",     icon: <Hourglass   size={20} weight="fill" />, title: "Waiting for lender",       body: "Your request is under review. We'll notify you the moment they respond." },
    borrower_Approved:  { bg: "from-brand-50 to-brand-50/50 border-brand-200",     ib: "bg-brand-100 text-brand-600",     icon: <QrCode      size={20} weight="fill" />, title: "Ready for pickup!",         body: "Show your handover QR to the lender when you arrive to collect the item." },
    borrower_Borrowed:  { bg: "from-emerald-50 to-emerald-50/50 border-emerald-200", ib: "bg-emerald-100 text-emerald-600", icon: <Package     size={20} weight="fill" />, title: "Item is with you",          body: "When you're done, show your return QR to complete the deal." },
    borrower_Completed: { bg: "from-blue-50 to-blue-50/50 border-blue-200",         ib: "bg-blue-100 text-blue-600",       icon: <CheckCircle size={20} weight="fill" />, title: "Borrow complete!",          body: "Thanks for borrowing. Don't forget to leave a rating below." },
    lender_Pending:     { bg: "from-amber-50 to-amber-50/50 border-amber-200",     ib: "bg-amber-100 text-amber-600",     icon: <Hourglass   size={20} weight="fill" />, title: "New request waiting",       body: "Review the borrower's profile below and approve or decline." },
    lender_Approved:    { bg: "from-brand-50 to-brand-50/50 border-brand-200",     ib: "bg-brand-100 text-brand-600",     icon: <QrCode      size={20} weight="fill" />, title: "Waiting for pickup",         body: "Scan the borrower's QR when they arrive to hand over the item." },
    lender_Borrowed:    { bg: "from-emerald-50 to-emerald-50/50 border-emerald-200", ib: "bg-emerald-100 text-emerald-600", icon: <Package     size={20} weight="fill" />, title: "Item is out",               body: "Scan the borrower's QR when they return to close the deal." },
    lender_Completed:   { bg: "from-blue-50 to-blue-50/50 border-blue-200",         ib: "bg-blue-100 text-blue-600",       icon: <CheckCircle size={20} weight="fill" />, title: "Deal complete!",            body: "Your item has been returned. Leave a rating for the borrower." },
  };
  const c = C[`${isBorrower ? "borrower" : "lender"}_${status}`];
  if (!c) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-3xl border bg-gradient-to-br p-4 mb-4 ${c.bg}`}
      data-testid="tx-next-step-banner"
    >
      <div className="flex items-start gap-3">
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-soft ${c.ib}`}
        >
          {c.icon}
        </motion.div>
        <div>
          <p className="font-head font-bold text-ink text-[15px] leading-tight">{c.title}</p>
          <p className="text-sm text-ink/70 mt-0.5 leading-relaxed">{c.body}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Lender approve / decline visual cards ── */
function LenderDecision({ onApprove, onReject, busy }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-2.5" data-testid="tx-lender-decision">
      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 360, damping: 26 }}
        disabled={busy}
        onClick={onReject}
        data-testid="tx-reject"
        className="flex flex-col items-center gap-3 p-5 rounded-3xl border-2 border-red-100 bg-red-50 hover:border-red-200 hover:bg-red-100/70 transition-colors disabled:opacity-50 text-center"
      >
        <motion.div
          whileHover={{ rotate: -8 }}
          className="w-14 h-14 rounded-2xl bg-white shadow-soft flex items-center justify-center"
        >
          <XCircle size={32} weight="fill" className="text-red-500" />
        </motion.div>
        <div>
          <p className="font-head font-bold text-ink text-base">Decline</p>
          <p className="text-[11px] text-red-400 mt-0.5">Item stays available</p>
        </div>
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 360, damping: 26 }}
        disabled={busy}
        onClick={onApprove}
        data-testid="tx-approve"
        className="flex flex-col items-center gap-3 p-5 rounded-3xl border-2 border-emerald-100 bg-emerald-50 hover:border-emerald-200 hover:bg-emerald-100/70 transition-colors disabled:opacity-50 text-center"
      >
        <motion.div
          whileHover={{ rotate: 8 }}
          className="w-14 h-14 rounded-2xl bg-white shadow-soft flex items-center justify-center"
        >
          <CheckCircle size={32} weight="fill" className="text-emerald-500" />
        </motion.div>
        <div>
          <p className="font-head font-bold text-ink text-base">Approve</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Confirm the deal</p>
        </div>
      </motion.button>
    </div>
  );
}

/* ── Full-screen QR modal ── */
function QRModal({ open, onClose, qr, status, isBorrower }) {
  const [showCode, setShowCode] = useState(false);
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(qr || ""); toast.success("Code copied."); }
    catch { /* clipboard unavailable */ }
  };
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" data-testid="tx-qr-block">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/65 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 64, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0,  y: 40,  scale: 0.95 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="relative bg-surface w-full sm:max-w-sm rounded-t-4xl sm:rounded-4xl border border-line shadow-pop p-6 text-center"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-line mx-auto mb-5" />
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-canvas flex items-center justify-center text-muted hover:bg-slate-100 transition-colors"
            >
              <X size={16} weight="bold" />
            </button>

            {/* Icon */}
            <motion.div
              animate={{ rotate: [0, -4, 4, -2, 2, 0] }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="w-16 h-16 mx-auto rounded-3xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4 shadow-soft"
            >
              <QrCode size={32} weight="fill" />
            </motion.div>

            <h3 className="font-head font-bold text-xl text-ink">
              {status === "Borrowed" ? "Return QR Code" : "Handover QR Code"}
            </h3>
            <p className="text-sm text-muted mt-1.5 max-w-[240px] mx-auto leading-relaxed">
              Show this to the {isBorrower ? "lender" : "borrower"} to confirm the{" "}
              {status === "Borrowed" ? "return" : "handover"}.
            </p>

            {/* QR code — rendered locally so it always shows, scans crisply,
                and works offline. Error-correction "M" keeps it readable even
                if partly obscured on screen. */}
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 22 }}
              className="mt-5 inline-block p-4 rounded-3xl bg-white border-2 border-brand-100 shadow-card"
            >
              {qr ? (
                <QRCodeCanvas
                  value={qr}
                  size={232}
                  level="M"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#0F172A"
                  className="rounded-xl block"
                  data-testid="tx-qr-canvas"
                />
              ) : (
                <div className="w-[232px] h-[232px] flex items-center justify-center text-muted text-sm">Generating…</div>
              )}
            </motion.div>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted mt-4">
              <ShieldCheck size={13} weight="fill" className="text-brand-400" />
              Single-use &amp; time-limited for security
            </p>

            {/* Fallback: if the lender's camera can't scan, they can type this
                code into their scanner's "Enter code manually" screen. */}
            <button
              onClick={() => setShowCode((s) => !s)}
              className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 mt-3"
              data-testid="tx-qr-reveal"
            >
              {showCode ? "Hide code" : "Can’t scan? Show code"}
            </button>
            {showCode && (
              <div className="mt-2 bg-canvas border border-line rounded-2xl p-3 text-left">
                <code className="block break-all text-[10.5px] text-ink font-mono select-all" data-testid="tx-qr-code-text">{qr}</code>
                <button onClick={copyCode} className="mt-2 text-[11px] font-semibold text-brand-600 hover:text-brand-700" data-testid="tx-qr-copy">Copy code</button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ── Airbnb-style rating bottom sheet ── */
const BORROWER_TAGS = ["On time", "Well maintained", "Easy pickup", "Great condition", "Good communication"];
const LENDER_TAGS   = ["Returned on time", "Handled carefully", "Good communicator", "Respectful", "Would lend again"];
const STAR_LABELS   = ["", "Poor", "Below average", "Good", "Great", "Excellent!"];

function RatingModal({ open, onClose, isBorrower, other, onSubmit, busy }) {
  const [stars, setStars]         = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [tags, setTags]           = useState([]);
  const [feedback, setFeedback]   = useState("");
  const TAGS   = isBorrower ? BORROWER_TAGS : LENDER_TAGS;
  const display= hoveredStar || stars;
  const toggleTag = (t) => setTags((p) => p.includes(t) ? p.filter((x) => x !== t) : [...p, t]);

  const handleSubmit = () => {
    if (!stars) { toast.error("Pick a star rating first."); return; }
    const tagText     = tags.length > 0 ? tags.join(", ") : "";
    const fullFeedback= [tagText, feedback].filter(Boolean).join(" — ") || null;
    onSubmit(stars, fullFeedback);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 64, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0,  y: 40,  scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="relative bg-surface w-full sm:max-w-md rounded-t-4xl sm:rounded-4xl border border-line shadow-pop p-6 max-h-[90vh] overflow-y-auto"
            data-testid="tx-rating"
          >
            <div className="sm:hidden w-10 h-1 rounded-full bg-line mx-auto mb-5" />

            {/* Person */}
            <div className="text-center mb-6">
              <div className="relative inline-block mb-3">
                <Avatar
                  name={other?.full_name}
                  src={other?.profile_picture}
                  size={76}
                  className="ring-4 ring-brand-100 shadow-card"
                />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-amber-gradient flex items-center justify-center shadow-glow-warm">
                  <Star size={14} weight="fill" className="text-white" />
                </div>
              </div>
              <p className="text-sm text-muted">Rate your {isBorrower ? "lender" : "borrower"}</p>
              <p className="font-head font-bold text-xl text-ink mt-0.5">{other?.full_name}</p>
            </div>

            {/* Stars */}
            <div className="text-center mb-5">
              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <motion.button
                    key={s}
                    type="button"
                    whileTap={{ scale: 1.4 }}
                    whileHover={{ scale: 1.2 }}
                    onHoverStart={() => setHoveredStar(s)}
                    onHoverEnd={() => setHoveredStar(0)}
                    onClick={() => setStars(s)}
                    data-testid={`star-${s}`}
                    className="focus:outline-none"
                  >
                    <motion.svg
                      width={44} height={44} viewBox="0 0 24 24"
                      fill={s <= display ? "#F59E0B" : "none"}
                      stroke={s <= display ? "#F59E0B" : "#CBD5E1"}
                      strokeWidth="1.5"
                      animate={s <= display ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.8 5.8 21.5l1.6-7L2 9.8l7.1-.6z" />
                    </motion.svg>
                  </motion.button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={display}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className={`text-sm font-bold ${display ? "text-amber-600" : "text-muted"}`}
                >
                  {display ? STAR_LABELS[display] : "Tap a star to rate"}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Quick-select tags */}
            <AnimatePresence>
              {stars > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <p className="text-sm font-semibold text-ink mb-2.5">What stood out?</p>
                  <div className="flex flex-wrap gap-2">
                    {TAGS.map((tag) => (
                      <motion.button
                        key={tag}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => toggleTag(tag)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                          tags.includes(tag)
                            ? "bg-brand-500 text-white border-brand-500 shadow-glow-sm"
                            : "bg-surface border-line text-muted hover:border-brand-300 hover:text-ink"
                        }`}
                      >
                        {tag}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Optional text */}
            <AnimatePresence>
              {stars > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-5"
                >
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Add more details (optional)…"
                    rows={3}
                    data-testid="tx-rating-feedback"
                    className="w-full rounded-2xl border border-line bg-canvas px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 transition-all resize-none font-plex"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Button onClick={handleSubmit} loading={busy} className="w-full !py-3.5" data-testid="tx-rating-submit">
              Submit rating
            </Button>
            {/* UC1202 A1: defer without recording a rating — it stays pending and
                resurfaces under Dashboard → Pending actions. */}
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              data-testid="tx-rating-remind-later"
              className="w-full mt-2.5 py-3 text-sm font-semibold text-muted hover:text-ink transition-colors disabled:opacity-50"
            >
              Remind me later
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════ Main page ══════════════════ */
export default function TransactionDetail() {
  const { id }         = useParams();
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const [tx, setTx]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [qr, setQr]    = useState(null);
  const [busy, setBusy]= useState(false);
  const [elig, setElig]= useState(null);
  const [showRating, setShowRating] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [flash, setFlash] = useState(null); // "Borrowed" | "Completed" success overlay for the QR holder
  const flashTimerRef = useState(() => ({ current: null }))[0];

  const loadElig = useCallback(async () => {
    try {
      const { data } = await api.get(`/ratings/transaction/${id}/eligibility`);
      setElig(data);
    } catch { /* ignore */ }
  }, [id]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/transactions/${id}`);
      setTx(data.transaction || data);
      loadElig();
    } catch {
      toast.error("Transaction not found.");
    } finally {
      setLoading(false);
    }
  }, [id, loadElig]);

  useEffect(() => { load(); }, [load]);
  // When the lender's scan lands, the server pushes the new status here. For the
  // QR holder we close the QR sheet, show a success screen, then (on a completed
  // return) auto-open the rating after a short beat — never stacked behind the QR.
  useRealtimeEvent("transaction.updated", (p) => {
    if (p.transaction_id && p.transaction_id !== id) return;
    if (p.status === "Borrowed" || p.status === "Completed") {
      setQr(null);
      setFlash(p.status);
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setFlash(null);
        if (p.status === "Completed") setShowRating(true);
      }, 2600);
    }
    load();
  });
  useEffect(() => () => clearTimeout(flashTimerRef.current), [flashTimerRef]);

  const act = async (path, label) => {
    setBusy(true);
    try {
      await api.post(`/transactions/${id}/${path}`, {});
      toast.success(label);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  const showQr = async () => {
    try {
      const { data } = await api.post(`/transactions/${id}/qr`, {});
      setQr(data.qr_string);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  const location = useLocation();
  useEffect(() => {
    if (
      location.state?.showQR && tx && !qr && user &&
      tx.borrower_id === user.id &&
      (tx.status === "Approved" || tx.status === "Borrowed")
    ) { showQr(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, tx]);

  // Open the rating sheet directly when arriving from Dashboard → Pending actions
  // (UC1202), once eligibility confirms the rating is still outstanding.
  useEffect(() => {
    if (location.state?.openRating && elig?.role && elig?.allowed && !elig?.already_rated) {
      setShowRating(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, elig]);

  const submitRating = async (stars, feedback) => {
    setBusy(true);
    try {
      await api.post("/ratings", { transaction_id: id, stars, feedback: feedback || null });
      toast.success("Thanks for your rating!");
      setShowRating(false);
      loadElig();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setBusy(false);
    }
  };

  // Filed through the in-app ReportModal (no native browser prompt).
  const submitTxReport = async (payload) => {
    const { data } = await api.post(`/chat/by-transaction/${id}/report`, payload);
    return { id: data.report_id };
  };

  if (loading) return <PageLoader />;
  if (!tx)     return null;

  const isBorrower = user && tx.borrower_id === user.id;
  const isLender   = user && tx.lender_id   === user.id;
  const other      = isBorrower ? tx.lender : tx.borrower;
  const chatOpen   = ["Approved", "Borrowed", "Completed"].includes(tx.status);
  const item       = tx.item || {};
  const duration   = daysBetween(tx.borrow_start_date, tx.borrow_end_date);
  const isTerminal = TERMINAL[tx.status];
  const canRate    = elig?.role && elig?.allowed && !elig?.already_rated;
  const isBorrowed = tx.status === "Borrowed";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6" data-testid="transaction-detail-page">
      {/* Overlays */}
      <QRModal open={!!qr} onClose={() => setQr(null)} qr={qr} status={tx.status} isBorrower={isBorrower} />

      {/* Scan-success flash shown to the QR holder the instant the lender's
          scan is verified (driven by the realtime status push). */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] flex flex-col items-center justify-center bg-emerald-600 text-white p-8 text-center"
            data-testid="tx-scan-flash"
          >
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 18 }}
            >
              <CheckCircle size={92} weight="fill" />
            </motion.div>
            <h2 className="font-head font-bold text-2xl mt-4">
              {flash === "Completed" ? "Return confirmed!" : "Handover confirmed!"}
            </h2>
            <p className="text-white/90 mt-2 max-w-xs">
              {flash === "Completed"
                ? "The item is checked back in. Opening your rating…"
                : "You've received the item. Enjoy — and remember to return it on time!"}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {elig?.role && (
        <RatingModal
          open={showRating && canRate}
          onClose={() => setShowRating(false)}
          isBorrower={isBorrower}
          other={other}
          onSubmit={submitRating}
          busy={busy}
        />
      )}

      {/* In-app report modal — replaces the old native browser prompt */}
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report a problem"
        intro={`Report an issue with this transaction${other?.full_name ? ` or ${other.full_name}` : ""}. Moderators will review it, and filing this lets them review the conversation if needed.`}
        categories={TX_REPORT_CATEGORIES}
        submit={submitTxReport}
        onViewStatus={() => navigate("/settings/reports")}
        returnLabel="Back to transaction"
      />

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          data-testid="tx-back"
          className="flex items-center gap-1.5 text-muted hover:text-ink font-semibold text-sm transition-colors"
        >
          <ArrowLeft size={18} weight="bold" /> Back
        </motion.button>
        <StatusBadge status={tx.status} />
      </div>

      {/* ── Item hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-4xl overflow-hidden shadow-card mb-4"
        data-testid="tx-hero"
      >
        <div className="h-52 w-full">
          {item.photo_url
            ? <img src={item.photo_url} alt={item.title} className="w-full h-full object-cover animate-hero-ken-burns" />
            : <div className="w-full h-full bg-brand-gradient flex items-center justify-center">
                <span className="font-head font-extrabold text-7xl text-white/90">
                  {item.title?.[0]?.toUpperCase()}
                </span>
              </div>}
        </div>
        <div className="absolute inset-0 bg-hero-overlay-lg" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1">
            {isBorrower ? "You are borrowing" : "You are lending"}
          </p>
          <h1 className="font-head font-extrabold text-2xl text-white leading-tight mb-2.5" data-testid="tx-item-title">
            {item.title || "Item"}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            {item.category         && <MetaChip icon={<Tag         size={12} weight="fill" />}>{item.category}</MetaChip>}
            {item.condition        && <MetaChip icon={<ShieldCheck  size={12} weight="fill" />}>{item.condition}</MetaChip>}
            {item.location_college && <MetaChip icon={<MapPin       size={12} weight="fill" />}>{item.location_college}</MetaChip>}
          </div>
        </div>
      </motion.div>

      {/* ── Next step banner ── */}
      {!isTerminal && <NextStepBanner status={tx.status} isBorrower={isBorrower} />}

      {/* ── Status timeline / terminal ── */}
      {isTerminal ? (
        <Card className="p-4 mb-4 flex items-center gap-3" data-testid="tx-terminal">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            tx.status === "Rejected" ? "bg-red-50 text-status-cancelled" : "bg-slate-100 text-slate-500"
          }`}>
            <XCircle size={24} weight="fill" />
          </div>
          <div>
            <p className="font-semibold text-ink">This request was {tx.status.toLowerCase()}</p>
            <p className="text-sm text-muted mt-0.5">No further action is needed.</p>
          </div>
        </Card>
      ) : (
        <Card className="px-4 py-5 mb-4">
          <StatusTimeline status={tx.status} />
          {/* Live countdown for borrowed items */}
          {isBorrowed && tx.borrow_end_date && (
            <div className="mt-4 pt-4 border-t border-line flex justify-center">
              <CountdownTimer endDate={tx.borrow_end_date} />
            </div>
          )}
        </Card>
      )}

      {/* ── Counterparty card ── */}
      {other && (
        <Card className="p-4 mb-4" data-testid="tx-counterparty">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <Avatar name={other.full_name} src={other.profile_picture} size={56} className="ring-2 ring-brand-100" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-status-borrowed ring-2 ring-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="label-eyebrow">{isBorrower ? "Lender" : "Borrower"}</p>
              <p className="font-head font-bold text-lg text-ink truncate leading-tight">{other.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {[1, 2, 3, 4, 5].map((s) => {
                  const filled = s <= Math.round(Number(other.trust_score ?? 5));
                  return (
                    <svg key={s} width={13} height={13} viewBox="0 0 24 24"
                      fill={filled ? "#F59E0B" : "none"}
                      stroke={filled ? "#F59E0B" : "#CBD5E1"}
                      strokeWidth="1.5">
                      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.8 5.8 21.5l1.6-7L2 9.8l7.1-.6z" />
                    </svg>
                  );
                })}
                <span className="text-xs font-semibold text-ink">{Number(other.trust_score ?? 5).toFixed(1)}</span>
              </div>
            </div>
            <Link
              to={`/profile/${other.id}`}
              data-testid="tx-view-profile"
              className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl bg-canvas text-sm font-semibold text-ink hover:bg-brand-50 hover:text-brand-700 transition-colors"
            >
              Profile <ArrowRight size={14} weight="bold" />
            </Link>
          </div>

          {tx.request_message && (
            <div className="mt-3.5 rounded-2xl bg-brand-50/60 border border-brand-100 p-3.5" data-testid="tx-message">
              <p className="flex items-center gap-1.5 label-eyebrow !text-brand-600 mb-1">
                <ChatCircle size={13} weight="fill" /> {isBorrower ? "Your note" : "Borrower's note"}
              </p>
              <p className="text-sm text-ink/80 leading-relaxed break-words">"{tx.request_message}"</p>
            </div>
          )}
        </Card>
      )}

      {/* ── Loan period ── */}
      <Card className="p-4 mb-4" data-testid="tx-period">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <CalendarBlank size={22} weight="fill" />
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div>
                <p className="text-muted text-[11px] font-bold uppercase tracking-wider">From</p>
                <p className="font-semibold text-ink tabular-nums">{tx.borrow_start_date}</p>
              </div>
              <ArrowRight size={16} className="text-slate-300 shrink-0" />
              <div>
                <p className="text-muted text-[11px] font-bold uppercase tracking-wider">Until</p>
                <p className="font-semibold text-ink tabular-nums">{tx.borrow_end_date}</p>
              </div>
            </div>
          </div>
          {duration != null && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold border border-brand-100"
            >
              <Hourglass size={13} weight="fill" /> {duration} day{duration === 1 ? "" : "s"}
            </motion.span>
          )}
        </div>
      </Card>

      {/* ── Actions ── */}
      <div className="space-y-3" data-testid="tx-actions">

        {/* Lender decision cards */}
        {isLender && tx.status === "Pending" && (
          <LenderDecision
            onApprove={() => act("approve", "Request approved!")}
            onReject={() => act("reject", "Request declined.")}
            busy={busy}
          />
        )}

        {/* Borrower QR CTAs */}
        {isBorrower && tx.status === "Approved" && (
          <Button className="w-full !py-4 text-[15px]" onClick={showQr} data-testid="tx-show-qr">
            <QrCode size={20} weight="bold" /> Show handover QR
          </Button>
        )}
        {isBorrower && tx.status === "Borrowed" && (
          <Button className="w-full !py-4 text-[15px]" onClick={showQr} data-testid="tx-return-qr">
            <QrCode size={20} weight="bold" /> Show return QR
          </Button>
        )}

        {/* Lender scan CTA — purpose must match the current status so the
            backend runs the right transition (Approved=Handover, Borrowed=Return). */}
        {isLender && (tx.status === "Approved" || tx.status === "Borrowed") && (
          <Link to={`/scan/${tx.id}?purpose=${tx.status === "Borrowed" ? "Return" : "Handover"}`} className="block">
            <Button className="w-full !py-4 text-[15px]" data-testid="tx-scan">
              <QrCode size={20} weight="bold" /> {tx.status === "Borrowed" ? "Scan return QR" : "Scan handover QR"}
            </Button>
          </Link>
        )}

        {/* Secondary actions row */}
        {(chatOpen || (isBorrower && ["Pending", "Approved"].includes(tx.status))) && (
          <div className="flex gap-2.5">
            {chatOpen && (
              <Button variant="secondary" className="flex-1 !py-3" onClick={() => navigate(`/chat/${id}`)} data-testid="tx-open-chat">
                <ChatCircle size={18} weight="bold" /> Chat
              </Button>
            )}
            {isBorrower && ["Pending", "Approved"].includes(tx.status) && (
              <Button variant="secondary" className="flex-1 !py-3" loading={busy} onClick={() => act("cancel", "Request cancelled.")} data-testid="tx-cancel">
                Cancel
              </Button>
            )}
            {chatOpen && (
              <Button variant="secondary" className="flex-1 !py-3 !text-status-cancelled hover:!border-red-300" onClick={() => setReportOpen(true)} data-testid="tx-report">
                <Flag size={16} /> Report
              </Button>
            )}
          </div>
        )}

        {/* Rate CTA */}
        {canRate && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <motion.button
              whileTap={{ scale: 0.98 }}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 360, damping: 26 }}
              onClick={() => setShowRating(true)}
              data-testid="tx-rate-cta"
              className="w-full flex items-center gap-3.5 p-4.5 rounded-3xl bg-amber-50 border border-amber-200 hover:bg-amber-100/60 transition-all text-left"
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
                transition={{ duration: 1, delay: 0.5, repeat: Infinity, repeatDelay: 4 }}
                className="w-11 h-11 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0"
              >
                <Star size={22} weight="fill" className="text-amber-500" />
              </motion.div>
              <div className="flex-1">
                <p className="font-head font-bold text-ink text-[15px]">Leave a rating</p>
                <p className="text-xs text-muted">Share your experience with {other?.full_name?.split(" ")[0]}</p>
              </div>
              <ArrowRight size={18} weight="bold" className="text-amber-400 shrink-0" />
            </motion.button>
          </motion.div>
        )}

        {elig?.already_rated && (
          <div className="flex items-center gap-2.5 p-4 rounded-3xl bg-canvas border border-line" data-testid="tx-rating-done">
            <CheckCircle size={18} weight="fill" className="text-brand-500 shrink-0" />
            <p className="text-sm text-muted">You've already rated this. Thank you!</p>
          </div>
        )}
      </div>
    </div>
  );
}
