import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, MapPin, Star, Tag, CheckCircle, Package,
  ShieldCheck, CalendarBlank, ChatTeardropText,
  BookmarkSimple, CaretLeft, CaretRight, PaperPlaneTilt,
  Clock, Sparkle, Flag,
} from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Button, PageLoader, StatusBadge, Avatar, Spinner } from "../../components/ui";
import ReportModal from "../../components/ReportModal";
import { toast } from "../../components/Toast";

// Item report reasons (SDD REPORT_CATEGORIES mapped to friendly labels).
const ITEM_REPORT_CATEGORIES = [
  ["False_Listing", "Inaccurate / fake listing"],
  ["Prohibited_Illegal", "Prohibited / illegal item"],
  ["Damaged_Dangerous", "Damaged / dangerous item"],
  ["Inappropriate_Offensive", "Inappropriate / offensive"],
  ["False_Scam", "Scam / fraud"],
  ["Other", "Other"],
];

/* ─────────────────────────── helpers ─────────────────────────── */
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function toISO(d) { return d.toISOString().split("T")[0]; }
function fmtShort(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtFull(d) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function startOfDay(d) {
  const c = new Date(d); c.setHours(0, 0, 0, 0); return c;
}
function addMonths(d, n) {
  const c = new Date(d); c.setMonth(c.getMonth() + n); c.setDate(1); return c;
}
function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const dow = first.getDay(); // 0=Sun
  const offset = dow === 0 ? 6 : dow - 1; // Mon-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

/* ─────────────────────── star display ─────────────────────────── */
function StarDisplay({ value, count }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(n => (
          <Star key={n} size={16}
            weight={n <= Math.round(value || 0) ? "fill" : "regular"}
            className={n <= Math.round(value || 0) ? "text-amber-400" : "text-slate-200"} />
        ))}
      </div>
      {value != null && <span className="text-sm font-bold text-ink tabular-nums">{Number(value).toFixed(1)}</span>}
      {count > 0 && <span className="text-xs text-muted">({count} {count === 1 ? "review" : "reviews"})</span>}
    </div>
  );
}

