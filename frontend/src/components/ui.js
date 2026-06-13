import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUp, ArrowDown, Clock, CaretUpDown, CaretUp, CaretDown, CheckSquare, Square } from "@phosphor-icons/react";

/* ============================ Button ============================ */
// Tailwind class sets per visual style; pick one via the `variant` prop
const BTN_VARIANTS = {
  primary:
    "text-white bg-brand-gradient shadow-glow-sm hover:shadow-glow hover:brightness-[1.06] btn-shine",
  secondary:
    "bg-surface text-ink border border-line hover:border-brand-300 hover:bg-brand-50/60 shadow-soft",
  soft:    "bg-brand-50 text-brand-700 hover:bg-brand-100 hover:shadow-soft",
  danger:  "text-white bg-danger-gradient shadow-glow-danger hover:brightness-[1.06] btn-shine",
  success: "text-white bg-success-gradient shadow-glow-success hover:brightness-[1.06] btn-shine",
  ghost:   "bg-transparent text-ink hover:bg-slate-100",
  dark:    "bg-ink text-white hover:bg-inkhover shadow-float btn-shine",
};
// Padding + font-size per `size` prop
const BTN_SIZES = {
  xs: "px-3 py-1.5 text-xs",
  sm: "px-3.5 py-2 text-[13px]",
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-3.5 text-[15px]",
  xl: "px-8 py-4 text-base",
};

