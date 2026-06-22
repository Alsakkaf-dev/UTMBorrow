import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle } from "@phosphor-icons/react";
import AuthShell from "./AuthShell";
import { Button, Input } from "../../components/ui";
import { api, formatApiError } from "../../lib/api";

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState("");
    const [token, setToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const requestReset = async (e) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            const { data } = await api.post("/auth/forgot-password", { email });
            if (data.recovery_token) {
                // Dev / no-SMTP mode: continue the reset inline with the surfaced token.
                setMsg(data.message);
                setToken(data.recovery_token);
                setStep(2);
            } else {
                // A real recovery link was emailed (UC1103).
                setMsg("A recovery link has been sent to your email.");
                setStep(3);
            }
        } catch (err) {
            setError(formatApiError(err.response?.data?.detail) || err.message);
        } finally { setLoading(false); }
    };

    const doReset = async (e) => {
        e.preventDefault();
        setError(""); setLoading(true);
        try {
            const { data } = await api.post("/auth/reset-password", { token, new_password: newPassword });
            setMsg(data.message);
            setStep(3);
        } catch (err) {
            setError(formatApiError(err.response?.data?.detail) || err.message);
        } finally { setLoading(false); }
    };

    return (
        <AuthShell
            title="Reset password"
            subtitle="Enter your UTM email and we'll send you a secure, time-sensitive reset link."
            footer={<><Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700" data-testid="back-login">Back to sign in</Link></>}
        >
            {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mb-4" data-testid="forgot-error">{error}</div>}

            {step === 1 && (
                <form onSubmit={requestReset} className="space-y-4" data-testid="forgot-form">
                    <Input label="UTM Email" type="email" placeholder="name@graduate.utm.my" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="forgot-email" />
                    <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading} data-testid="forgot-submit">
                        Send recovery link
                    </Button>
                </form>
            )}

            {step === 2 && (
                <form onSubmit={doReset} className="space-y-4" data-testid="reset-form">
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5 text-sm">
                        <p className="label-eyebrow mb-1 !text-amber-700">Simulated email — your token</p>
                        <code className="break-all text-xs text-ink" data-testid="recovery-token">{token}</code>
                    </div>
                    <Input label="New Password" type="password" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required data-testid="reset-password" />
                    <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading} data-testid="reset-submit">
                        Set new password
                    </Button>
                </form>
            )}

            {step === 3 && (
                <div className="text-center py-6" data-testid="reset-success">
                    <div className="w-14 h-14 rounded-2xl bg-status-borrowed text-white flex items-center justify-center mx-auto mb-4"><CheckCircle size={30} weight="fill" /></div>
                    <p className="text-ink font-semibold">{msg}</p>
                    <Button size="lg" className="mt-5 w-full" onClick={() => navigate("/login")} data-testid="reset-go-login">Go to sign in</Button>
                </div>
            )}
        </AuthShell>
    );
}