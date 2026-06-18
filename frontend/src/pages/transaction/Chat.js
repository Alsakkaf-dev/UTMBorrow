import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, PaperPlaneRight, Paperclip, LockSimple,
  ShieldWarning, DotsThreeVertical, Flag, Check, Checks, ArrowDown,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeEvent } from "../../lib/realtime";
import { PageLoader, Avatar, Modal, Button, Textarea } from "../../components/ui";
import { toast } from "../../components/Toast";

/* ── time / date helpers ── */
function timeLabel(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function dayLabel(iso) {
  const d     = new Date(iso);
  const today = new Date();
  const yest  = new Date(); yest.setDate(today.getDate() - 1);
  const same  = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yest))  return "Yesterday";
  return d.toLocaleDateString([], {
    day: "numeric", month: "short",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
function dayKey(iso) { return new Date(iso).toDateString(); }

/* ── Scroll-to-bottom FAB ── */
function ScrollFab({ show, onClick, unread }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 24 }}
          onClick={onClick}
          className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-surface border border-line shadow-pop flex items-center justify-center hover:bg-brand-50 transition-colors"
        >
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-brand-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
          <ArrowDown size={18} weight="bold" className="text-ink" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ══════════════════ Main Chat Page ══════════════════ */
export default function Chat() {
  const { txId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading]    = useState(true);
  const [data, setData]          = useState(null);
  const [text, setText]          = useState("");
  const [sending, setSending]    = useState(false);
  const [menuOpen, setMenuOpen]  = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDesc, setReportDesc] = useState("");
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [unreadScrollCount, setUnreadScrollCount] = useState(0);
  const endRef      = useRef(null);
  const fileRef     = useRef(null);
  const scrollRef   = useRef(null);
  const inputRef    = useRef(null);

  const appendMessage = useCallback((msg) => {
    setData((d) => {
      if (!d) return d;
      if (d.messages.some((m) => m.id === msg.id)) return d;
      return { ...d, messages: [...d.messages, msg] };
    });
  }, []);

  const markRead = useCallback(async () => {
    try { await api.post(`/chat/by-transaction/${txId}/read`); } catch { /* best-effort */ }
  }, [txId]);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get(`/chat/by-transaction/${txId}`);
      setData(res);
      if (res.messages.some((m) => m.sender_id !== user.id && !m.read_at)) markRead();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Conversation unavailable.");
    } finally {
      setLoading(false);
    }
  }, [txId, user.id, markRead]);

  useEffect(() => { load(); }, [load]);

  useRealtimeEvent("chat.message", (p) => {
    if (p.transaction_id !== txId) return;
    appendMessage(p.message);
    if (p.message.sender_id !== user.id) {
      markRead();
      // If scrolled up, count unread
      if (showScrollFab) setUnreadScrollCount((c) => c + 1);
    }
  });

  useRealtimeEvent("chat.read", (p) => {
    if (p.transaction_id !== txId) return;
    setData((d) => d ? {
      ...d,
      messages: d.messages.map((m) =>
        m.sender_id === user.id && !m.read_at ? { ...m, read_at: p.read_at } : m),
    } : d);
  });

  useRealtimeEvent("chat.cleared", (p) => {
    if (p.transaction_id !== txId) return;
    toast.info("This conversation was ended and cleared.");
    navigate(-1);
  });

  // Auto-scroll on new messages (only if near bottom)
  useEffect(() => {
    if (!showScrollFab) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [data?.messages?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollFab(!nearBottom);
    if (nearBottom) setUnreadScrollCount(0);
  };

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setUnreadScrollCount(0);
  };

  const send = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const body = text.trim();
    setText("");
    inputRef.current?.focus();
    try {
      const { data: res } = await api.post(
        `/chat/by-transaction/${txId}/messages`,
        { kind: "text", body }
      );
      appendMessage(res.message);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
      setText(body);
    } finally {
      setSending(false);
    }
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast.error("Max file size is 4 MB."); return; }
    const kind   = file.type.startsWith("image/") ? "image" : "file";
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const { data: res } = await api.post(`/chat/by-transaction/${txId}/messages`, {
          kind, data_url: reader.result, file_name: file.name,
        });
        appendMessage(res.message);
      } catch (err) {
        toast.error(formatApiError(err.response?.data?.detail) || err.message);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const submitReport = async () => {
    try {
      await api.post(`/chat/by-transaction/${txId}/report`, {
        report_category: "Inappropriate_Offensive",
        description: reportDesc.trim() || null,
      });
      toast.success("Report submitted. Our team will review this conversation.");
      setReportOpen(false);
      setReportDesc("");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    }
  };

  if (loading) return <PageLoader />;
  if (!data)   return null;

  const cp      = data.counterparty;
  const locked  = !data.can_send;
  const messages= data.messages;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto bg-canvas" data-testid="chat-page">

      {/* ── Header ── */}
      <div className="relative shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-line glass-strong z-20">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="text-muted hover:text-ink p-1.5 -ml-1.5 rounded-xl hover:bg-canvas transition-colors"
          data-testid="chat-back"
        >
          <ArrowLeft size={22} weight="bold" />
        </motion.button>

        {/* Counterparty avatar + status */}
        <div className="relative">
          <Avatar name={cp?.full_name} src={cp?.profile_picture} size={40} className="ring-2 ring-brand-100" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-status-borrowed ring-2 ring-white" />
        </div>

        {/* Name + encryption label */}
        <div className="min-w-0 flex-1">
          <p className="font-head font-bold text-ink truncate leading-tight">{cp?.full_name}</p>
          <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <LockSimple size={11} weight="fill" /> End-to-end encrypted
          </p>
        </div>

        {/* Menu button */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-xl hover:bg-canvas text-muted hover:text-ink transition-colors"
            data-testid="chat-menu"
          >
            <DotsThreeVertical size={22} weight="bold" />
          </motion.button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -8 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                className="absolute right-0 top-12 z-50 bg-surface border border-line rounded-2xl shadow-pop overflow-hidden min-w-[190px]"
              >
                <button
                  onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  data-testid="chat-report-btn"
                >
                  <Flag size={16} weight="bold" /> Report conversation
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Scrollable message thread ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4"
        data-testid="chat-thread"
        onClick={() => setMenuOpen(false)}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center h-full text-muted py-10">
            <motion.div
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 rounded-3xl bg-brand-50 text-brand-400 flex items-center justify-center mb-4 shadow-soft"
            >
              <LockSimple size={28} weight="fill" />
            </motion.div>
            <p className="font-head font-semibold text-ink">This conversation is private</p>
            <p className="text-sm text-muted mt-1 max-w-[220px] leading-relaxed">
              Messages are encrypted end-to-end. Say hello 👋
            </p>
          </div>
        )}

        {/* Messages */}
        {messages.map((m, i) => {
          const mine       = m.sender_id === user.id;
          const prev       = messages[i - 1];
          const next       = messages[i + 1];
          const showDay    = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const lastOfGroup= !next || next.sender_id !== m.sender_id || dayKey(next.created_at) !== dayKey(m.created_at);

          return (
            <React.Fragment key={m.id}>
              {/* Day separator */}
              {showDay && (
                <div className="flex justify-center my-4">
                  <span className="px-3.5 py-1 rounded-full bg-surface border border-line text-[11px] font-semibold text-muted shadow-soft">
                    {dayLabel(m.created_at)}
                  </span>
                </div>
              )}

              {/* Message row */}
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className={`flex ${mine ? "justify-end" : "justify-start"} ${lastOfGroup ? "mb-3" : "mb-0.5"} items-end gap-2`}
                data-testid={`chat-msg-${m.id}`}
              >
                {/* Other's avatar (only on last of group) */}
                {!mine && (
                  <div className="shrink-0 w-7 h-7 mb-0.5">
                    {lastOfGroup ? (
                      <Avatar name={cp?.full_name} src={cp?.profile_picture} size={28} />
                    ) : null}
                  </div>
                )}

                {/* Bubble */}
                <div className={`relative max-w-[75%] ${
                  mine
                    ? `bubble-mine shadow-soft ${!lastOfGroup ? "rounded-2xl rounded-br-md" : ""}`
                    : `bubble-other ${!lastOfGroup ? "rounded-2xl rounded-bl-md" : ""}`
                }`}>

                  {/* Text content */}
                  {m.kind === "text" && (
                    <div className="px-3.5 py-2.5">
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
                        {m.body}
                      </p>
                    </div>
                  )}

                  {/* Image content */}
                  {m.kind === "image" && (
                    <div className="overflow-hidden rounded-[inherit]">
                      <img
                        src={m.data_url}
                        alt={m.file_name || "image"}
                        className="max-h-64 w-auto max-w-full block"
                      />
                    </div>
                  )}

                  {/* File content */}
                  {m.kind === "file" && (
                    <div className="px-3.5 py-2.5">
                      <a
                        href={m.data_url}
                        download={m.file_name}
                        className={`underline flex items-center gap-1.5 text-sm font-medium ${mine ? "text-white/90" : "text-brand-600"}`}
                      >
                        <Paperclip size={15} /> {m.file_name || "Download file"}
                      </a>
                    </div>
                  )}

                  {/* Timestamp + ticks */}
                  <div className={`flex items-center justify-end gap-1 px-3.5 pb-2 -mt-0.5 text-[10px] ${mine ? "text-white/60" : "text-muted"}`}>
                    {timeLabel(m.created_at)}
                    {mine && (
                      m.read_at
                        ? <Checks size={14} weight="bold" className="text-sky-300" aria-label="Seen" data-testid={`tick-read-${m.id}`} />
                        : <Check  size={14} weight="bold" className="opacity-60"  aria-label="Sent" data-testid={`tick-sent-${m.id}`} />
                    )}
                  </div>
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* Scroll-to-bottom FAB */}
      <div className="relative">
        <ScrollFab show={showScrollFab} onClick={scrollToBottom} unread={unreadScrollCount} />
      </div>

      {/* ── Composer ── */}
      <div className="shrink-0 border-t border-line bg-surface/95 backdrop-blur-sm px-3 py-3">
        {locked ? (
          <div
            className="flex items-center gap-2.5 text-sm text-muted bg-canvas rounded-2xl px-4 py-3 border border-line"
            data-testid="chat-locked"
          >
            <ShieldWarning size={18} className="text-amber-500 shrink-0" />
            <p className="text-xs leading-relaxed">Chat opens once both sides accept the request, and closes when the deal ends.</p>
          </div>
        ) : (
          <form onSubmit={send} className="flex items-end gap-2" data-testid="chat-composer">
            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={onFile}
              data-testid="chat-file-input"
            />

            {/* Attach button */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.88 }}
              onClick={() => fileRef.current?.click()}
              className="shrink-0 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-brand-600 rounded-full hover:bg-brand-50 transition-colors"
              data-testid="chat-attach"
            >
              <Paperclip size={21} />
            </motion.button>

            {/* Text input */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); }
                }}
                placeholder="Type a message…"
                rows={1}
                className="w-full resize-none max-h-32 px-4 py-2.5 bg-canvas border border-line rounded-3xl text-sm text-ink placeholder:text-slate-400 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100 transition-all font-plex leading-relaxed"
                style={{ minHeight: "40px" }}
                data-testid="chat-input"
              />
            </div>

            {/* Send button */}
            <AnimatePresence mode="wait">
              <motion.button
                key={text.trim() ? "active" : "inactive"}
                type="submit"
                disabled={sending || !text.trim()}
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1, opacity: text.trim() ? 1 : 0.5 }}
                whileTap={text.trim() ? { scale: 0.88 } : undefined}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                className="shrink-0 w-10 h-10 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-glow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                data-testid="chat-send"
              >
                <PaperPlaneRight size={18} weight="fill" />
              </motion.button>
            </AnimatePresence>
          </form>
        )}
      </div>

      {/* ── Report modal ── */}
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report conversation" testid="chat-report-modal">
        <div className="flex items-start gap-3 p-3.5 bg-red-50 rounded-2xl border border-red-100 mb-4">
          <ShieldWarning size={20} weight="fill" className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 leading-relaxed">
            Report harassment, fraud, or policy violations. Our team will review the encrypted transcript.
          </p>
        </div>
        <Textarea
          label="Description (optional)"
          rows={3}
          placeholder="Describe what happened..."
          value={reportDesc}
          onChange={(e) => setReportDesc(e.target.value)}
          data-testid="chat-report-desc"
        />
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => setReportOpen(false)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={submitReport} data-testid="chat-report-submit">
            <Flag size={15} weight="bold" /> Submit report
          </Button>
        </div>
      </Modal>
    </div>
  );
}