// Primary button: animated press/hover, optional loading spinner
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}) {
  const isDisabled = disabled || loading; // loading also blocks interaction
  return (
    <motion.button
      whileTap={isDisabled ? undefined : { scale: 0.96 }}  // no motion while disabled
      whileHover={isDisabled ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={isDisabled}
      // base classes + size + variant + any caller-supplied className
      className={`relative inline-flex items-center justify-center gap-2 font-plex font-semibold rounded-full select-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${BTN_SIZES[size] || BTN_SIZES.md} ${BTN_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="w-4 h-4 !border-current !border-t-transparent" />}
      <span className={loading ? "opacity-90" : ""}>{children}</span>
    </motion.button>
  );
}

/* ============================ IconButton ============================ */
// Round, icon-only button; `label` becomes the accessibility name (aria-label)
export function IconButton({ className = "", children, label, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.06 }}
      aria-label={label}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-ink hover:bg-slate-100 transition-colors ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/* ============================ Inputs ============================ */
// Shared field styling reused by Input / Textarea / Select for a consistent look
const FIELD =
  "w-full px-4 py-3 bg-surface border border-line rounded-2xl text-ink placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 font-plex text-sm";

// Text input with optional label, leading icon, hint, and error message
export function Input({ label, error, icon, hint, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="label-eyebrow block mb-1.5">{label}</span>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          // extra left padding when an icon is present; red border on error
          className={`${FIELD} ${icon ? "pl-11" : ""} ${error ? "!border-status-cancelled !ring-red-100" : ""} ${className}`}
          {...props}
        />
      </div>
      {/* show the hint only when there's no error to show instead */}
      {hint  && !error && <span className="text-slate-400 text-xs mt-1.5 block">{hint}</span>}
      {error && <span className="text-status-cancelled text-xs mt-1.5 block">{error}</span>}
    </label>
  );
}

// Multi-line text field (no resize handle), same shared styling
export function Textarea({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="label-eyebrow block mb-1.5">{label}</span>}
      <textarea className={`${FIELD} resize-none ${className}`} {...props} />
    </label>
  );
}

// Dropdown: hides the native arrow (appearance-none) and draws our own chevron
export function Select({ label, children, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="label-eyebrow block mb-1.5">{label}</span>}
      <div className="relative">
        <select className={`${FIELD} appearance-none pr-10 cursor-pointer ${className}`} {...props}>
          {children}
        </select>
        {/* custom down-chevron, positioned over the right edge */}
        <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
      </div>
    </label>
  );
}

/* ============================ Card ============================ */
// Rounded surface container; `as` picks the element, `hover` adds a lift effect
export function Card({ as = "div", hover = false, className = "", children, ...props }) {
  const Comp = motion[as] || motion.div; // animate the chosen tag (fallback: div)
  return (
    <Comp
      whileHover={hover ? { y: -4, boxShadow: "0 2px 4px rgba(15,23,42,0.06), 0 20px 40px -16px rgba(15,23,42,0.24)" } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={`bg-surface border border-line rounded-3xl shadow-card ${className}`}
      {...props}
    >
      {children}
    </Comp>
  );
}

/* ============================ SectionHeader ============================ */
// Title row with optional eyebrow label and a right-aligned action slot
export function SectionHeader({ eyebrow, title, action, className = "" }) {
  return (
    <div className={`flex items-end justify-between gap-3 ${className}`}>
      <div>
        {eyebrow && <p className="label-eyebrow mb-0.5">{eyebrow}</p>}
        <h2 className="font-head font-bold text-xl text-ink tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ============================ Chip ============================ */
// Pill toggle/filter; `active` switches to the filled brand style
export function Chip({ active, icon, className = "", children, ...props }) {
  return (
    <motion.button
      whileTap={{ scale: 0.93 }}
      className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-all duration-200 ${
        active
          ? "bg-brand-gradient text-white border-transparent shadow-glow-sm"
          : "bg-surface border-line text-muted hover:border-brand-300 hover:text-ink hover:bg-brand-50/40"
      } ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </motion.button>
  );
}

/* ============================ Avatar ============================ */
// Profile image, or first 1–2 name initials on a brand background as fallback
export function Avatar({ name, src, size = 40, ring = false, className = "" }) {
  // Take the first letter of up to two name parts, e.g. "Mohammed Alsakkaf" -> "MA"
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center font-head font-bold text-white bg-brand-gradient ${ring ? "ring-2 ring-brand-200 ring-offset-1" : ""} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}  // scale font with avatar size
    >
      {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

/* ============================ Status badges ============================ */
// Per-status dot color + pill classes (keyed by the transaction/item status string)
const STATUS_STYLES = {
  Available: { dot: "bg-brand-500",         cls: "bg-brand-50 text-brand-700 border-brand-100" },
  Pending:   { dot: "bg-status-pending",    cls: "bg-amber-50 text-amber-700 border-amber-100" },
  Approved:  { dot: "bg-status-pending",    cls: "bg-amber-50 text-amber-700 border-amber-100" },
  Borrowed:  { dot: "bg-status-borrowed",   cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  Completed: { dot: "bg-status-completed",  cls: "bg-blue-50 text-blue-700 border-blue-100" },
  Rejected:  { dot: "bg-status-cancelled",  cls: "bg-red-50 text-red-700 border-red-100" },
  Cancelled: { dot: "bg-status-cancelled",  cls: "bg-red-50 text-red-700 border-red-100" },
  Removed:   { dot: "bg-status-cancelled",  cls: "bg-red-50 text-red-700 border-red-100" },
  Overdue:   { dot: "bg-status-overdue",    cls: "bg-red-50 text-red-700 border-red-100" },
};

// Colored pill (dot + label) for a status; unknown statuses fall back to grey
export function StatusBadge({ status, className = "" }) {
  const s = STATUS_STYLES[status] || { dot: "bg-slate-400", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      {status}
    </span>
  );
}

// Attention badge for returns: "Overdue" (late) vs "Return Due" (upcoming)
export function UrgentBadge({ overdue, className = "" }) {
  return (
    <span
      data-testid="urgent-return-badge"
      className={`inline-flex items-center gap-1 px-2 py-1 bg-danger-gradient text-white text-[10px] font-bold uppercase tracking-widest rounded-lg shadow-glow-danger animate-pulse-soft ${className}`}
    >
      {overdue ? "Overdue" : "Return Due"}
    </span>
  );
}

/* ============================ Trust Score Ring ============================ */
// Circular gauge of a 0–5 trust score, with the numeric value in the center
export function TrustRing({ score = 0, size = 80, strokeWidth = 6, className = "" }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;   // full arc length
  const pct = Math.min(Math.max(score / 5, 0), 1); // score as 0..1, clamped
  const offset = circumference * (1 - pct);     // how much of the arc to leave empty

  // Color tiers: green (great) -> indigo -> amber -> red (poor)
  const color = pct >= 0.8 ? "#10B981" : pct >= 0.6 ? "#6366F1" : pct >= 0.4 ? "#F59E0B" : "#EF4444";

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      {/* rotate -90deg so the arc starts at the top (12 o'clock) */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        {/* grey background track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#E4E7F2" strokeWidth={strokeWidth}
        />
        {/* colored progress arc, animated from empty to `offset` */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      {/* centered score number (overlaid on the ring) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-head font-extrabold text-ink" style={{ fontSize: size * 0.22 }}>
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

/* ============================ Star rating ============================ */
// 5-star rating; read-only by default, interactive when `editable` (with hover preview)
export function StarRating({ value = 0, size = 18, onChange, editable = false }) {
  const [hover, setHover] = useState(0);
  const stars = [1, 2, 3, 4, 5];
  const display = editable ? (hover || value) : value; // preview hovered value while editing
  return (
    <div className="flex gap-0.5 items-center">
      {stars.map((s) => {
        const filled = s <= Math.round(display); // this star is lit if its index <= current value
        return (
          <motion.button
            key={s}
            type="button"
            whileTap={editable ? { scale: 1.35 } : undefined}
            whileHover={editable ? { scale: 1.18 } : undefined}
            disabled={!editable}
            onClick={() => editable && onChange && onChange(s)}      // report the picked rating
            onHoverStart={() => editable && setHover(s)}             // preview on hover
            onHoverEnd={() => editable && setHover(0)}
            data-testid={`star-${s}`}
            className={editable ? "cursor-pointer" : "cursor-default"}
            aria-label={`${s} star`}
          >
            <svg width={size} height={size} viewBox="0 0 24 24"
              fill={filled ? "#F59E0B" : "none"}
              stroke={filled ? "#F59E0B" : "#CBD5E1"}
              strokeWidth="1.5"
            >
              <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.8 5.8 21.5l1.6-7L2 9.8l7.1-.6z" />
            </svg>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ============================ Spinner / loaders ============================ */
// Small inline spinner (one colored edge spinning); used inside buttons, etc.
export function Spinner({ className = "" }) {
  return (
    <div className={`inline-block border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin ${className || "w-5 h-5"}`} />
  );
}

// Full-page loading state (centered spinner + "Loading…") for route/data waits
export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}  // continuous spin
        className="w-9 h-9 border-2 border-brand-100 border-t-brand-600 rounded-full"
      />
      <p className="text-xs font-semibold text-muted animate-pulse-soft">Loading…</p>
    </div>
  );
}

/* ============================ EmptyState ============================ */
// Placeholder shown when a list/page has no data: icon, title, subtitle, optional action
export function EmptyState({ title, subtitle, action, icon, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
        className="w-20 h-20 rounded-3xl bg-brand-50 text-brand-500 flex items-center justify-center mb-5 shadow-soft"
      >
        <span className="text-3xl">{icon || "✦"}</span>
      </motion.div>
      <h3 className="font-head font-bold text-lg text-ink">{title}</h3>
      {subtitle && <p className="text-sm text-muted mt-1.5 max-w-xs leading-relaxed">{subtitle}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

/* ============================ Live indicator ============================ */
// Connection status dot + label (mirrors the SSE/realtime state)
export function LiveDot({ status = "live", className = "" }) {
  const map = {                                              // color + label per state
    live:       { c: "bg-status-borrowed", label: "Live" },
    connecting: { c: "bg-status-pending",  label: "Connecting" },
    offline:    { c: "bg-slate-300",        label: "Offline" },
  };
  const s = map[status] || map.offline; // default to offline for unknown values
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted ${className}`}>
      <span className="relative flex w-2 h-2">
        {/* pinging ring only when live */}
        {status === "live" && (
          <span className={`absolute inline-flex w-full h-full rounded-full ${s.c} opacity-60 animate-ping`} />
        )}
        <span className={`relative inline-flex w-2 h-2 rounded-full ${s.c}`} />
      </span>
      {s.label}
    </span>
  );
}

/* ============================ ProgressBar ============================ */
// Horizontal fill bar; value/max -> percentage, `animated` grows it on mount
export function ProgressBar({ value = 0, max = 100, color = "brand", className = "", animated = true }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100); // clamp to 0–100%
  const COLORS = {                                             // gradient per color prop
    brand:   "bg-brand-gradient",
    success: "bg-success-gradient",
    amber:   "bg-amber-gradient",
    danger:  "bg-danger-gradient",
  };
  return (
    <div className={`w-full h-2 rounded-full bg-slate-100 overflow-hidden ${className}`}>
      <motion.div
        initial={animated ? { width: 0 } : { width: `${pct}%` }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        className={`h-full rounded-full ${COLORS[color] || COLORS.brand}`}
      />
    </div>
  );
}

/* ============================ Modal / Sheet ============================ */
// Center dialog on desktop, bottom sheet on mobile; renders only while `open`
export function Modal({ open, onClose, title, children, testid, size = "md" }) {
  // Trap focus + close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); }; // Esc closes the modal
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);   // clean up the listener
  }, [open, onClose]);

  const maxW = size === "lg" ? "sm:max-w-lg" : size === "sm" ? "sm:max-w-sm" : "sm:max-w-md"; // width per `size`

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center" data-testid={testid}>
          {/* dim backdrop; clicking it closes the modal */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* the panel: slides up from the bottom and fades in */}
          <motion.div
            initial={{ opacity: 0, y: 52, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0,  y: 36,  scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className={`relative bg-surface w-full ${maxW} rounded-t-4xl sm:rounded-4xl border border-line shadow-pop p-6 max-h-[90vh] overflow-y-auto`}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden w-10 h-1 rounded-full bg-line mx-auto mb-4" />
            {(title || onClose) && (
              <div className="flex items-start justify-between gap-3 mb-5">
                {title ? (
                  <h2 className="font-head font-bold text-xl text-ink leading-tight">{title}</h2>
                ) : <span />}
                {onClose && (
                  <IconButton onClick={onClose} label="Close" className="!w-9 !h-9 shrink-0 -mt-1 -mr-1 bg-canvas hover:bg-slate-100">
                    <X size={18} />
                  </IconButton>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

