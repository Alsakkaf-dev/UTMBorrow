import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { X, CheckCircle, WarningCircle, ArrowClockwise, Keyboard } from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { Button, Spinner } from "../../components/ui";
import RatingDialog from "../../components/RatingDialog";

// Camera capture needs a secure context. localhost is exempt; a plain-HTTP
// LAN address (e.g. http://192.168.x.x:3000 used when testing on two phones)
// is NOT — getUserMedia silently returns nothing, which looks like "the
// camera sees but never captures". We detect this up front.
function isCameraContextOk() {
  if (window.isSecureContext) return true;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export default function Scanner() {
  const { txId } = useParams();
  const [params] = useSearchParams();
  const purpose = params.get("purpose") === "Return" ? "Return" : "Handover";
  const navigate = useNavigate();

  const scannerRef = useRef(null);
  const lockRef = useRef(false);
  const [phase, setPhase] = useState("scanning"); // scanning | verifying | success | error | camera_error
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [rateOpen, setRateOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    if (s) {
      try {
        if (s.getState && s.getState() === 2) await s.stop();
        await s.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
  }, []);

  const handleDecoded = useCallback(async (text) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setPhase("verifying");
    await stopScanner();
    try {
      const { data } = await api.post("/scan", { qr_string: text, purpose, device_info: navigator.userAgent });
      setResult(data.scan_result);
      setMessage(data.message);
      if (data.success) {
        setPhase("success");
        if (data.transaction) setCounterparty(data.transaction.borrower?.full_name || "the borrower");
        if (purpose === "Return") setTimeout(() => setRateOpen(true), 900);
      } else {
        setPhase("error");
      }
    } catch (e) {
      setResult("Error");
      setMessage(formatApiError(e.response?.data?.detail) || "Scan failed. Try again.");
      setPhase("error");
    }
  }, [purpose, stopScanner]);

  const startScanner = useCallback(async () => {
    lockRef.current = false;
    setManualOpen(false);
    setResult(null);

    if (!isCameraContextOk()) {
      setMessage("Camera access needs a secure (HTTPS) connection. Open the app over HTTPS or on localhost — or paste the code manually below to confirm.");
      setPhase("camera_error");
      return;
    }
    setPhase("scanning");

    // Decode config:
    //  • useBarCodeDetectorIfSupported → use the browser's NATIVE barcode
    //    decoder (Chrome/Android) which reads dense QR codes far more reliably
    //    than the JS fallback that was silently failing here.
    //  • qrbox as a large responsive square (~88% of the smaller viewfinder
    //    edge) so a screen-filling QR actually FITS the decode region — a fixed
    //    240px box was smaller than the on-screen QR, so it never matched.
    const qrboxFn = (vfW, vfH) => {
      const edge = Math.max(180, Math.floor(Math.min(vfW, vfH) * 0.88));
      return { width: edge, height: edge };
    };
    const config = {
      fps: 15,
      qrbox: qrboxFn,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    };
    const tryStart = async (cameraConfig) => {
      await stopScanner();
      const scanner = new Html5Qrcode("qr-reader", {
        verbose: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
      scannerRef.current = scanner;
      await scanner.start(cameraConfig, config, handleDecoded, () => {});
    };

    try {
      // Prefer an explicit back/rear camera (more reliable than facingMode on
      // many devices); fall back to facingMode, then to any default camera.
      let cams = [];
      try { cams = await Html5Qrcode.getCameras(); } catch { /* permission/enumeration */ }
      if (cams && cams.length) {
        const back = cams.find((c) => /back|rear|environment/i.test(c.label || "")) || cams[cams.length - 1];
        try { await tryStart({ deviceId: { exact: back.id } }); return; }
        catch { /* fall through */ }
      }
      try { await tryStart({ facingMode: "environment" }); return; }
      catch { await tryStart({ facingMode: "user" }); }
    } catch (e) {
      setMessage("Camera permission denied or unavailable. Please enable camera access in your browser settings, or paste the code manually below.");
      setPhase("camera_error");
      api.post("/scan/camera-error").catch(() => {});
    }
  }, [handleDecoded, stopScanner]);

  useEffect(() => {
    startScanner();
    return () => { stopScanner(); };
  }, [startScanner, stopScanner]);

  const retry = async () => { await stopScanner(); startScanner(); };
  const done = async () => { await stopScanner(); navigate(`/transactions/${txId}`); };
  const submitManual = async () => {
    const text = manualText.trim();
    if (!text) return;
    await stopScanner();
    handleDecoded(text);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black">
      {/* Camera mount */}
      <div id="qr-reader" className="absolute inset-0 w-full h-full" data-testid="qr-reader" />

      {/* Scrim + target frame */}
      {phase === "scanning" && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-black/45" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 calc(50% - 42vw), 100% calc(50% - 42vw), 100% calc(50% + 42vw), 0 calc(50% + 42vw))" }} />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[84vw] h-[84vw] max-w-[420px] max-h-[420px]">
            <div className="absolute -top-px -left-px w-8 h-8 border-t-4 border-l-4 border-white rounded-tl" />
            <div className="absolute -top-px -right-px w-8 h-8 border-t-4 border-r-4 border-white rounded-tr" />
            <div className="absolute -bottom-px -left-px w-8 h-8 border-b-4 border-l-4 border-white rounded-bl" />
            <div className="absolute -bottom-px -right-px w-8 h-8 border-b-4 border-r-4 border-white rounded-br" />
            <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 animate-scan-line shadow-[0_0_12px_2px_rgba(16,185,129,0.6)]" />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 p-5 flex items-center justify-between text-white z-10">
        <button onClick={done} className="p-2 bg-white/15 rounded-full backdrop-blur" data-testid="scanner-close"><X size={22} /></button>
        <span className="font-head font-semibold text-sm bg-white/15 px-3 py-1.5 rounded-full backdrop-blur">{purpose} scan</span>
        <span className="w-9" />
      </div>

      {phase === "scanning" && (
        <div className="absolute bottom-10 inset-x-0 flex flex-col items-center gap-3 px-8 z-10">
          <p className="text-center text-white/90 text-sm" data-testid="scanner-hint">Point the camera at the borrower's QR code</p>
          <button
            onClick={() => setManualOpen(true)}
            className="flex items-center gap-2 text-white/90 text-xs font-semibold bg-white/15 px-4 py-2 rounded-full backdrop-blur hover:bg-white/25 transition-colors"
            data-testid="scanner-manual-open"
          >
            <Keyboard size={16} weight="bold" /> Enter code manually
          </button>
        </div>
      )}

      {/* Manual entry fallback — guarantees the handover/return can complete
          even when the camera can't decode (desktop, low light, HTTP/LAN). */}
      {manualOpen && phase !== "success" && phase !== "verifying" && (
        <div className="absolute inset-0 z-20 bg-ink/90 backdrop-blur flex flex-col items-center justify-center p-7 text-center text-white" data-testid="scanner-manual">
          <Keyboard size={56} weight="duotone" />
          <h2 className="font-head font-bold text-xl mt-3">Enter the code manually</h2>
          <p className="text-white/80 text-sm mt-2 max-w-xs">Ask the borrower to tap “Can’t scan? Show code” and read or share the code that starts with <span className="font-mono">UTMB.</span></p>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="UTMB.…"
            rows={3}
            className="mt-4 w-full max-w-sm rounded-2xl bg-white/10 border border-white/25 p-3 text-white text-sm font-mono placeholder-white/40 focus:outline-none focus:border-white/60"
            data-testid="scanner-manual-input"
          />
          <div className="flex flex-col gap-3 mt-5 w-full max-w-sm">
            <Button className="w-full" onClick={submitManual} disabled={!manualText.trim()} data-testid="scanner-manual-submit">
              Confirm {purpose}
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setManualOpen(false)}>Back to camera</Button>
          </div>
        </div>
      )}

      {phase === "verifying" && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white" data-testid="scanner-verifying">
          <Spinner className="w-8 h-8 border-white/30 border-t-white" />
          <p className="mt-4 text-sm">Verifying signature…</p>
        </div>
      )}

      {phase === "success" && (
        <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center text-white p-8 text-center animate-pop-in" data-testid="scanner-success">
          <CheckCircle size={84} weight="fill" />
          <h2 className="font-head font-bold text-2xl mt-4">{purpose} confirmed</h2>
          <p className="text-white/90 mt-2">{message}</p>
          <Button variant="secondary" className="mt-8 w-full max-w-xs" onClick={done} data-testid="scanner-success-done">Done</Button>
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center text-white p-8 text-center animate-pop-in" data-testid="scanner-error">
          <WarningCircle size={84} weight="fill" />
          <h2 className="font-head font-bold text-2xl mt-4">Scan failed</h2>
          {result && <span className="text-xs uppercase tracking-widest bg-white/20 px-2 py-1 rounded mt-2" data-testid="scanner-error-code">{result.replace(/_/g, " ")}</span>}
          <p className="text-white/90 mt-3">{message}</p>
          <div className="flex flex-col gap-3 mt-8 w-full max-w-xs">
            <Button className="w-full" onClick={retry} data-testid="scanner-retry"><ArrowClockwise size={18} /> Scan again</Button>
            <Button variant="secondary" className="w-full" onClick={done}>Back</Button>
          </div>
        </div>
      )}

      {phase === "camera_error" && (
        <div className="absolute inset-0 bg-ink flex flex-col items-center justify-center text-white p-8 text-center" data-testid="scanner-camera-error">
          <WarningCircle size={84} weight="fill" />
          <h2 className="font-head font-bold text-2xl mt-4">Camera blocked</h2>
          <p className="text-white/80 mt-3">{message}</p>
          <div className="flex flex-col gap-3 mt-8 w-full max-w-xs">
            <Button className="w-full" onClick={retry} data-testid="camera-retry">Try again</Button>
            <Button variant="secondary" className="w-full" onClick={() => setManualOpen(true)} data-testid="camera-manual"><Keyboard size={18} weight="bold" /> Enter code manually</Button>
            <Button variant="ghost" className="w-full text-white/70" onClick={done}>Back</Button>
          </div>
        </div>
      )}

      <RatingDialog open={rateOpen} onClose={done} transactionId={txId} counterpartyName={counterparty} onRated={done} />
    </div>
  );
}
