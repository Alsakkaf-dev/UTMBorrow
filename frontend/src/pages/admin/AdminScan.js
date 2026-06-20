import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { QrCode, CheckCircle, WarningCircle, ArrowClockwise, Camera, Keyboard } from "@phosphor-icons/react";
import { adminApi, formatApiError } from "../../lib/api";
import { Button, Spinner } from "../../components/ui";

export default function AdminScan() {
  const [purpose, setPurpose] = useState("Handover");
  const [mode, setMode] = useState("camera"); // camera | manual
  const [phase, setPhase] = useState("idle"); // idle | scanning | verifying | success | error
  const [manual, setManual] = useState("");
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const scannerRef = useRef(null);
  const lockRef = useRef(false);
  const purposeRef = useRef(purpose);
  purposeRef.current = purpose;

  const stop = useCallback(async () => {
    const s = scannerRef.current;
    if (s) {
      try { if (s.getState && s.getState() === 2) await s.stop(); await s.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
  }, []);

  // Cleanup on unmount only.
  useEffect(() => () => { stop(); }, [stop]);

  const submit = useCallback(async (qr_string) => {
    setPhase("verifying");
    try {
      const { data } = await adminApi.post("/admin/scan", {
        qr_string, purpose: purposeRef.current, device_info: "Admin desk · " + navigator.userAgent,
      });
      setResult(data.scan_result);
      setMessage(data.message);
      setPhase(data.success ? "success" : "error");
    } catch (e) {
      setResult("Error");
      setMessage(formatApiError(e.response?.data?.detail) || "Scan failed.");
      setPhase("error");
    }
  }, []);

  const onDecoded = useCallback(async (text) => {
    if (lockRef.current) return;
    lockRef.current = true;
    await stop();
    submit(text);
  }, [stop, submit]);

  const startCamera = useCallback(async () => {
    lockRef.current = false;
    setResult(null);
    setMessage("");
    setPhase("scanning");
    try {
      const scanner = new Html5Qrcode("admin-qr-reader", { verbose: false });
      scannerRef.current = scanner;
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 230, height: 230 } }, onDecoded, () => {});
    } catch {
      setMessage("Camera unavailable. Use manual entry instead.");
      setPhase("error");
    }
  }, [onDecoded]);

  const reset = async () => {
    await stop();
    setPhase("idle");
    setResult(null);
    setMessage("");
    setManual("");
    lockRef.current = false;
  };

  return (
    <div>
      <p className="label-eyebrow">Asset desk</p>
      <h1 className="font-head font-extrabold text-3xl tracking-tight mb-1">Scan check-out / check-in</h1>
      <p className="text-sm text-muted mb-5">Scan a borrower's transaction QR to action a handover or return on the spot. Same cryptographic check as the lender; fully audited.</p>

      {/* Purpose toggle */}
      <div className="flex bg-surface border border-line rounded-full p-1 mb-3 shadow-soft">
        {["Handover", "Return"].map((p) => (
          <button key={p} onClick={() => setPurpose(p)} data-testid={`admin-scan-purpose-${p}`} className="relative flex-1 py-2.5 rounded-full text-sm font-semibold">
            {purpose === p && <motion.span layoutId="admin-scan-purpose" transition={{ type: "spring", stiffness: 400, damping: 32 }} className="absolute inset-0 bg-brand-gradient rounded-full shadow-glow-sm" />}
            <span className={`relative z-10 ${purpose === p ? "text-white" : "text-muted"}`}>{p === "Handover" ? "Check-out (Handover)" : "Check-in (Return)"}</span>
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => { setMode("camera"); reset(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl text-sm font-semibold border transition-colors ${mode === "camera" ? "bg-brand-50 border-brand-200 text-brand-700" : "bg-surface border-line text-muted"}`} data-testid="admin-scan-mode-camera"><Camera size={16} weight="bold" /> Camera</button>
        <button onClick={() => { setMode("manual"); reset(); }} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl text-sm font-semibold border transition-colors ${mode === "manual" ? "bg-brand-50 border-brand-200 text-brand-700" : "bg-surface border-line text-muted"}`} data-testid="admin-scan-mode-manual"><Keyboard size={16} weight="bold" /> Manual</button>
      </div>

      {/* Result states */}
      {phase === "success" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-center" data-testid="admin-scan-success">
          <CheckCircle size={56} weight="fill" className="text-emerald-600 mx-auto" />
          <h2 className="font-head font-bold text-xl mt-3 text-emerald-800">{purpose} confirmed</h2>
          <p className="text-sm text-emerald-700 mt-1">{message}</p>
          <Button className="mt-5" onClick={reset} data-testid="admin-scan-again">Scan another</Button>
        </div>
      )}

      {phase === "error" && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center" data-testid="admin-scan-error">
          <WarningCircle size={56} weight="fill" className="text-rose-600 mx-auto" />
          <h2 className="font-head font-bold text-xl mt-3 text-rose-800">Scan failed</h2>
          {result && result !== "Error" && <span className="text-xs uppercase tracking-widest bg-rose-100 text-rose-700 px-2 py-1 rounded mt-2 inline-block">{result.replace(/_/g, " ")}</span>}
          <p className="text-sm text-rose-700 mt-2">{message}</p>
          <Button className="mt-5" onClick={reset} data-testid="admin-scan-retry"><ArrowClockwise size={16} /> Try again</Button>
        </div>
      )}

      {phase === "verifying" && (
        <div className="flex flex-col items-center py-12"><Spinner className="w-8 h-8" /><p className="mt-3 text-sm text-muted">Verifying signature…</p></div>
      )}

      {(phase === "idle" || phase === "scanning") && mode === "camera" && (
        <div>
          <div id="admin-qr-reader" className="w-full aspect-square rounded-3xl overflow-hidden bg-ink/90 border border-line" data-testid="admin-qr-reader" />
          {phase === "idle" ? (
            <Button size="lg" className="w-full mt-4" onClick={startCamera} data-testid="admin-scan-start"><QrCode size={18} weight="bold" /> Start camera</Button>
          ) : (
            <p className="text-center text-sm text-muted mt-4">Point at the borrower's QR…</p>
          )}
        </div>
      )}

      {(phase === "idle") && mode === "manual" && (
        <div className="bg-surface border border-line rounded-3xl p-4 shadow-card">
          <label className="block">
            <span className="label-eyebrow block mb-1.5">Paste QR string (UTMB.…)</span>
            <textarea value={manual} onChange={(e) => setManual(e.target.value)} rows={3} placeholder="UTMB.xxxxx.yyyyy" data-testid="admin-scan-manual-input" className="w-full px-4 py-3 bg-surface border border-line rounded-2xl text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100 font-mono text-xs resize-none" />
          </label>
          <Button size="lg" className="w-full mt-4" disabled={!manual.trim().startsWith("UTMB.")} onClick={() => submit(manual.trim())} data-testid="admin-scan-manual-submit">Verify &amp; action</Button>
        </div>
      )}
    </div>
  );
}
