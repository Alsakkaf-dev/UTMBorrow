import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle } from "@phosphor-icons/react";
import AuthShell from "./AuthShell";
import { Button, Input } from "../../components/ui";
import { api, formatApiError } from "../../lib/api";

// Canonical reset-link target: a real recovery email points here as
// /reset?token=…. Also accepts a manually pasted token.
export default function ResetPassword() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [token, setToken] = useState(params.get("token") || "");
    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
        if (newPassword !== confirm) { setError("Passwords do not match."); return; }
        setLoading(true);
        try {
            await api.post("/auth/reset-password", { token: token.trim(), new_password: newPassword });
            setDone(true);
        } catch (err) {
            setError(formatApiError(err.response?.data?.detail) || err.message);
        } finally { setLoading(false); }
    };

    return (
        <AuthShell
            title="Set a new password"
            subtitle="Enter your recovery token and choose a new password."
            footer={<><Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700" data-testid="back-login">Back to sign in</Link></>}
        >
            {done ? (
                <div className="text-center py-6" data-testid="reset-success">
                    <div className="w-14 h-14 rounded-2xl bg-status-borrowed text-white flex items-center justify-center mx-auto mb-4"><CheckCircle size={30} weight="fill" /></div>
                    <p className="text-ink font-semibold">Password updated. You can now log in.</p>
                    <Button size="lg" className="mt-5 w-full" onClick={() => navigate("/login")} data-testid="reset-go-login">Go to sign in</Button>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-4" data-testid="reset-form">
                    {error && <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5" data-testid="reset-error">{error}</div>}
                    <Input label="Recovery token" placeholder="Paste your reset token" value={token} onChange={(e) => setToken(e.target.value)} required data-testid="reset-token" />
                    <Input label="New password" type="password" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required data-testid="reset-password" />
                    <Input label="Confirm password" type="password" placeholder="Repeat new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required data-testid="reset-confirm" />
                    <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading || !token} data-testid="reset-submit">Set new password</Button>
                </form>
            )}
        </AuthShell>
    );
}