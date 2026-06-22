import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Envelope,
    Lock,
    Eye,
    EyeSlash,
    User,
    IdentificationCard,
    CaretDoubleRight,
    GoogleLogo,
    AppleLogo,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import AuthShell from "./AuthShell";
import { Input, Spinner } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { formatApiError } from "../../lib/api";

const FIELD =
    "w-full py-3 bg-surface border border-line rounded-2xl text-ink placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 font-plex";

function PasswordField({ label, value, onChange, placeholder, required, "data-testid": testid }) {
    const [show, setShow] = useState(false);
    return (
        <label className="block">
            <span className="label-eyebrow block mb-1.5">{label}</span>
            <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Lock size={17} />
        </span>
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    data-testid={testid}
                    className={`${FIELD} pl-11 pr-11`}
                />
                <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink transition-colors"
                >
                    {show ? <EyeSlash size={17} /> : <Eye size={17} />}
                </button>
            </div>
        </label>
    );
}

export default function Register() {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [form, setForm] = useState({
        full_name: "",
        matric_no: "",
        email: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await register({ ...form, email: form.email.trim().toLowerCase() });
            navigate("/home", { replace: true });
        } catch (err) {
            setError(formatApiError(err.response?.data?.detail) || err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthShell
            title="Create Account"
            subtitle="Register with your UTM email to start lending and borrowing on campus."
            mode="register"
        >
            {error && (
                <div
                    className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mb-4"
                    data-testid="register-error"
                >
                    {error}
                </div>
            )}

            <form onSubmit={submit} className="space-y-3.5" data-testid="register-form">
                <Input
                    label="Full Name"
                    value={form.full_name}
                    onChange={set("full_name")}
                    placeholder="Your full name"
                    required
                    data-testid="register-name"
                    icon={<User size={17} />}
                />

                <Input
                    label="Matric Number"
                    value={form.matric_no}
                    onChange={set("matric_no")}
                    placeholder="e.g. A23CS1234"
                    required
                    data-testid="register-matric"
                    icon={<IdentificationCard size={17} />}
                />

                <Input
                    label="UTM Email"
                    type="email"
                    placeholder="name@graduate.utm.my"
                    value={form.email}
                    onChange={set("email")}
                    required
                    data-testid="register-email"
                    icon={<Envelope size={17} />}
                />

                <PasswordField
                    label="Password"
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Min 6 characters"
                    required
                    data-testid="register-password"
                />

                {/* CTA button */}
                <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={loading ? undefined : { scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="w-full relative flex items-center bg-brand-gradient rounded-full h-[54px] px-2 shadow-glow disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    data-testid="register-submit"
                >
          <span className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 z-10">
            {loading ? (
                <Spinner className="w-4 h-4 !border-white/40 !border-t-white" />
            ) : (
                <CaretDoubleRight size={16} weight="bold" className="text-white" />
            )}
          </span>
                    <span className="absolute inset-0 flex items-center justify-center text-white font-semibold text-[15px] pointer-events-none">
            Create Account
          </span>
                </motion.button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-line" />
                <span className="text-xs text-muted font-medium whitespace-nowrap">Or continue with</span>
                <div className="flex-1 h-px bg-line" />
            </div>

            {/* Social buttons */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    className="flex items-center justify-center gap-2 border border-line rounded-2xl py-3 text-sm font-medium text-ink bg-surface hover:bg-slate-50 transition-colors"
                >
                    <GoogleLogo size={18} />
                    Google
                </button>
                <button
                    type="button"
                    className="flex items-center justify-center gap-2 border border-line rounded-2xl py-3 text-sm font-medium text-ink bg-surface hover:bg-slate-50 transition-colors"
                >
                    <AppleLogo size={18} weight="fill" />
                    Apple
                </button>
            </div>

            {/* Footer */}
            <p className="text-center text-sm text-muted mt-5">
                Already have an account?{" "}
                <Link
                    to="/login"
                    className="text-brand-600 font-semibold hover:text-brand-700"
                    data-testid="go-login"
                >
                    Sign in
                </Link>
            </p>
        </AuthShell>
    );
}