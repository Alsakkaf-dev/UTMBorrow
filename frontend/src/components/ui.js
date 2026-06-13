import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ArrowUp,
  ArrowDown,
  Clock,
  CaretUpDown,
  CaretUp,
  CaretDown,
  CheckSquare,
  Square,
} from "@phosphor-icons/react";

/* ============================ Button ============================ */
// Tailwind class sets per visual style; pick one via the `variant` prop
const BTN_VARIANTS = {
  primary:
    "text-white bg-brand-gradient shadow-glow-sm hover:shadow-glow hover:brightness-[1.06] btn-shine",
  secondary:
    "bg-surface text-ink border border-line hover:border-brand-300 hover:bg-brand-50/60 shadow-soft",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 hover:shadow-soft",
  danger:
    "text-white bg-danger-gradient shadow-glow-danger hover:brightness-[1.06] btn-shine",
  success:
    "text-white bg-success-gradient shadow-glow-success hover:brightness-[1.06] btn-shine",
  ghost: "bg-transparent text-ink hover:bg-slate-100",
  dark: "bg-ink text-white hover:bg-inkhover shadow-float btn-shine",
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
      whileTap={isDisabled ? undefined : { scale: 0.96 }} // no motion while disabled
      whileHover={isDisabled ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={isDisabled}
      // base classes + size + variant + any caller-supplied className
      className={`relative inline-flex items-center justify-center gap-2 font-plex font-semibold rounded-full select-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${BTN_SIZES[size] || BTN_SIZES.md} ${BTN_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <Spinner className="w-4 h-4 !border-current !border-t-transparent" />
      )}
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
      {hint && !error && (
        <span className="text-slate-400 text-xs mt-1.5 block">{hint}</span>
      )}
      {error && (
        <span className="text-status-cancelled text-xs mt-1.5 block">
          {error}
        </span>
      )}
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
        <select
          className={`${FIELD} appearance-none pr-10 cursor-pointer ${className}`}
          {...props}
        >
          {children}
        </select>
        {/* custom down-chevron, positioned over the right edge */}
        <svg
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </label>
  );
}

/* ============================ Card ============================ */
// Rounded surface container; `as` picks the element, `hover` adds a lift effect
export function Card({
  as = "div",
  hover = false,
  className = "",
  children,
  ...props
}) {
  const Comp = motion[as] || motion.div; // animate the chosen tag (fallback: div)
  return (
    <Comp
      whileHover={
        hover
          ? {
              y: -4,
              boxShadow:
                "0 2px 4px rgba(15,23,42,0.06), 0 20px 40px -16px rgba(15,23,42,0.24)",
            }
          : undefined
      }
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
        <h2 className="font-head font-bold text-xl text-ink tracking-tight">
          {title}
        </h2>
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
      style={{ width: size, height: size, fontSize: size * 0.38 }} // scale font with avatar size
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

/* ============================ Status badges ============================ */
// Per-status dot color + pill classes (keyed by the transaction/item status string)
const STATUS_STYLES = {
  Available: {
    dot: "bg-brand-500",
    cls: "bg-brand-50 text-brand-700 border-brand-100",
  },
  Pending: {
    dot: "bg-status-pending",
    cls: "bg-amber-50 text-amber-700 border-amber-100",
  },
  Approved: {
    dot: "bg-status-pending",
    cls: "bg-amber-50 text-amber-700 border-amber-100",
  },
  Borrowed: {
    dot: "bg-status-borrowed",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  Completed: {
    dot: "bg-status-completed",
    cls: "bg-blue-50 text-blue-700 border-blue-100",
  },
  Rejected: {
    dot: "bg-status-cancelled",
    cls: "bg-red-50 text-red-700 border-red-100",
  },
  Cancelled: {
    dot: "bg-status-cancelled",
    cls: "bg-red-50 text-red-700 border-red-100",
  },
  Removed: {
    dot: "bg-status-cancelled",
    cls: "bg-red-50 text-red-700 border-red-100",
  },
  Overdue: {
    dot: "bg-status-overdue",
    cls: "bg-red-50 text-red-700 border-red-100",
  },
};

// Colored pill (dot + label) for a status; unknown statuses fall back to grey
export function StatusBadge({ status, className = "" }) {
  const s = STATUS_STYLES[status] || {
    dot: "bg-slate-400",
    cls: "bg-slate-100 text-slate-600 border-slate-200",
  };
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
export function TrustRing({
  score = 0,
  size = 80,
  strokeWidth = 6,
  className = "",
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius; // full arc length
  const pct = Math.min(Math.max(score / 5, 0), 1); // score as 0..1, clamped
  const offset = circumference * (1 - pct); // how much of the arc to leave empty

  // Color tiers: green (great) -> indigo -> amber -> red (poor)
  const color =
    pct >= 0.8
      ? "#10B981"
      : pct >= 0.6
        ? "#6366F1"
        : pct >= 0.4
          ? "#F59E0B"
          : "#EF4444";

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* rotate -90deg so the arc starts at the top (12 o'clock) */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        {/* grey background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E4E7F2"
          strokeWidth={strokeWidth}
        />
        {/* colored progress arc, animated from empty to `offset` */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      {/* centered score number (overlaid on the ring) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-head font-extrabold text-ink"
          style={{ fontSize: size * 0.22 }}
        >
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

/* ============================ Star rating ============================ */
// 5-star rating; read-only by default, interactive when `editable` (with hover preview)
export function StarRating({
  value = 0,
  size = 18,
  onChange,
  editable = false,
}) {
  const [hover, setHover] = useState(0);
  const stars = [1, 2, 3, 4, 5];
  const display = editable ? hover || value : value; // preview hovered value while editing
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
            onClick={() => editable && onChange && onChange(s)} // report the picked rating
            onHoverStart={() => editable && setHover(s)} // preview on hover
            onHoverEnd={() => editable && setHover(0)}
            data-testid={`star-${s}`}
            className={editable ? "cursor-pointer" : "cursor-default"}
            aria-label={`${s} star`}
          >
            <svg
              width={size}
              height={size}
              viewBox="0 0 24 24"
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
    <div
      className={`inline-block border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin ${className || "w-5 h-5"}`}
    />
  );
}

// Full-page loading state (centered spinner + "Loading…") for route/data waits
export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} // continuous spin
        className="w-9 h-9 border-2 border-brand-100 border-t-brand-600 rounded-full"
      />
      <p className="text-xs font-semibold text-muted animate-pulse-soft">
        Loading…
      </p>
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
      {subtitle && (
        <p className="text-sm text-muted mt-1.5 max-w-xs leading-relaxed">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

/* ============================ Live indicator ============================ */
// Connection status dot + label (mirrors the SSE/realtime state)
export function LiveDot({ status = "live", className = "" }) {
  const map = {
    // color + label per state
    live: { c: "bg-status-borrowed", label: "Live" },
    connecting: { c: "bg-status-pending", label: "Connecting" },
    offline: { c: "bg-slate-300", label: "Offline" },
  };
  const s = map[status] || map.offline; // default to offline for unknown values
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted ${className}`}
    >
      <span className="relative flex w-2 h-2">
        {/* pinging ring only when live */}
        {status === "live" && (
          <span
            className={`absolute inline-flex w-full h-full rounded-full ${s.c} opacity-60 animate-ping`}
          />
        )}
        <span className={`relative inline-flex w-2 h-2 rounded-full ${s.c}`} />
      </span>
      {s.label}
    </span>
  );
}

