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