/* ──────────────────── borrow request card ──────────────────────── */
function BorrowRequestCard({ itemId, onRequested }) {
  const today = startOfDay(new Date());

  const [start, setStart] = useState(null);   // Date
  const [end, setEnd] = useState(null);         // Date
  const [calOpen, setCalOpen] = useState(false);
  const [picking, setPicking] = useState("start"); // "start" | "end"
  const [calMonth, setCalMonth] = useState(() => startOfDay(new Date()));
  const [hovered, setHovered] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const calRef = useRef(null);

  const duration = start && end
    ? Math.round((end - start) / 86400000) + 1
    : 0;

  const openCal = (target) => {
    setPicking(target);
    setCalOpen(true);
    // Scroll calendar into view after animation
    setTimeout(() => calRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 260);
  };

  const handleDay = (date) => {
    if (date < today) return;
    if (picking === "start") {
      setStart(date);
      setEnd(null);
      setPicking("end");
    } else {
      if (date <= start) {
        // Swap: clicked before start
        setStart(date);
        setEnd(start);
        setCalOpen(false);
      } else {
        setEnd(date);
        setCalOpen(false);
      }
    }
  };

  const isStart = (d) => d && start && d.getTime() === start.getTime();
  const isEnd   = (d) => d && end   && d.getTime() === end.getTime();
  const inRange = (d) => {
    if (!d || !start || !end) return false;
    return d > start && d < end;
  };
  const inPreview = (d) => {
    if (!d || !start || end || !hovered || picking !== "end") return false;
    const lo = start < hovered ? start : hovered;
    const hi = start < hovered ? hovered : start;
    return d > lo && d < hi;
  };
  const isPast = (d) => d && d < today;

  const grid = buildGrid(calMonth.getFullYear(), calMonth.getMonth());

  const submit = async () => {
    if (!start || !end || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/transactions", {
        item_id: itemId,
        borrow_start_date: toISO(start),
        borrow_end_date: toISO(end),
        request_message: message.trim() || null,
      });
      toast.success("Request sent!");
      onRequested(data.transaction?.id || data.id);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const monthLabel = calMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-4xl overflow-hidden shadow-card border border-brand-100 mb-6" data-testid="borrow-form-card">

      {/* ── Header strip ── */}
      <div className="bg-brand-gradient px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-white/75 text-[11px] font-bold uppercase tracking-widest">Campus Borrow</p>
          <h2 className="font-head font-extrabold text-white text-lg leading-tight">Request this item</h2>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-bold">
          <Sparkle size={13} weight="fill" /> Free
        </span>
      </div>

      <div className="bg-surface px-5 pt-5 pb-6 space-y-4">

        {/* ── Date picker cards ── */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2.5">
            When do you need it?
          </p>
          <div className="grid grid-cols-2 gap-2.5">

            {/* Pickup */}
            <button
              type="button"
              onClick={() => openCal("start")}
              data-testid="borrow-start"
              className={`flex flex-col gap-0.5 p-4 rounded-3xl border-2 text-left transition-all active:scale-[0.97] ${
                calOpen && picking === "start"
                  ? "border-brand-500 bg-brand-50 shadow-glow-sm"
                  : start
                    ? "border-brand-200 bg-brand-50/50"
                    : "border-dashed border-slate-300 bg-slate-50 hover:border-brand-300"
              }`}
            >
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-muted">
                <CalendarBlank size={11} weight="bold" /> Pickup
              </span>
              {start ? (
                <>
                  <span className="font-head font-extrabold text-base text-ink leading-tight">
                    {fmtShort(start)}
                  </span>
                  <span className="text-[11px] text-brand-600 font-semibold">
                    {start.toLocaleDateString("en-US", { weekday: "long" })}
                  </span>
                </>
              ) : (
                <span className="font-head font-semibold text-sm text-slate-400 mt-0.5">
                  Add date
                </span>
              )}
            </button>

            {/* Return */}
            <button
              type="button"
              onClick={() => openCal("end")}
              data-testid="borrow-end"
              className={`flex flex-col gap-0.5 p-4 rounded-3xl border-2 text-left transition-all active:scale-[0.97] ${
                calOpen && picking === "end"
                  ? "border-brand-500 bg-brand-50 shadow-glow-sm"
                  : end
                    ? "border-brand-200 bg-brand-50/50"
                    : "border-dashed border-slate-300 bg-slate-50 hover:border-brand-300"
              }`}
            >
              <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-muted">
                <Clock size={11} weight="bold" /> Return
              </span>
              {end ? (
                <>
                  <span className="font-head font-extrabold text-base text-ink leading-tight">
                    {fmtShort(end)}
                  </span>
                  <span className="text-[11px] text-brand-600 font-semibold">
                    {end.toLocaleDateString("en-US", { weekday: "long" })}
                  </span>
                </>
              ) : (
                <span className="font-head font-semibold text-sm text-slate-400 mt-0.5">
                  Add date
                </span>
              )}
            </button>
          </div>

          {/* Duration badge */}
          <AnimatePresence>
            {duration > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center justify-center mt-3"
              >
                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-gradient text-white text-xs font-bold shadow-glow-sm">
                  <CalendarBlank size={13} weight="bold" />
                  {duration} {duration === 1 ? "day" : "days"}
                  <span className="opacity-70">·</span>
                  {fmtFull(start)} → {fmtFull(end)}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Inline calendar ── */}
        <AnimatePresence>
          {calOpen && (
            <motion.div
              ref={calRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="bg-slate-50 border border-line rounded-3xl p-4">

                {/* Month navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => setCalMonth(m => addMonths(m, -1))}
                    className="w-9 h-9 rounded-2xl bg-surface border border-line flex items-center justify-center text-ink hover:border-brand-300 transition-colors"
                  >
                    <CaretLeft size={15} weight="bold" />
                  </button>
                  <span className="font-head font-bold text-sm text-ink">{monthLabel}</span>
                  <button
                    type="button"
                    onClick={() => setCalMonth(m => addMonths(m, 1))}
                    className="w-9 h-9 rounded-2xl bg-surface border border-line flex items-center justify-center text-ink hover:border-brand-300 transition-colors"
                  >
                    <CaretRight size={15} weight="bold" />
                  </button>
                </div>

                {/* Day-of-week labels */}
                <div className="grid grid-cols-7 mb-1">
                  {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-muted py-1">{d}</div>
                  ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-y-0.5">
                  {grid.map((date, i) => {
                    if (!date) return <div key={`e${i}`} />;
                    const past   = isPast(date);
                    const isSt   = isStart(date);
                    const isEn   = isEnd(date);
                    const inR    = inRange(date);
                    const inPrev = inPreview(date);
                    const isToday = date.getTime() === today.getTime();

                    return (
                      <button
                        key={date.getTime()}
                        type="button"
                        disabled={past}
                        onClick={() => handleDay(date)}
                        onMouseEnter={() => !past && setHovered(date)}
                        onMouseLeave={() => setHovered(null)}
                        className={[
                          "relative h-9 flex items-center justify-center text-[13px] font-medium transition-all select-none",
                          past ? "text-slate-300 cursor-not-allowed" : "cursor-pointer",
                          (inR || inPrev) ? "bg-brand-100" : "",
                          isSt ? "rounded-l-full" : "",
                          isEn ? "rounded-r-full" : "",
                          !isSt && !isEn && !inR && !inPrev && !past
                            ? "hover:bg-brand-50 rounded-full"
                            : "",
                          isSt || isEn ? "text-white" : "",
                          !isSt && !isEn && inR ? "text-brand-700" : "",
                          !isSt && !isEn && inPrev ? "text-brand-500" : "",
                          isToday && !isSt && !isEn ? "font-extrabold text-brand-500" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        {(isSt || isEn) && (
                          <span className="absolute inset-0 bg-brand-gradient rounded-full shadow-glow-sm" />
                        )}
                        <span className="relative z-10">{date.getDate()}</span>
                        {isToday && !isSt && !isEn && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-500" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Hint */}
                <p className="text-center text-[11px] text-muted mt-3 font-medium">
                  {!start
                    ? "Tap a date to set pickup"
                    : !end
                      ? "Now tap the return date"
                      : "✓ Dates selected — close to continue"}
                </p>

                <button
                  type="button"
                  onClick={() => setCalOpen(false)}
                  className="mt-3 w-full py-2 rounded-2xl bg-brand-gradient text-white text-sm font-bold shadow-glow-sm"
                >
                  {start && end ? "Confirm dates" : "Done"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Message ── */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2.5">
            Message to lender <span className="normal-case font-medium">(optional)</span>
          </p>
          <div className="relative flex items-start gap-3 p-4 bg-slate-50 border border-line rounded-3xl focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100 transition-all">
            <ChatTeardropText size={18} className="text-brand-400 mt-0.5 shrink-0" />
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Why you need it, your schedule for the handover…"
              rows={3}
              data-testid="borrow-message"
              className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-slate-400 resize-none font-plex leading-relaxed"
            />
            {message.length > 0 && (
              <span className="absolute bottom-3 right-4 text-[10px] text-muted font-medium">
                {message.length}
              </span>
            )}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="pt-1">
          <motion.button
            type="button"
            onClick={submit}
            disabled={!start || !end || submitting}
            whileTap={start && end && !submitting ? { scale: 0.97 } : undefined}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            data-testid="borrow-submit"
            className="w-full relative flex items-center bg-brand-gradient rounded-full h-[56px] px-2.5 shadow-glow disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            <span className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 z-10">
              {submitting
                ? <Spinner className="w-4 h-4 !border-white/40 !border-t-white" />
                : <PaperPlaneTilt size={18} weight="fill" className="text-white" />}
            </span>
            <span className="absolute inset-0 flex items-center justify-center text-white font-semibold text-[15px] pointer-events-none">
              {submitting
                ? "Sending…"
                : !start || !end
                  ? "Select dates to continue"
                  : `Send Request · ${duration} ${duration === 1 ? "day" : "days"}`}
            </span>
          </motion.button>

          <AnimatePresence>
            {start && end && !submitting && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center text-xs text-muted mt-2"
              >
                {fmtFull(start)} → {fmtFull(end)} · Free to borrow
              </motion.p>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

/* ─────────────────────── main component ───────────────────────── */
export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [ratings, setRatings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savingInProgress, setSavingInProgress] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const submitItemReport = async (payload) => {
    const { data } = await api.post("/reports", { item_id: id, ...payload });
    return data.report;
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [itemRes, ratingRes, saveRes] = await Promise.all([
          api.get(`/items/${id}`),
          api.get(`/ratings/item/${id}`).catch(() => ({ data: { count: 0, average: null, recent: [] } })),
          api.get(`/items/${id}/save`).catch(() => ({ data: { saved: false } })),
        ]);
        setItem(itemRes.data.item || itemRes.data);
        setRatings(ratingRes.data);
        setSaved(saveRes.data.saved);
      } catch {
        toast.error("Item not found.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const toggleSave = async () => {
    if (savingInProgress) return;
    setSavingInProgress(true);
    const next = !saved;
    setSaved(next);
    try {
      if (next) {
        await api.post(`/items/${id}/save`);
        toast.success("Saved to your collection");
      } else {
        await api.delete(`/items/${id}/save`);
        toast.info("Removed from saved");
      }
    } catch {
      setSaved(!next);
      toast.error("Could not update saved items");
    } finally {
      setSavingInProgress(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!item) return null;

  const isOwner = user && item.owner_id === user.id;
  const available = item.availability_status === "Available";

  return (
    <div className="max-w-2xl mx-auto" data-testid="item-detail-page">

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-muted text-sm font-medium hover:text-ink transition-colors mb-4"
        data-testid="item-back"
      >
        <ArrowLeft size={16} weight="bold" /> Back
      </button>

      {/* Hero + bookmark */}
      <div className="relative w-full aspect-[4/3] rounded-4xl overflow-hidden bg-brand-50 mb-4 shadow-card">
        {item.photo_url
          ? <img src={item.photo_url} alt={item.title} className="w-full h-full object-cover" />
          : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-brand-gradient/10">
              <Package size={64} className="text-brand-300" weight="thin" />
              <p className="text-brand-300 font-medium text-sm">No photo</p>
            </div>
          )}

        <div className="absolute top-3 left-3">
          <StatusBadge status={item.availability_status} />
        </div>

        {!isOwner && (
          <motion.button
            type="button"
            onClick={toggleSave}
            disabled={savingInProgress}
            whileTap={{ scale: 0.82 }}
            animate={saved ? { scale: [1, 1.25, 1] } : {}}
            transition={{ duration: 0.3 }}
            aria-label={saved ? "Remove from saved" : "Save item"}
            data-testid="item-save-btn"
            className={`absolute bottom-4 right-4 w-12 h-12 rounded-2xl flex items-center justify-center shadow-pop transition-all ${
              saved ? "bg-brand-gradient text-white" : "glass border border-white/40 text-ink backdrop-blur-md"
            }`}
          >
            <BookmarkSimple size={22} weight={saved ? "fill" : "regular"} />
          </motion.button>
        )}
      </div>

      {/* Title + rating + chips */}
      <div className="mb-4">
        <h1 className="font-head font-extrabold text-2xl tracking-tight text-ink leading-tight mb-2" data-testid="item-title">
          {item.title}
        </h1>
        <div className="mb-3">
          {ratings?.count > 0
            ? <StarDisplay value={ratings.average} count={ratings.count} />
            : <span className="text-xs text-muted italic">No reviews yet</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-xs font-semibold text-brand-700">
            <Tag size={12} weight="bold" /> {item.category}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-semibold text-emerald-700">
            <CheckCircle size={12} weight="bold" /> {item.condition}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-50 border border-line text-xs font-semibold text-slate-600">
            <MapPin size={12} weight="bold" />
            {item.location_college}{item.location_faculty ? ` · ${item.location_faculty}` : ""}
          </span>
        </div>
      </div>

      {/* Description */}
      {item.description && (
        <div className="bg-surface border border-line rounded-3xl p-4 mb-4 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">About this item</p>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{item.description}</p>
        </div>
      )}

      {/* Lender */}
      {item.owner && (
        <Link
          to={`/profile/${item.owner_id}`}
          className="flex items-center gap-3.5 p-4 rounded-3xl bg-surface border border-line shadow-soft mb-4 hover:border-brand-200 transition-colors"
          data-testid="item-owner"
        >
          <Avatar name={item.owner.full_name} src={item.owner.profile_picture} size={44} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-0.5">Lender</p>
            <p className="font-semibold text-ink leading-tight truncate">{item.owner.full_name}</p>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 shrink-0">
            <Star size={13} weight="fill" className="text-amber-400" />
            <span className="text-xs font-bold text-ink">
              {item.owner.trust_score != null ? Number(item.owner.trust_score).toFixed(1) : "—"}
            </span>
          </div>
          <ShieldCheck size={18} className="text-brand-400 shrink-0" weight="fill" />
        </Link>
      )}

      {/* CTA area */}
      {isOwner ? (
        <div
          className="flex items-center justify-between p-4 rounded-3xl bg-surface border border-line shadow-soft mb-6"
          data-testid="item-owner-actions"
        >
          <p className="text-sm text-muted">This is your listing.</p>
          <Link to={`/items/${id}/edit`}>
            <Button variant="secondary" size="sm" data-testid="item-edit">Edit listing</Button>
          </Link>
        </div>
      ) : available ? (
        <BorrowRequestCard
          itemId={id}
          onRequested={(txId) => navigate(`/transactions/${txId}`)}
        />
      ) : (
        <div
          className="p-5 rounded-3xl bg-slate-50 border border-line text-center text-sm text-muted mb-6"
          data-testid="item-unavailable"
        >
          This item is currently {item.availability_status.toLowerCase()} and cannot be requested.
        </div>
      )}

      {/* Reviews */}
      {ratings?.count > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-head font-bold text-base text-ink">Reviews</h2>
            <StarDisplay value={ratings.average} count={ratings.count} />
          </div>
          <div className="space-y-3">
            {ratings.recent.map(r => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-surface border border-line rounded-3xl p-4 shadow-soft"
                data-testid={`review-${r.id}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={13}
                        weight={n <= r.stars ? "fill" : "regular"}
                        className={n <= r.stars ? "text-amber-400" : "text-slate-200"} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted font-medium">{r.rater_name}</span>
                </div>
                {r.feedback && <p className="text-sm text-ink leading-relaxed">{r.feedback}</p>}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Report this listing (SRS UC3301) — non-owners only */}
      {!isOwner && (
        <button
          onClick={() => setReportOpen(true)}
          className="w-full text-sm font-medium text-muted hover:text-status-cancelled flex items-center justify-center gap-1.5 py-3 mb-6 transition-colors"
          data-testid="report-item-btn"
        >
          <Flag size={15} /> Report this listing
        </button>
      )}

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report listing"
        intro="Report this listing for a policy or safety violation. Misuse may affect your own standing."
        categories={ITEM_REPORT_CATEGORIES}
        submit={submitItemReport}
        onViewStatus={() => navigate("/settings/reports")}
        returnLabel="Return to Listing"
      />
    </div>
  );
}
