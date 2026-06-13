import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, WarningCircle, Info, Bell } from "@phosphor-icons/react";

// ---- Imperative singleton bus (callable from anywhere, incl. realtime) ----
let _id = 0; // auto-incrementing id for each toast
const subs = new Set(); // active ToastProvider listeners (normally just one)

// Build a toast object and notify every subscribed provider to render it
function push(message, opts = {}) {
  // `?? 3800` = default auto-dismiss after 3.8s; pass duration: 0 to keep it sticky
  const t = {
    id: ++_id,
    message,
    type: opts.type || "default",
    duration: opts.duration ?? 3800,
    ...opts,
  };
  subs.forEach((fn) => fn(t));
  return t.id;
}

// Public API: call toast.success("Saved!") etc. from anywhere in the app
export const toast = {
  show: (m, o) => push(m, o),
  success: (m, o) => push(m, { ...o, type: "success" }),
  error: (m, o) => push(m, { ...o, type: "error" }),
  info: (m, o) => push(m, { ...o, type: "info" }),
};

// Per-type ring color + icon
const STYLES = {
  success: {
    ring: "ring-status-borrowed/30",
    icon: (
      <CheckCircle size={20} weight="fill" className="text-status-borrowed" />
    ),
  },
  error: {
    ring: "ring-status-cancelled/30",
    icon: (
      <WarningCircle
        size={20}
        weight="fill"
        className="text-status-cancelled"
      />
    ),
  },
  info: {
    ring: "ring-brand-400/40",
    icon: <Info size={20} weight="fill" className="text-brand-600" />,
  },
  default: {
    ring: "ring-line",
    icon: <Bell size={20} weight="fill" className="text-ink" />,
  },
};

// A single toast card: shows the icon/message and auto-dismisses after its duration
function ToastCard({ t, onDismiss }) {
  const s = STYLES[t.type] || STYLES.default;
  useEffect(() => {
    if (!t.duration) return; // duration 0/undefined -> stays until clicked
    // Schedule auto-dismiss; clear the timer if the card unmounts first
    const id = setTimeout(() => onDismiss(t.id), t.duration);
    return () => clearTimeout(id);
  }, [t, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      onClick={() => onDismiss(t.id)}  // tap anywhere to dismiss early
      data-testid="toast"
      className={`pointer-events-auto cursor-pointer w-[min(92vw,26rem)] glass rounded-2xl shadow-pop ring-1 ${s.ring} px-4 py-3 flex items-start gap-3`}
    >
      <span className="shrink-0 mt-0.5">{s.icon}</span>
      <div className="min-w-0">
        {t.title && (
          <p className="font-head font-semibold text-sm text-ink leading-tight">
            {t.title}
          </p>
        )}
        <p className="text-sm text-ink/80 leading-snug break-words">
          {t.message}
        </p>
      </div>
    </motion.div>
  );
}

// Mount once near the app root: listens to the toast bus and renders the stack
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // Subscribe to the bus; slice(-3) keeps at most the 3 newest toasts on screen
    const onPush = (t) => setToasts((cur) => [...cur.slice(-3), t]);
    subs.add(onPush);
    return () => subs.delete(onPush); // unsubscribe on unmount
  }, []);

  const dismiss = (id) => setToasts((cur) => cur.filter((t) => t.id !== id));

  return (
    <>
      {children}
      {/* Fixed, centered stack at the top; AnimatePresence animates cards in/out */}
      <div className="fixed top-3 inset-x-0 z-[200] flex flex-col items-center gap-2 px-3 pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard key={t.id} t={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
