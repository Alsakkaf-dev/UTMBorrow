import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUp, ArrowDown, Clock, CaretUpDown, CaretUp, CaretDown, CheckSquare, Square } from "@phosphor-icons/react";

/* ============================ Button ============================ */
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
const BTN_SIZES = {
  xs: "px-3 py-1.5 text-xs",
  sm: "px-3.5 py-2 text-[13px]",
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-3.5 text-[15px]",
  xl: "px-8 py-4 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      whileTap={isDisabled ? undefined : { scale: 0.96 }}
      whileHover={isDisabled ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={isDisabled}
      className={`relative inline-flex items-center justify-center gap-2 font-plex font-semibold rounded-full select-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${BTN_SIZES[size] || BTN_SIZES.md} ${BTN_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="w-4 h-4 !border-current !border-t-transparent" />}
      <span className={loading ? "opacity-90" : ""}>{children}</span>
    </motion.button>
  );
}

/* ============================ IconButton ============================ */
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
const FIELD =
  "w-full px-4 py-3 bg-surface border border-line rounded-2xl text-ink placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 font-plex text-sm";

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
          className={`${FIELD} ${icon ? "pl-11" : ""} ${error ? "!border-status-cancelled !ring-red-100" : ""} ${className}`}
          {...props}
        />
      </div>
      {hint  && !error && <span className="text-slate-400 text-xs mt-1.5 block">{hint}</span>}
      {error && <span className="text-status-cancelled text-xs mt-1.5 block">{error}</span>}
    </label>
  );
}

export function Textarea({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="label-eyebrow block mb-1.5">{label}</span>}
      <textarea className={`${FIELD} resize-none ${className}`} {...props} />
    </label>
  );
}

export function Select({ label, children, className = "", ...props }) {
  return (
    <label className="block">
      {label && <span className="label-eyebrow block mb-1.5">{label}</span>}
      <div className="relative">
        <select className={`${FIELD} appearance-none pr-10 cursor-pointer ${className}`} {...props}>
          {children}
        </select>
        <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
      </div>
    </label>
  );
}

