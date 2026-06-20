import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck, LockKey, ArrowLeft, Key } from "@phosphor-icons/react";
import { api, formatApiError, setAdminToken } from "../../lib/api";
import { Button, Spinner } from "../../components/ui";

// Secure step-up gateway: an admin must pass a TOTP second factor before the
// portal unlocks. First-time admins see a QR to enrol an authenticator app.
export default function AdminElevate({ onElevated }) {
  const navigate = useNavigate();
  const [enrol, setEnrol] = useState(null); // { enrolled, otpauth_uri, dev_code }
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    api.post("/admin/auth/elevate/start")
      .then(({ data }) => setEnrol(data))
      .catch((e) => setErr(formatApiError(e.response?.data?.detail) || "Could not start verification."));
  }, []);

  useEffect(() => { if (enrol) inputRef.current?.focus(); }, [enrol]);

  const verify = async (e) => {
    e.preventDefault();
    if (code.trim().length < 6) { setErr("Enter the 6-digit code."); return; }
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/admin/auth/elevate", { code: code.trim() });
      setAdminToken(data.admin_token);
      onElevated && onElevated(data);
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail) || "Verification failed.");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-5 py-10 max-w-md mx-auto">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: [0.22, 1, 0.36, 1], duration: 0.5 }}>
        <div className="flex flex-col items-center mb-7 text-center">
          <div className="w-16 h-16 bg-ink rounded-3xl flex items-center justify-center shadow-pop mb-4">
            <ShieldCheck size={32} weight="fill" className="text-white" />
          </div>
          <h1 className="font-head font-extrabold text-3xl tracking-tight">Admin secure gateway</h1>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            This area handles sensitive community data and university assets. Verify with your authenticator to continue.
          </p>
        </div>

        {!enrol && !err && (
          <div className="flex justify-center py-10"><Spinner className="w-7 h-7" /></div>
        )}

        {enrol && (
          <div className="bg-surface border border-line rounded-4xl p-6 shadow-card" data-testid="admin-elevate-card">
            {!enrol.enrolled && enrol.otpauth_uri && (
              <div className="text-center mb-5">
                <p className="label-eyebrow mb-3">Step 1 · Scan to enrol an authenticator</p>
                <div className="bg-white p-4 rounded-3xl inline-block border-2 border-brand-100 shadow-glow-sm">
                  <QRCodeSVG value={enrol.otpauth_uri} size={168} level="M" includeMargin />
                </div>
                <p className="text-xs text-muted mt-3">Google Authenticator, Authy, 1Password, etc.</p>
              </div>
            )}

            {enrol.dev_code && (
              <div className="mb-4 bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center" data-testid="admin-dev-code">
                <p className="label-eyebrow !text-amber-700 mb-1 flex items-center justify-center gap-1"><Key size={12} weight="fill" /> Dev code (testing only)</p>
                <p className="font-mono font-bold text-2xl tracking-[0.3em] text-amber-800">{enrol.dev_code}</p>
              </div>
            )}

            <form onSubmit={verify} className="space-y-4" data-testid="admin-elevate-form">
              {err && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5" data-testid="admin-elevate-error">{err}</div>}
              <label className="block">
                <span className="label-eyebrow block mb-1.5">{enrol.enrolled ? "Authentication code" : "Step 2 · Enter the 6-digit code"}</span>
                <input
                  ref={inputRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  data-testid="admin-elevate-code"
                  className="w-full text-center font-mono text-3xl tracking-[0.4em] px-4 py-3 bg-surface border border-line rounded-2xl outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                />
              </label>
              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={busy} data-testid="admin-elevate-submit">
                <LockKey size={18} weight="bold" /> Unlock admin portal
              </Button>
            </form>
          </div>
        )}

        {err && !enrol && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mt-4" data-testid="admin-elevate-error">{err}</div>
        )}

        <button onClick={() => navigate("/catalog")} className="mt-6 mx-auto flex items-center gap-1.5 text-muted text-sm font-medium hover:text-ink transition-colors" data-testid="admin-exit">
          <ArrowLeft size={15} weight="bold" /> Back to app
        </button>
      </motion.div>
    </div>
  );
}