/* ============================ ProgressBar ============================ */
// Horizontal fill bar; value/max -> percentage, `animated` grows it on mount
export function ProgressBar({
  value = 0,
  max = 100,
  color = "brand",
  className = "",
  animated = true,
}) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100); // clamp to 0–100%
  const COLORS = {
    // gradient per color prop
    brand: "bg-brand-gradient",
    success: "bg-success-gradient",
    amber: "bg-amber-gradient",
    danger: "bg-danger-gradient",
  };
  return (
    <div
      className={`w-full h-2 rounded-full bg-slate-100 overflow-hidden ${className}`}
    >
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
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    }; // Esc closes the modal
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey); // clean up the listener
  }, [open, onClose]);

  const maxW =
    size === "lg"
      ? "sm:max-w-lg"
      : size === "sm"
        ? "sm:max-w-sm"
        : "sm:max-w-md"; // width per `size`

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center"
          data-testid={testid}
        >
          {/* dim backdrop; clicking it closes the modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* the panel: slides up from the bottom and fades in */}
          <motion.div
            initial={{ opacity: 0, y: 52, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 36, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className={`relative bg-surface w-full ${maxW} rounded-t-4xl sm:rounded-4xl border border-line shadow-pop p-6 max-h-[90vh] overflow-y-auto`}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden w-10 h-1 rounded-full bg-line mx-auto mb-4" />
            {(title || onClose) && (
              <div className="flex items-start justify-between gap-3 mb-5">
                {title ? (
                  <h2 className="font-head font-bold text-xl text-ink leading-tight">
                    {title}
                  </h2>
                ) : (
                  <span />
                )}
                {onClose && (
                  <IconButton
                    onClick={onClose}
                    label="Close"
                    className="!w-9 !h-9 shrink-0 -mt-1 -mr-1 bg-canvas hover:bg-slate-100"
                  >
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

/* ============================ TrendBadge ============================ */
// Up/down delta pill (green when ≥0, red when negative); hidden if no value
export function TrendBadge({ value, suffix = "%", className = "" }) {
  if (value === null || value === undefined) return null; // nothing to show
  const positive = Number(value) >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"} ${className}`}
    >
      {positive ? (
        <ArrowUp size={10} weight="bold" />
      ) : (
        <ArrowDown size={10} weight="bold" />
      )}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

/* ============================ PriorityBadge ============================ */
// Admin priority tag P1/P2/P3 (P1 = most urgent); classes per level
const PRIORITY_STYLES = {
  P1: "bg-red-50 text-red-700 border-red-200",
  P2: "bg-amber-50 text-amber-700 border-amber-200",
  P3: "bg-slate-100 text-slate-600 border-slate-200",
};
export function PriorityBadge({ level, className = "" }) {
  const cls = PRIORITY_STYLES[level] || PRIORITY_STYLES.P3; // unknown -> lowest priority style
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${cls} ${className}`}
    >
      {level}
    </span>
  );
}

/* ============================ SLABadge ============================ */
// Countdown to an SLA deadline (createdAt + slaHours); color escalates as time runs out
export function SLABadge({ createdAt, slaHours = 72, className = "" }) {
  const deadline = new Date(createdAt).getTime() + slaHours * 3_600_000; // 3_600_000 ms = 1 hour
  const hoursLeft = Math.round((deadline - Date.now()) / 3_600_000);
  const overdue = hoursLeft < 0; // past the deadline
  const urgent = hoursLeft < 6; // under 6h left
  const warning = hoursLeft < 24; // under a day left
  const color =
    overdue || urgent
      ? "bg-red-50 text-red-600"
      : warning
        ? "bg-amber-50 text-amber-600"
        : "bg-emerald-50 text-emerald-700";
  const label = overdue
    ? `${Math.abs(hoursLeft)}h overdue`
    : `${hoursLeft}h left`;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${color} ${className}`}
    >
      <Clock size={10} weight="bold" /> {label}
    </span>
  );
}

/* ============================ StatCard ============================ */
// Dashboard metric card: icon, big value, label, and an optional trend badge
export function StatCard({
  icon,
  label,
  value,
  trend,
  tone = "brand",
  className = "",
  testid,
}) {
  const TONE_MAP = {
    // icon background/text color per `tone`
    brand: "bg-brand-50 text-brand-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      data-testid={testid}
      className={`bg-surface border border-line rounded-3xl p-5 shadow-card flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`w-10 h-10 rounded-2xl flex items-center justify-center ${TONE_MAP[tone] || TONE_MAP.brand}`}
        >
          {icon}
        </span>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <div>
        {/* tabular-nums keeps digit widths even; em-dash when value is missing */}
        <p className="text-2xl font-head font-bold text-ink tabular-nums leading-none">
          {value ?? "—"}
        </p>
        <p className="text-xs text-muted mt-1.5 leading-snug">{label}</p>
      </div>
    </motion.div>
  );
}

/* ============================ SlideDrawer ============================ */
// Right-side panel (full-height) used for detail views; Esc or backdrop closes it
export function SlideDrawer({
  open,
  onClose,
  title,
  children,
  testid,
  width = "sm:w-[520px]",
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    }; // Esc closes the drawer
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey); // remove listener on close/unmount
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[160] flex items-end sm:items-stretch sm:justify-end"
          data-testid={testid}
        >
          {/* dim backdrop; click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* the panel: slides in from the right */}
          <motion.div
            initial={{ x: 64, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className={`relative bg-surface w-full ${width} h-full overflow-y-auto border-l border-line shadow-pop flex flex-col`}
          >
            {/* sticky header with title + close button */}
            <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-line px-5 h-14 flex items-center justify-between shrink-0">
              <h2 className="font-head font-bold text-[16px] text-ink truncate">
                {title}
              </h2>
              <IconButton
                onClick={onClose}
                label="Close drawer"
                className="shrink-0 bg-canvas hover:bg-slate-100"
              >
                <X size={18} />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ============================ DataTable ============================ */
// Generic admin table: config-driven columns, optional row selection, sorting,
// loading skeleton, and an empty state. Each `columns` entry can supply a custom render().
export function DataTable({
  columns,
  rows,
  loading = false,
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectChange,
  sortKey,
  sortDir,
  onSort,
  emptyTitle = "No results",
  emptySubtitle,
  testid,
  rowTestid,
}) {
  // Header checkbox states: all rows selected vs. only some
  const allSelected =
    rows?.length > 0 && rows.every((r) => selectedIds.includes(r.id));
  const someSelected = rows?.some((r) => selectedIds.includes(r.id));

  // Header checkbox: select every row, or clear the selection
  const toggleAll = () => {
    if (!onSelectChange) return;
    onSelectChange(allSelected ? [] : rows.map((r) => r.id));
  };
  // Row checkbox: add/remove this row's id from the selection
  const toggleRow = (id) => {
    if (!onSelectChange) return;
    onSelectChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id],
    );
  };

  // Sort indicator per column: neutral arrows, or brand up/down for the active sort
  const SortIcon = ({ col }) => {
    if (!col.sortable) return null;
    if (sortKey !== col.key)
      return <CaretUpDown size={13} className="text-slate-300 ml-1 shrink-0" />;
    return sortDir === "asc" ? (
      <CaretUp size={13} className="text-brand-500 ml-1 shrink-0" />
    ) : (
      <CaretDown size={13} className="text-brand-500 ml-1 shrink-0" />
    );
  };

  const SKELETON = Array.from({ length: 5 }); // 5 placeholder rows while loading

  return (
    <div
      className="w-full overflow-x-auto rounded-2xl border border-line shadow-soft"
      data-testid={testid}
    >
      <table className="w-full text-sm min-w-[600px]">
        <thead>
          <tr className="border-b border-line bg-canvas">
            {/* leading select-all checkbox column (only when selectable) */}
            {selectable && (
              <th className="w-10 pl-4 py-3 text-left">
                <button
                  onClick={toggleAll}
                  className="text-slate-400 hover:text-brand-600 transition-colors"
                >
                  {/* filled = all selected, light = some selected, empty = none */}
                  {allSelected ? (
                    <CheckSquare
                      size={16}
                      weight="fill"
                      className="text-brand-600"
                    />
                  ) : someSelected ? (
                    <CheckSquare size={16} className="text-brand-400" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
            )}
            {/* one header cell per column; clickable when sortable */}
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted whitespace-nowrap ${col.sortable ? "cursor-pointer select-none hover:text-ink" : ""} ${col.className || ""}`}
                style={col.width ? { width: col.width } : {}}
                onClick={() => col.sortable && onSort && onSort(col.key)}
              >
                <span className="inline-flex items-center">
                  {col.label}
                  <SortIcon col={col} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* three states: loading skeleton -> empty message -> actual rows */}
          {loading ? (
            SKELETON.map((_, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                {selectable && (
                  <td className="pl-4 py-3">
                    <div className="w-4 h-4 rounded bg-line animate-pulse" />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    {/* random width gives the skeleton a more natural look */}
                    <div
                      className="h-4 rounded-lg bg-line animate-pulse"
                      style={{ width: `${55 + Math.random() * 35}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : rows?.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="px-4 py-12 text-center"
              >
                <p className="font-semibold text-ink text-sm">{emptyTitle}</p>
                {emptySubtitle && (
                  <p className="text-xs text-muted mt-1">{emptySubtitle}</p>
                )}
              </td>
            </tr>
          ) : (
            rows?.map((row, i) => {
              const isSelected = selectedIds.includes(row.id);
              return (
                <tr
                  key={row.id || i}
                  data-testid={rowTestid ? `${rowTestid}-${row.id}` : undefined}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`border-b border-line last:border-0 transition-colors ${onRowClick ? "cursor-pointer hover:bg-brand-50/40" : ""} ${isSelected ? "bg-brand-50/60" : "bg-surface"}`}
                >
                  {selectable && (
                    // stopPropagation so ticking the box doesn't also trigger onRowClick
                    <td
                      className="pl-4 py-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRow(row.id);
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare
                          size={16}
                          weight="fill"
                          className="text-brand-600"
                        />
                      ) : (
                        <Square size={16} className="text-slate-300" />
                      )}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""} ${col.tdClassName || ""}`}
                    >
                      {/* use the column's custom render() if given, else the raw value (— if empty) */}
                      {col.render
                        ? col.render(row[col.key], row)
                        : (row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ============================ Tabs ============================ */
// Segmented tab switcher; `tabs` is [{ value, label, icon?, count? }], `active` is the current value
export function Tabs({ tabs, active, onChange, className = "" }) {
  return (
    <div
      className={`flex gap-1 p-1 bg-canvas rounded-2xl border border-line ${className}`}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          // active tab gets a raised white pill; others are muted
          className={`relative flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
            active === t.value
              ? "bg-surface text-ink shadow-soft border border-line"
              : "text-muted hover:text-ink"
          }`}
        >
          {t.icon && <span>{t.icon}</span>}
          {t.label}
          {/* optional count badge, shown only when count > 0 */}
          {t.count !== undefined && t.count > 0 && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                active === t.value
                  ? "bg-brand-50 text-brand-600"
                  : "bg-slate-100 text-muted"
              }`}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ============================ SearchBar ============================ */
// Controlled search input with a magnifier icon and a clear (×) button
export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
  testid,
}) {
  const ref = useRef(null);
  return (
    // focus-within highlights the whole bar when the inner input is focused
    <div
      className={`flex items-center gap-2.5 bg-surface border border-line rounded-2xl px-4 h-11 shadow-soft focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100 transition-all ${className}`}
    >
      {/* magnifier icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="text-slate-400 shrink-0"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testid}
        className="flex-1 outline-none bg-transparent text-sm font-plex text-ink placeholder:text-slate-400"
      />
      {/* clear button appears only when there's text */}
      {value && (
        <button
          onClick={() => onChange("")}
          className="text-slate-400 hover:text-ink transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ============================ BulkActionBar ============================ */
// Floating bar shown when rows are selected: count + actions + clear; hidden when count is 0
export function BulkActionBar({ count, actions, onClear, className = "" }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-ink text-white px-4 py-2.5 rounded-2xl shadow-pop ${className}`}
        >
          <span className="text-sm font-semibold whitespace-nowrap">
            {count} selected
          </span>
          <div className="w-px h-5 bg-white/20" /> {/* divider */}
          {/* one button per action; `danger` actions render in red */}
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              disabled={a.loading}
              className={`flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-xl transition-colors disabled:opacity-50 ${a.danger ? "text-red-300 hover:bg-red-900/40" : "text-white hover:bg-white/10"}`}
            >
              {a.icon && <span>{a.icon}</span>}
              {a.label}
            </button>
          ))}
          <div className="w-px h-5 bg-white/20" />
          {/* clear the current selection */}
          <button
            onClick={onClear}
            className="text-white/60 hover:text-white transition-colors text-sm"
          >
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================ PageHeader ============================ */
// Top-of-page heading: big title with optional eyebrow, subtitle, and a right-aligned action
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className = "",
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="label-eyebrow mb-0.5">{eyebrow}</p>}
        <h1 className="font-head font-extrabold text-2xl md:text-3xl tracking-tight text-ink leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs md:text-sm text-muted mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
