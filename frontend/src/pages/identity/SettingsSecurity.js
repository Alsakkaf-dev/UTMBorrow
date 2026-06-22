import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ArrowLeft, EnvelopeSimple, Lock, ShieldCheck, SealCheck,
    Desktop, DeviceMobile, SignOut, Trash, Warning,
    QrCode, CheckCircle,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { Button, Input, Modal } from "../../components/ui";
import { toast } from "../../components/Toast";
import { api, formatApiError } from "../../lib/api";

function Toggle({ checked, onChange, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
                checked ? "bg-brand-500" : "bg-slate-200"
            }`}
        >
            <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-soft ${
                    checked ? "left-[22px]" : "left-0.5"
                }`}
            />
        </button>
    );
}

function deviceIcon(info) {
    const s = (info || "").toLowerCase();
    if (s.includes("iphone") || s.includes("android") || s.includes("mobile")) return DeviceMobile;
    return Desktop;
}

function relativeTime(iso) {
    if (!iso) return "";
    try {
        const diff = (Date.now() - new Date(iso)) / 1000;
        if (diff < 60) return "Active now";
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    } catch { return ""; }
}

const SUPPORT_EMAIL = "support@utmborrow.app";

export default function SettingsSecurity() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Password change
    const [pwOpen, setPwOpen] = useState(false);
    const [curPw, setCurPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [pwBusy, setPwBusy] = useState(false);
    const [pwErr, setPwErr] = useState("");

    // 2FA
    const [mfaEnabled, setMfaEnabled] = useState(false);
    const [mfaOpen, setMfaOpen] = useState(false);
    const [mfaSetup, setMfaSetup] = useState(null); // {secret, provisioning_uri}
    const [mfaCode, setMfaCode] = useState("");
    const [mfaBusy, setMfaBusy] = useState(false);
    const [mfaErr, setMfaErr] = useState("");

    // Sessions
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(true);
    const [revoking, setRevoking] = useState(null);

    // Delete account
    const [deleteOpen, setDeleteOpen] = useState(false);

    const loadSecurity = useCallback(async () => {
        setSessionsLoading(true);
        try {
            const [sessRes, mfaRes] = await Promise.all([
                api.get("/auth/sessions"),
                api.get("/auth/2fa/status"),
            ]);
            setSessions(sessRes.data.sessions || []);
            setMfaEnabled(mfaRes.data.mfa_enabled);
        } catch (err) {
            console.error("Failed to load security data:", err);
        } finally {
            setSessionsLoading(false);
        }
    }, []);

    useEffect(() => { loadSecurity(); }, [loadSecurity]);

    // ── Password change ──
    const handleChangePassword = async () => {
        setPwErr("");
        if (newPw.length < 6) { setPwErr("New password must be at least 6 characters."); return; }
        setPwBusy(true);
        try {
            await api.post("/auth/change-password", { current_password: curPw, new_password: newPw });
            toast.success("Password updated successfully.");
            setPwOpen(false);
            setCurPw(""); setNewPw("");
        } catch (err) {
            setPwErr(formatApiError(err.response?.data?.detail) || "Failed to update password.");
        } finally {
            setPwBusy(false);
        }
    };

    // ── 2FA toggle ──
    const handle2FaToggle = async () => {
        if (mfaEnabled) {
            // Disable flow — prompt for code
            setMfaSetup(null);
            setMfaCode("");
            setMfaErr("");
            setMfaOpen(true);
        } else {
            // Enable flow — fetch setup QR
            setMfaBusy(true);
            try {
                const { data } = await api.post("/auth/2fa/setup");
                setMfaSetup(data);
                setMfaCode("");
                setMfaErr("");
                setMfaOpen(true);
            } catch (err) {
                toast.error(formatApiError(err.response?.data?.detail) || "Could not start 2FA setup.");
            } finally {
                setMfaBusy(false);
            }
        }
    };

    const confirmMfa = async () => {
        setMfaErr("");
        if (mfaCode.length !== 6) { setMfaErr("Enter the 6-digit code from your authenticator."); return; }
        setMfaBusy(true);
        try {
            if (mfaEnabled) {
                await api.post("/auth/2fa/disable", { code: mfaCode });
                toast.success("Two-factor authentication disabled.");
            } else {
                await api.post("/auth/2fa/verify-enable", { code: mfaCode, secret: mfaSetup?.secret });
                toast.success("Two-factor authentication enabled!");
            }
            setMfaEnabled(!mfaEnabled);
            setMfaOpen(false);
            setMfaCode("");
            setMfaSetup(null);
        } catch (err) {
            setMfaErr(formatApiError(err.response?.data?.detail) || "Invalid code. Try again.");
        } finally {
            setMfaBusy(false);
        }
    };

    // ── Sessions ──
    const revokeSession = async (sessionId) => {
        setRevoking(sessionId);
        try {
            await api.delete(`/auth/sessions/${sessionId}`);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            toast.success("Session revoked.");
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Failed to revoke session.");
        } finally {
            setRevoking(null);
        }
    };

    const revokeOthers = async () => {
        try {
            await api.post("/auth/sessions/revoke-others");
            toast.success("All other sessions signed out.");
            await loadSecurity();
        } catch (err) {
            toast.error(formatApiError(err.response?.data?.detail) || "Failed.");
        }
    };

    const handleSignOut = async () => {
        await logout();
        toast.success("Signed out.");
        navigate("/login");
    };

    const requestAccountDeletion = () => {
        const subject = encodeURIComponent("Account deletion request");
        const body = encodeURIComponent(`Please delete my UTM Borrow account and associated data.\n\nAccount: ${user.email}`);
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
        setDeleteOpen(false);
    };

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <button
                type="button"
                onClick={() => navigate("/settings")}
                className="flex items-center gap-1.5 text-muted text-sm mb-4 font-medium hover:text-ink transition-colors"
                data-testid="back-to-settings"
            >
                <ArrowLeft size={16} weight="bold" /> Back to settings
            </button>

            <h1 className="font-head font-extrabold text-3xl tracking-tight mb-5">Account & Security</h1>

            {/* Credentials */}
            <div className="bg-surface border border-line rounded-3xl shadow-card divide-y divide-line overflow-hidden mb-5">
                <div className="flex items-center gap-3.5 p-4">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                        <EnvelopeSimple size={20} weight="fill" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="label-eyebrow">Email</p>
                        <p className="text-sm font-medium text-ink truncate mt-0.5">{user.email}</p>
                    </div>
                    <span
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1 shrink-0"
                        title="Your UTM email is your verified identity and can't be changed"
                        data-testid="email-verified-chip"
                    >
            <SealCheck size={13} weight="fill" /> UTM-verified
          </span>
                </div>

                <div className="flex items-center gap-3.5 p-4">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                        <Lock size={20} weight="fill" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="label-eyebrow">Password</p>
                        <p className="text-sm font-medium text-ink mt-0.5">••••••••</p>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => { setPwOpen(true); setCurPw(""); setNewPw(""); setPwErr(""); }}
                        data-testid="change-password-btn"
                    >
                        Change
                    </Button>
                </div>

                <div className="flex items-center gap-3.5 p-4">
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                        <ShieldCheck size={20} weight="fill" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="label-eyebrow">Two-factor authentication</p>
                        <p className="text-xs text-muted mt-0.5">
                            {mfaEnabled ? "Enabled — your account is protected by TOTP" : "Add an extra layer of security"}
                        </p>
                    </div>
                    {mfaBusy
                        ? <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                        : <Toggle checked={mfaEnabled} onChange={handle2FaToggle} label="Two-factor authentication" />}
                </div>
            </div>

            {/* Active sessions */}
            <h2 className="font-head font-bold text-lg mb-3">Active sessions</h2>
            <div className="bg-surface border border-line rounded-3xl shadow-card divide-y divide-line overflow-hidden mb-4">
                {sessionsLoading ? (
                    <div className="p-5 text-center text-xs text-muted">Loading sessions…</div>
                ) : sessions.length === 0 ? (
                    <div className="p-5 text-center text-xs text-muted">No active sessions found.</div>
                ) : (
                    sessions.map(s => {
                        const Icon = deviceIcon(s.device_info);
                        return (
                            <div key={s.id} className="flex items-center gap-3.5 p-4" data-testid={`session-${s.id}`}>
                                <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                    <Icon size={20} weight="fill" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-ink truncate">{s.device_info || "Unknown device"}</p>
                                    <p className="text-xs text-muted mt-0.5">
                                        {relativeTime(s.last_seen_at)}
                                        {s.is_current && <span className="ml-1.5 text-brand-600 font-semibold">· This device</span>}
                                    </p>
                                </div>
                                {!s.is_current && (
                                    <button
                                        onClick={() => revokeSession(s.id)}
                                        disabled={revoking === s.id}
                                        className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
                                        data-testid={`revoke-session-${s.id}`}
                                    >
                                        {revoking === s.id ? "Revoking…" : "Revoke"}
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <div className="flex gap-3 mb-8">
                <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={revokeOthers}
                    data-testid="revoke-others-btn"
                >
                    Sign out all other devices
                </Button>
                <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={handleSignOut}
                    data-testid="sign-out-all-btn"
                >
                    <SignOut size={16} weight="bold" /> Sign out
                </Button>
            </div>

            {/* Danger zone */}
            <div className="border border-red-200 bg-red-50/50 rounded-3xl p-5">
                <p className="label-eyebrow !text-red-600">Danger zone</p>
                <h3 className="font-head font-bold text-lg text-ink mt-1">Delete account</h3>
                <p className="text-sm text-muted mt-1 leading-relaxed">
                    Permanently remove your account and all associated data. This action cannot be undone.
                </p>
                <Button
                    variant="danger"
                    className="w-full mt-4"
                    onClick={() => setDeleteOpen(true)}
                    data-testid="delete-account-btn"
                >
                    <Trash size={16} weight="bold" /> Delete account
                </Button>
            </div>

            {/* ── Change Password modal ── */}
            <Modal open={pwOpen} onClose={() => setPwOpen(false)} title="Change password" testid="change-password-modal">
                <div className="space-y-3">
                    {pwErr && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5">
                            <Warning size={16} className="shrink-0 mt-0.5" weight="bold" /> {pwErr}
                        </div>
                    )}
                    <Input
                        label="Current password"
                        type="password"
                        value={curPw}
                        onChange={e => setCurPw(e.target.value)}
                        placeholder="Enter your current password"
                        data-testid="cur-password"
                    />
                    <Input
                        label="New password"
                        type="password"
                        value={newPw}
                        onChange={e => setNewPw(e.target.value)}
                        placeholder="At least 6 characters"
                        data-testid="new-password"
                    />
                </div>
                <div className="flex gap-3 mt-5">
                    <Button variant="secondary" className="flex-1" onClick={() => setPwOpen(false)}>Cancel</Button>
                    <Button
                        className="flex-1"
                        loading={pwBusy}
                        disabled={pwBusy || !curPw || !newPw}
                        onClick={handleChangePassword}
                        data-testid="save-password-btn"
                    >
                        Update password
                    </Button>
                </div>
            </Modal>

            {/* ── 2FA setup / disable modal ── */}
            <Modal
                open={mfaOpen}
                onClose={() => { setMfaOpen(false); setMfaCode(""); setMfaErr(""); }}
                title={mfaEnabled ? "Disable 2FA" : "Set up two-factor authentication"}
                testid="mfa-modal"
            >
                {mfaSetup && !mfaEnabled && (
                    <div className="mb-4">
                        <p className="text-sm text-muted mb-3 leading-relaxed">
                            Scan this QR code in your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code below.
                        </p>
                        <div className="flex justify-center bg-white border border-line rounded-2xl p-4 mb-3">
                            <div className="flex items-center gap-2 text-xs text-muted">
                                <QrCode size={40} className="text-brand-400" weight="duotone" />
                                <div>
                                    <p className="font-semibold text-ink text-sm">Scan in your app</p>
                                    <p className="break-all font-mono text-[10px] mt-1 max-w-[220px]">{mfaSetup.secret}</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-muted text-center">
                            Or manually enter the secret key above into your authenticator app.
                        </p>
                    </div>
                )}
                {!mfaSetup && mfaEnabled && (
                    <p className="text-sm text-muted mb-4 leading-relaxed">
                        Enter the current 6-digit code from your authenticator app to confirm you want to disable 2FA.
                    </p>
                )}
                {mfaErr && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mb-3">
                        <Warning size={16} className="shrink-0 mt-0.5" weight="bold" /> {mfaErr}
                    </div>
                )}
                <Input
                    label="6-digit code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    data-testid="mfa-code-input"
                />
                <div className="flex gap-3 mt-5">
                    <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => { setMfaOpen(false); setMfaCode(""); setMfaErr(""); }}
                    >
                        Cancel
                    </Button>
                    <Button
                        className="flex-1"
                        variant={mfaEnabled ? "danger" : "primary"}
                        loading={mfaBusy}
                        disabled={mfaBusy || mfaCode.length !== 6}
                        onClick={confirmMfa}
                        data-testid="mfa-confirm-btn"
                    >
                        {mfaEnabled ? "Disable 2FA" : <><CheckCircle size={15} weight="bold" /> Enable 2FA</>}
                    </Button>
                </div>
            </Modal>

            {/* ── Delete account modal ── */}
            <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account" testid="delete-account-modal">
                <p className="text-sm text-muted leading-relaxed">
                    To protect against accidental loss, account deletions are handled by our team. We'll open a
                    pre-filled email to <span className="font-semibold text-ink">{SUPPORT_EMAIL}</span>; send it and
                    we'll permanently remove your account within 48 hours.
                </p>
                <div className="flex gap-3 mt-5">
                    <Button variant="secondary" className="flex-1" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                    <Button variant="danger" className="flex-1" onClick={requestAccountDeletion} data-testid="delete-account-confirm">
                        <Trash size={15} weight="bold" /> Request deletion
                    </Button>
                </div>
            </Modal>
        </motion.div>
    );
}