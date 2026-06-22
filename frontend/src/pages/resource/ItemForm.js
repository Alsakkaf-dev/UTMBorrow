import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Check, X,
  Camera, MapPin, Rocket, Sparkle,
} from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { PageLoader, Modal, Button } from "../../components/ui";
import { toast } from "../../components/Toast";

// Listing is part of an active transaction → editing needs a confirmation
// (SRS UC2102 A1). The save updates metadata only; the transaction is untouched.
const ACTIVE_STATUSES = ["Pending", "Approved", "Borrowed"];

/* ─────────────────────────────────────────────────────────────
   Static data
───────────────────────────────────────────────────────────── */

// Categories must mirror the server-enforced list in backend/routers/items.py
// (SDD §4.2.2). A mismatch causes a 400 on every non-matching selection.
const CATEGORY_META = [
  { label: "Electronics",   emoji: "💻", ring: "ring-blue-400",    active: "bg-blue-50 border-blue-400" },
  { label: "Textbooks",     emoji: "📚", ring: "ring-amber-400",   active: "bg-amber-50 border-amber-400" },
  { label: "Lab Equipment", emoji: "🧪", ring: "ring-emerald-400", active: "bg-emerald-50 border-emerald-400" },
  { label: "Tools",         emoji: "🔧", ring: "ring-slate-400",   active: "bg-slate-50 border-slate-400" },
  { label: "Clothing",      emoji: "👕", ring: "ring-pink-400",    active: "bg-pink-50 border-pink-400" },
  { label: "Other",         emoji: "📦", ring: "ring-brand-400",   active: "bg-brand-50 border-brand-400" },
];

// Conditions must mirror backend CONDITIONS (SDD §4.2.2): Like New, Good, Fair, Poor.
const CONDITION_META = [
  {
    label: "Like New",
    desc: "No visible wear, as good as new",
    emoji: "✨",
    chip: "bg-emerald-50 border-emerald-200 text-emerald-700",
    activeChip: "bg-emerald-500 border-emerald-500 text-white",
    dot: "bg-emerald-400",
    glow: "shadow-glow-success",
  },
  {
    label: "Good",
    desc: "Light use, works perfectly",
    emoji: "👍",
    chip: "bg-blue-50 border-blue-200 text-blue-700",
    activeChip: "bg-blue-500 border-blue-500 text-white",
    dot: "bg-blue-400",
    glow: "shadow-[0_0_12px_rgba(59,130,246,0.35)]",
  },
  {
    label: "Fair",
    desc: "Noticeable wear, functional",
    emoji: "🔄",
    chip: "bg-amber-50 border-amber-200 text-amber-700",
    activeChip: "bg-amber-500 border-amber-500 text-white",
    dot: "bg-amber-400",
    glow: "shadow-glow-warm",
  },
  {
    label: "Poor",
    desc: "Heavy wear, still usable",
    emoji: "⚠️",
    chip: "bg-red-50 border-red-200 text-red-600",
    activeChip: "bg-red-500 border-red-500 text-white",
    dot: "bg-red-400",
    glow: "shadow-glow-danger",
  },
];

const STEPS = [
  { label: "Category",    eyebrow: "Step 1 of 5", heading: "What are you lending?",     sub: "Pick the category that best fits your item." },
  { label: "Name",        eyebrow: "Step 2 of 5", heading: "Give it a name",             sub: "A clear, specific title gets far more borrowers." },
  { label: "Story",       eyebrow: "Step 3 of 5", heading: "Tell borrowers more",        sub: "Details build trust and speed up approvals." },
  { label: "Photo",       eyebrow: "Step 4 of 5", heading: "Show it off",                sub: "Listings with photos get 3× more requests." },
  { label: "Review",      eyebrow: "Step 5 of 5", heading: "Ready to launch 🚀",         sub: "Here's exactly how borrowers will see your listing." },
];

