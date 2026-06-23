// Live updates over Server-Sent Events.
//
// A single EventSource is shared across the whole app. Components subscribe to
// named server events ("catalog.changed", "transaction.updated", etc.) via the
// `useRealtimeEvent` hook. EventSource reconnects automatically on drop.

import { useEffect, useRef, useState } from "react";

const BASE = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const EVENT_TYPES = [
  "connected",
  "auth_error",
  "notification.new",
  "catalog.changed",
  "item.updated",
  "transaction.updated",
  "moderation.changed",
  "admin.changed",
  "chat.message",
  "chat.cleared",
  "chat.read",
];

let es = null;
let currentToken = null;
const listeners = new Map(); // type -> Set<handler>
const statusListeners = new Set(); // Set<handler(status)>
let status = "offline"; // 'offline' | 'connecting' | 'live'

function emit(type, payload) {
  const set = listeners.get(type);
  if (!set) return;
  set.forEach((h) => {
    try { h(payload); } catch (e) { console.error("realtime handler error", e); }
  });
}

function setStatus(next) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((h) => { try { h(status); } catch {} });
}

export function connectRealtime(token) {
  if (!token) return;
  if (es && currentToken === token) return; // already connected with this token
  disconnectRealtime();
  currentToken = token;
  setStatus("connecting");

  const url = `${BASE}/api/events?token=${encodeURIComponent(token)}`;
  es = new EventSource(url);

  es.onopen = () => setStatus("live");
  es.onerror = () => {
    // Browser will retry automatically; reflect the gap in the UI.
    setStatus("connecting");
  };

  EVENT_TYPES.forEach((type) => {
    es.addEventListener(type, (e) => {
      let payload = {};
      try { payload = e.data ? JSON.parse(e.data) : {}; } catch { payload = {}; }
      if (type === "connected") setStatus("live");
      if (type === "auth_error") { disconnectRealtime(); return; }
      emit(type, payload);
    });
  });
}

export function disconnectRealtime() {
  if (es) { es.close(); es = null; }
  currentToken = null;
  setStatus("offline");
}

export function onRealtime(type, handler) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(handler);
  return () => { listeners.get(type)?.delete(handler); };
}

/** Subscribe a component to a server event for its lifetime. */
export function useRealtimeEvent(type, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => onRealtime(type, (p) => ref.current && ref.current(p)), [type]);
}

/** Reactive connection status: 'offline' | 'connecting' | 'live'. */
export function useRealtimeStatus() {
  const [s, setS] = useState(status);
  useEffect(() => {
    setS(status);
    statusListeners.add(setS);
    return () => { statusListeners.delete(setS); };
  }, []);
  return s;
}