const EMPTY = {
  title: "", description: "", category: "", condition: "",
  location_college: "", location_faculty: "", photo_url: null,
};

const DRAFT_KEY = "utmb_item_draft";
const TITLE_MAX = 80;
const DESC_MAX  = 500;

/* ─────────────────────────────────────────────────────────────
   Root component
───────────────────────────────────────────────────────────── */

export default function ItemForm() {
  const { id }    = useParams();
  const navigate  = useNavigate();
  const editing   = Boolean(id);

  const [step,            setStep]           = useState(editing ? 1 : 0);
  const [dir,             setDir]            = useState(1);
  const [form,            setForm]           = useState(EMPTY);
  const [meta,            setMeta]           = useState({ categories: [], conditions: [], colleges: [], faculties: [] });
  const [loading,         setLoading]        = useState(editing);
  const [saving,          setSaving]         = useState(false);
  const [errors,          setErrors]         = useState({});
  const [showDraftBanner, setShowDraftBanner]= useState(false);
  const [showTips,        setShowTips]       = useState(false);
  const [dragOver,        setDragOver]       = useState(false);
  const [itemStatus,      setItemStatus]     = useState(null);   // availability_status when editing
  const [confirmEditOpen, setConfirmEditOpen]= useState(false);
  const fileRef = useRef(null);

  /* ── bootstrap ── */
  useEffect(() => {
    api.get("/items/meta").then(({ data }) => setMeta(data)).catch(() => {});
    if (editing) {
      api.get(`/items/${id}`)
        .then(({ data }) => {
          const it = data.item || data;
          setItemStatus(it.availability_status || null);
          setForm({
            title: it.title || "", description: it.description || "",
            category: it.category || "", condition: it.condition || "",
            location_college: it.location_college || "",
            location_faculty: it.location_faculty || "",
            photo_url: it.photo_url || null,
          });
        })
        .catch(() => toast.error("Could not load item."))
        .finally(() => setLoading(false));
    } else {
      try {
        const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}");
        if (saved.title || saved.category || saved.description) setShowDraftBanner(true);
      } catch {}
    }
  }, [id, editing]);

  /* ── auto-save draft (create only) ── */
  useEffect(() => {
    if (!editing) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form, editing]);

  /* ── form helpers ── */
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const clearErr = (...keys) => setErrors(e => {
    const n = { ...e }; keys.forEach(k => delete n[k]); return n;
  });

  const goTo = useCallback((next) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
    setErrors({});
  }, [step]);

  const validateStep = (s) => {
    const e = {};
    if (s === 0 && !form.category)       e.category = "Select a category to continue.";
    if (s === 1) {
      if (!form.title.trim())            e.title = "Give your item a name.";
      else if (form.title.trim().length < 3) e.title = "Title needs at least 3 characters.";
      if (!form.condition)               e.condition = "Select the item's condition.";
    }
    if (s === 2 && !form.location_college) e.location_college = "Select your college.";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const advance = () => { if (validateStep(step)) goTo(step + 1); };
  const retreat = () => step > 0 ? goTo(step - 1) : navigate(-1);

  /* ── draft restore ── */
  const restoreDraft = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "{}");
      setForm(f => ({ ...f, ...saved }));
      let target = 0;
      if (saved.category)         target = 1;
      if (saved.title)            target = 2;
      if (saved.location_college) target = 3;
      setDir(1); setStep(target);
    } catch {}
    setShowDraftBanner(false);
  };
  const discardDraft = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    setShowDraftBanner(false);
  };

  /* ── photo ── */
  const processFile = useCallback((file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please pick an image file."); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error("Photo must be under 5 MB.");  return; }
    const reader = new FileReader();
    reader.onload = () => set("photo_url", reader.result);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  /* ── submit ── */
  // Editing a listing tied to an active transaction first asks for confirmation
  // (SRS UC2102 A1); everything else saves immediately.
  const submit = () => {
    if (editing && ACTIVE_STATUSES.includes(itemStatus)) {
      setConfirmEditOpen(true);
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
    setConfirmEditOpen(false);
    setSaving(true);
    try {
      const payload = {
        ...form,
        location_faculty: form.location_faculty || null,
        description: form.description || null,
      };
      if (editing) {
        await api.put(`/items/${id}`, payload);
        sessionStorage.removeItem(DRAFT_KEY);
        toast.success("Listing updated!");
        navigate(`/items/${id}`);
      } else {
        const { data } = await api.post("/items", payload);
        sessionStorage.removeItem(DRAFT_KEY);
        toast.success("Listing is live! 🎉");
        navigate(`/items/${data.item?.id || data.id}`);
      }
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  const progress       = (step / (STEPS.length - 1)) * 100;
  const currentStep    = STEPS[Math.min(step, STEPS.length - 1)];
  const catMeta        = CATEGORY_META.find(c => c.label === form.category);
  const condMeta       = CONDITION_META.find(c => c.label === form.condition);
  const isLastStep     = step === STEPS.length - 1;

  return (
    <div className="flex flex-col min-h-screen bg-canvas" data-testid="item-form-page">

      {/* ══ Sticky top bar ══ */}
      <div className="sticky top-0 z-20 bg-canvas/90 backdrop-blur-md border-b border-line">
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={retreat}
            data-testid="form-back"
            className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center text-ink shadow-soft shrink-0"
          >
            <ArrowLeft size={19} weight="bold" />
          </motion.button>

          <div className="flex-1 min-w-0">
            <p className="label-eyebrow !text-[9px] !tracking-[0.14em] mb-0.5">{currentStep.eyebrow}</p>
            <p className="font-head font-bold text-sm text-ink leading-tight truncate">{currentStep.label}</p>
          </div>

          {editing && (
            <span className="text-[11px] font-bold text-brand-600 bg-brand-50 border border-brand-100 px-3 py-1 rounded-full shrink-0">
              Editing
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-[3px] bg-slate-100 mx-0">
          <motion.div
            className="h-full bg-brand-gradient origin-left"
            initial={false}
            animate={{ scaleX: progress / 100 }}
            style={{ transformOrigin: "left" }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>

        {/* Step pill dots */}
        <div className="flex justify-center items-center gap-1.5 py-2.5">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.label}
              animate={{
                width: i === step ? 22 : 6,
                backgroundColor: i < step ? "#2563EB" : i === step ? "#1E3A8A" : "#e2e8f0",
                opacity: i > step ? 0.6 : 1,
              }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="h-[6px] rounded-full"
            />
          ))}
        </div>
      </div>

      {/* ══ Sticky step heading (steps 0-3; review step scrolls with content) ══ */}
      {!isLastStep && (
        <motion.div
          key={`heading-${step}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 px-4 pt-5 pb-4 bg-canvas border-b border-line/50"
        >
          <h2 className="font-head font-extrabold text-[1.6rem] text-ink leading-tight mb-1.5">
            {currentStep.heading}
          </h2>
          <p className="text-sm text-muted leading-relaxed">{currentStep.sub}</p>
        </motion.div>
      )}

      {/* ══ Step content (slide container) ══ */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={{
              enter:  (d) => ({ x: d > 0 ? "55%" : "-55%", opacity: 0, scale: 0.97 }),
              center: { x: 0, opacity: 1, scale: 1 },
              exit:   (d) => ({ x: d > 0 ? "-55%" : "55%", opacity: 0, scale: 0.97 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="absolute inset-0 overflow-y-auto"
          >
            <div className="px-4 pt-5 pb-32">
              {/* Heading only on review step (scrolls with content) */}
              {isLastStep && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-7"
                >
                  <h2 className="font-head font-extrabold text-[1.6rem] text-ink leading-tight mb-1.5">
                    {currentStep.heading}
                  </h2>
                  <p className="text-sm text-muted leading-relaxed">{currentStep.sub}</p>
                </motion.div>
              )}

              {step === 0 && <StepCategory form={form} set={set} errors={errors} clearErr={clearErr} />}
              {step === 1 && <StepDetails  form={form} set={set} errors={errors} clearErr={clearErr} />}
              {step === 2 && (
                <StepStory
                  form={form} set={set} errors={errors} clearErr={clearErr}
                  meta={meta} showTips={showTips} setShowTips={setShowTips}
                />
              )}
              {step === 3 && (
                <StepPhoto
                  form={form} set={set}
                  dragOver={dragOver} setDragOver={setDragOver}
                  processFile={processFile} handleDrop={handleDrop} fileRef={fileRef}
                />
              )}
              {step === 4 && (
                <StepReview form={form} catMeta={catMeta} condMeta={condMeta} editing={editing} goTo={goTo} />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ══ Bottom CTA bar ══ */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-8 pt-5 bg-gradient-to-t from-canvas via-canvas/95 to-transparent pointer-events-none">
        <div className="pointer-events-auto space-y-2">
          {!isLastStep ? (
            <motion.button
              whileHover={{ y: -2, boxShadow: "0 8px 32px -8px rgba(37,99,235,0.55)" }}
              whileTap={{ scale: 0.97 }}
              onClick={advance}
              className="relative w-full py-[17px] rounded-[28px] bg-brand-gradient text-white font-plex font-bold text-[15px] shadow-glow flex items-center justify-center gap-3 overflow-hidden btn-shine"
            >
              <span className="absolute left-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <ArrowRight size={19} weight="bold" />
              </span>
              Continue
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ y: -2, boxShadow: "0 8px 32px -8px rgba(37,99,235,0.55)" }}
              whileTap={{ scale: 0.97 }}
              onClick={submit}
              disabled={saving}
              className="relative w-full py-[17px] rounded-[28px] bg-brand-gradient text-white font-plex font-bold text-[15px] shadow-glow flex items-center justify-center gap-3 overflow-hidden btn-shine disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span className="absolute left-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Rocket size={19} weight="fill" />
                  </span>
                  {editing ? "Save changes" : "Publish listing"}
                </>
              )}
            </motion.button>
          )}

          {/* Skip only on photo step */}
          {step === 3 && !form.photo_url && (
            <button
              onClick={advance}
              className="w-full py-2.5 text-sm font-semibold text-muted text-center"
            >
              Skip for now →
            </button>
          )}
        </div>
      </div>

      {/* ══ Draft restore banner ══ */}
      <AnimatePresence>
        {showDraftBanner && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4"
          >
            <div className="bg-surface border border-line rounded-4xl p-5 shadow-card-hover">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
                  <Sparkle size={20} weight="fill" className="text-brand-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-head font-bold text-ink mb-0.5">Continue your draft?</p>
                  <p className="text-xs text-muted leading-relaxed">You left a listing unfinished. Pick up where you left off.</p>
                </div>
              </div>
              <div className="flex gap-2.5 mt-4">
                <button
                  onClick={discardDraft}
                  className="flex-1 py-3 rounded-2xl border border-line text-sm font-semibold text-muted bg-canvas hover:bg-slate-50 transition-colors"
                >
                  Start fresh
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={restoreDraft}
                  className="flex-1 py-3 rounded-2xl bg-brand-gradient text-white text-sm font-bold shadow-glow-sm"
                >
                  Restore draft
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active-transaction edit confirmation (SRS UC2102 A1) */}
      <Modal
        open={confirmEditOpen}
        onClose={() => setConfirmEditOpen(false)}
        title="Edit active listing?"
        testid="edit-active-confirm-modal"
      >
        <p className="text-sm text-muted leading-relaxed" data-testid="edit-active-warning">
          This item is currently part of an active transaction. Editing won't affect that transaction. Continue?
        </p>
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmEditOpen(false)} data-testid="edit-active-cancel">
            Cancel
          </Button>
          <Button className="flex-1" loading={saving} onClick={doSubmit} data-testid="edit-active-confirm">
            Continue
          </Button>
        </div>
      </Modal>

      {/* hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={(e) => processFile(e.target.files?.[0])}
        data-testid="form-photo"
        className="hidden"
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Step 0 — Category picker
══════════════════════════════════════════════════════════════ */
function StepCategory({ form, set, errors, clearErr }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {CATEGORY_META.map((cat, i) => {
          const active = form.category === cat.label;
          return (
            <motion.button
              key={cat.label}
              initial={{ opacity: 0, scale: 0.88, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.045, type: "spring", stiffness: 300, damping: 24 }}
              whileHover={{ y: -3, scale: 1.03 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => { set("category", cat.label); clearErr("category"); }}
              data-testid={`form-cat-${cat.label}`}
              className={`relative flex flex-col items-center justify-center gap-2.5 py-5 px-2 rounded-3xl border-2 transition-all duration-200 ${
                active
                  ? `${cat.active} shadow-glow-sm`
                  : "border-line bg-surface hover:border-brand-200 hover:bg-brand-50/20"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="cat-check"
                  className="absolute top-2 right-2 w-5 h-5 bg-brand-gradient rounded-full flex items-center justify-center shadow-glow-sm"
                >
                  <Check size={11} weight="bold" className="text-white" />
                </motion.div>
              )}
              <span
                className="text-[32px] leading-none"
                style={{ filter: active ? "none" : "grayscale(20%)" }}
              >
                {cat.emoji}
              </span>
              <span className={`text-[11px] font-bold leading-tight text-center ${active ? "text-brand-700" : "text-ink"}`}>
                {cat.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {errors.category && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-red-500 font-semibold text-center mt-5"
          >
            {errors.category}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Step 1 — Title + Condition
══════════════════════════════════════════════════════════════ */
function StepDetails({ form, set, errors, clearErr }) {
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <label className="label-eyebrow block mb-2">Title</label>
        <div className="relative">
          <input
            ref={inputRef}
            value={form.title}
            maxLength={TITLE_MAX}
            onChange={(e) => { set("title", e.target.value); clearErr("title"); }}
            placeholder='e.g. "Canon EOS M50 Camera"'
            data-testid="form-title"
            className={`w-full px-5 py-4 text-[1.05rem] font-head font-semibold bg-surface border-2 rounded-2xl text-ink placeholder:text-slate-300 outline-none transition-all duration-200 ${
              errors.title
                ? "border-red-300 ring-4 ring-red-50"
                : "border-line focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            }`}
          />
          {/* char counter track */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-2xl overflow-hidden bg-slate-100">
            <motion.div
              className="h-full bg-brand-gradient origin-left"
              animate={{ scaleX: form.title.length / TITLE_MAX }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              style={{ transformOrigin: "left" }}
            />
          </div>
          <span className={`absolute top-3 right-4 text-[11px] font-mono tabular-nums ${
            form.title.length > TITLE_MAX * 0.85 ? "text-amber-400" : "text-slate-300"
          }`}>
            {form.title.length}/{TITLE_MAX}
          </span>
        </div>
        <AnimatePresence>
          {errors.title && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-xs text-red-500 font-semibold mt-1.5"
            >{errors.title}</motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Condition */}
      <div>
        <label className="label-eyebrow block mb-3">Condition</label>
        <div className="grid grid-cols-2 gap-3">
          {CONDITION_META.map((cond, i) => {
            const active = form.condition === cond.label;
            return (
              <motion.button
                key={cond.label}
                initial={{ opacity: 0, x: i % 2 === 0 ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, type: "spring", stiffness: 280, damping: 26 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { set("condition", cond.label); clearErr("condition"); }}
                data-testid={`form-cond-${cond.label}`}
                className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                  active ? `${cond.activeChip} ${cond.glow}` : `${cond.chip} hover:shadow-soft`
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl ${
                  active ? "bg-white/25" : "bg-white"
                }`}>
                  {cond.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-bold text-[13px] leading-tight ${active ? "text-white" : "text-ink"}`}>
                    {cond.label}
                  </p>
                  <p className={`text-[11px] leading-tight mt-0.5 ${active ? "text-white/75" : "text-muted"}`}>
                    {cond.desc}
                  </p>
                </div>
                {active && <Check size={15} weight="bold" className="text-white shrink-0" />}
              </motion.button>
            );
          })}
        </div>
        <AnimatePresence>
          {errors.condition && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-xs text-red-500 font-semibold mt-2"
            >{errors.condition}</motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Step 2 — Description + Location
══════════════════════════════════════════════════════════════ */
function StepStory({ form, set, errors, clearErr, meta, showTips, setShowTips }) {
  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label-eyebrow">Description</label>
          <button
            onClick={() => setShowTips(!showTips)}
            className="text-[11px] font-bold text-brand-600 flex items-center gap-1 transition-opacity hover:opacity-75"
          >
            {showTips ? "Hide tips ↑" : "Writing tips ✨"}
          </button>
        </div>

        <AnimatePresence>
          {showTips && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 mb-3">
                <p className="text-xs font-bold text-brand-700 mb-2.5">What borrowers love to see:</p>
                <ul className="space-y-2">
                  {[
                    "📦 Exactly what's included — cables, case, manuals",
                    "⚠️ Any quirks or limitations worth knowing",
                    "📍 Where you prefer to meet for handover",
                    "⏱️ Ideal loan duration you're comfortable with",
                  ].map(tip => (
                    <li key={tip} className="text-xs text-brand-800 leading-relaxed">{tip}</li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          <textarea
            value={form.description}
            maxLength={DESC_MAX}
            onChange={(e) => set("description", e.target.value)}
            rows={6}
            placeholder="Describe your item — what's included, any wear, ideal use cases…"
            data-testid="form-description"
            className="w-full px-4 py-3.5 pb-7 bg-surface border-2 border-line rounded-2xl text-ink placeholder:text-slate-300 outline-none transition-all duration-200 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 font-plex text-sm resize-none"
          />
          <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2">
            <div className="flex-1 h-[3px] bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brand-gradient origin-left"
                animate={{ scaleX: form.description.length / DESC_MAX }}
                transition={{ type: "spring", stiffness: 200, damping: 24 }}
                style={{ transformOrigin: "left" }}
              />
            </div>
            <span className={`text-[11px] font-mono tabular-nums shrink-0 ${
              form.description.length > DESC_MAX * 0.85 ? "text-amber-400" : "text-slate-300"
            }`}>
              {form.description.length}/{DESC_MAX}
            </span>
          </div>
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="label-eyebrow flex items-center gap-1.5 mb-3">
          <MapPin size={12} weight="bold" /> Location
        </label>
        <div className="space-y-2.5">
          <div className="relative">
            <select
              value={form.location_college}
              onChange={(e) => { set("location_college", e.target.value); clearErr("location_college"); }}
              data-testid="form-college"
              className={`w-full px-4 py-3.5 bg-surface border-2 rounded-2xl text-ink appearance-none cursor-pointer outline-none transition-all font-plex text-sm ${
                errors.location_college
                  ? "border-red-300 ring-4 ring-red-50"
                  : "border-line focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
              }`}
            >
              <option value="">Select your college…</option>
              {meta.colleges.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
          </div>
          <AnimatePresence>
            {errors.location_college && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-red-500 font-semibold"
              >{errors.location_college}</motion.p>
            )}
          </AnimatePresence>

          <div className="relative">
            <select
              value={form.location_faculty}
              onChange={(e) => set("location_faculty", e.target.value)}
              data-testid="form-faculty"
              className="w-full px-4 py-3.5 bg-surface border-2 border-line rounded-2xl text-ink appearance-none cursor-pointer outline-none transition-all font-plex text-sm focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
            >
              <option value="">Faculty — optional</option>
              {meta.faculties.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Step 3 — Photo
══════════════════════════════════════════════════════════════ */
function StepPhoto({ form, set, dragOver, setDragOver, processFile, handleDrop, fileRef }) {
  return (
    <div>
      {form.photo_url ? (
        /* ── Photo preview ── */
        <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
          <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-card-hover">
            <img src={form.photo_url} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

            {/* "Looking great" badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 280, damping: 22 }}
              className="absolute bottom-4 left-4"
            >
              <span className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm text-ink text-xs font-bold px-3 py-2 rounded-full shadow-soft">
                <Sparkle size={13} weight="fill" className="text-amber-400" />
                Looking great!
              </span>
            </motion.div>

            {/* Remove button */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => set("photo_url", null)}
              className="absolute top-3 right-3 w-9 h-9 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center"
            >
              <X size={16} weight="bold" />
            </motion.button>
          </div>

          {/* Change photo CTA */}
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => fileRef.current?.click()}
            className="w-full mt-4 py-3.5 rounded-2xl border-2 border-dashed border-brand-200 text-brand-600 font-semibold text-sm flex items-center justify-center gap-2 bg-brand-50/40 hover:bg-brand-50 transition-colors"
          >
            <Camera size={17} weight="bold" /> Change photo
          </motion.button>
        </motion.div>
      ) : (
        /* ── Drop zone ── */
        <div>
          <motion.div
            animate={dragOver ? { scale: 1.015, borderColor: "#6366f1" } : { scale: 1 }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative w-full aspect-[4/3] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
              dragOver ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-surface hover:border-brand-300 hover:bg-brand-50/30"
            }`}
          >
            {/* Inner dashed ring */}
            <div className={`absolute inset-4 rounded-2xl border-2 border-dashed pointer-events-none transition-colors ${
              dragOver ? "border-brand-300/60" : "border-slate-100"
            }`} />

            <motion.div
              animate={dragOver ? { scale: 1.12, rotate: -5 } : { scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-5 transition-colors ${
                dragOver ? "bg-brand-100" : "bg-slate-100"
              }`}
            >
              <Camera size={36} className={dragOver ? "text-brand-500" : "text-slate-400"} weight="duotone" />
            </motion.div>

            <p className="font-head font-bold text-ink text-[15px] mb-1.5">
              {dragOver ? "Drop it here!" : "Tap to add a photo"}
            </p>
            <p className="text-xs text-muted text-center max-w-[200px] leading-relaxed">
              {dragOver ? "Release to upload your image" : "or drag & drop — JPG, PNG, WEBP · max 5 MB"}
            </p>
          </motion.div>

          {/* Photo tips row */}
          <div className="grid grid-cols-3 gap-2.5 mt-5">
            {[
              { emoji: "💡", tip: "Good lighting" },
              { emoji: "📐", tip: "Square or 4:3" },
              { emoji: "🎯", tip: "Item centred" },
            ].map(({ emoji, tip }, i) => (
              <motion.div
                key={tip}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="bg-surface border border-line rounded-2xl p-3.5 text-center"
              >
                <span className="text-2xl">{emoji}</span>
                <p className="text-[11px] font-bold text-muted mt-1.5">{tip}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Step 4 — Review & Publish
══════════════════════════════════════════════════════════════ */
function StepReview({ form, catMeta, condMeta, editing, goTo }) {
  const checks = [
    { label: "Category",    ok: !!form.category,             step: 0 },
    { label: "Title",       ok: form.title.trim().length >= 3, step: 1 },
    { label: "Condition",   ok: !!form.condition,            step: 1 },
    { label: "Location",    ok: !!form.location_college,     step: 2 },
    { label: "Description", ok: !!form.description.trim(),   step: 2, optional: true },
    { label: "Photo",       ok: !!form.photo_url,            step: 3, optional: true },
  ];
  const allRequired = checks.filter(c => !c.optional).every(c => c.ok);

  return (
    <div>
      {/* ── Preview card — mirrors real listing design ── */}
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        className="bg-surface border border-line rounded-4xl overflow-hidden shadow-card-hover mb-6"
      >
        {/* Hero */}
        <div className="relative w-full h-52 bg-brand-gradient">
          {form.photo_url ? (
            <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/60">
              <span className="text-5xl">{catMeta?.emoji || "📦"}</span>
              <span className="text-xs font-semibold">No photo</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {catMeta && (
            <div className="absolute top-3 left-3">
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-sm text-ink shadow-soft">
                {catMeta.emoji} {catMeta.label}
              </span>
            </div>
          )}
          {condMeta && (
            <div className="absolute top-3 right-3">
              <span className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold ${condMeta.activeChip} shadow-soft`}>
                {condMeta.emoji} {condMeta.label}
              </span>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="font-head font-extrabold text-white text-xl leading-tight drop-shadow-sm">
              {form.title || <span className="opacity-40 italic">Item title</span>}
            </h3>
            {form.location_college && (
              <p className="text-white/75 text-xs mt-1 font-medium">
                📍 {form.location_college}{form.location_faculty ? ` · ${form.location_faculty}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {form.description ? (
            <p className="text-sm text-ink/80 leading-relaxed line-clamp-3">{form.description}</p>
          ) : (
            <p className="text-sm text-slate-300 italic">No description added yet</p>
          )}

          <div className="flex gap-0 pt-3 border-t border-line">
            {[
              { label: "Category", value: form.category || "—" },
              { label: "Condition", value: form.condition || "—" },
              { label: "College", value: form.location_college || "—" },
            ].map(({ label, value }, i, arr) => (
              <React.Fragment key={label}>
                <div className="flex-1 text-center">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">{label}</p>
                  <p className="text-xs font-bold text-ink truncate px-1">{value}</p>
                </div>
                {i < arr.length - 1 && <div className="w-px bg-line my-1" />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Completion checklist ── */}
      <div className="space-y-2.5 mb-6">
        {checks.map(({ label, ok, step: targetStep, optional }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.055 }}
            className="flex items-center gap-3"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              ok ? "bg-emerald-500" : optional ? "bg-slate-100" : "bg-red-50 border border-red-200"
            }`}>
              {ok
                ? <Check size={12} weight="bold" className="text-white" />
                : <div className={`w-2 h-2 rounded-full ${optional ? "bg-slate-300" : "bg-red-300"}`} />
              }
            </div>
            <span className={`text-sm flex-1 ${ok ? "text-ink font-semibold" : optional ? "text-muted" : "text-red-400"}`}>
              {label}
              {optional && !ok && <span className="text-xs text-slate-300 ml-1.5">optional</span>}
            </span>
            {!ok && (
              <button
                onClick={() => goTo(targetStep)}
                className="text-[11px] font-bold text-brand-600 hover:text-brand-700 transition-colors"
              >
                Add →
              </button>
            )}
          </motion.div>
        ))}
      </div>

      {/* All required filled */}
      <AnimatePresence>
        {allRequired && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
              <Check size={18} weight="bold" className="text-white" />
            </div>
            <div>
              <p className="font-bold text-emerald-700 text-sm">
                {editing ? "Ready to save changes!" : "Your listing is ready to publish!"}
              </p>
              <p className="text-xs text-emerald-600/80 mt-0.5">
                {editing ? "Hit save and your updates go live immediately." : "Hit publish and borrowers can request it right away."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
