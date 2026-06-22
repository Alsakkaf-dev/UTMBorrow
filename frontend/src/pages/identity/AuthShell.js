import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function AuthShell({ title, subtitle, children, mode = "login" }) {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            {/* Gradient header */}
            <div className="relative overflow-hidden bg-animated-brand animate-gradient-pan text-white px-6 pt-14 pb-24 rounded-b-[2.5rem] shadow-glow">
                <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute top-20 -left-12 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
                <div className="relative max-w-md mx-auto">
                    <div className="flex items-center gap-2.5 mb-8">
            <span className="w-10 h-10 bg-white/95 rounded-2xl flex items-center justify-center text-brand-600 font-head font-extrabold text-lg shadow-soft">
              U
            </span>
                        <span className="font-head font-extrabold text-xl tracking-tight">UTM Borrow</span>
                    </div>
                    <motion.h1
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="font-head font-extrabold text-[34px] leading-tight tracking-tight"
                    >
                        {title}
                    </motion.h1>
                    {subtitle && (
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="text-white/85 mt-2.5 text-sm leading-relaxed max-w-xs"
                        >
                            {subtitle}
                        </motion.p>
                    )}
                </div>
            </div>

            {/* Card */}
            <div className="flex-1 px-5 -mt-10 relative z-10 pb-10">
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ease: [0.22, 1, 0.36, 1] }}
                    className="max-w-md mx-auto bg-surface border border-line rounded-4xl shadow-pop"
                >
                    {/* Tab switcher */}
                    <div className="px-5 pt-5">
                        <div className="flex bg-slate-100 rounded-full p-1">
                            <Link
                                to="/login"
                                className={`flex-1 text-center py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                                    mode === "login"
                                        ? "bg-white text-ink shadow-soft"
                                        : "text-muted hover:text-ink"
                                }`}
                            >
                                Log In
                            </Link>
                            <Link
                                to="/register"
                                className={`flex-1 text-center py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                                    mode === "register"
                                        ? "bg-white text-ink shadow-soft"
                                        : "text-muted hover:text-ink"
                                }`}
                            >
                                Sign Up
                            </Link>
                        </div>
                    </div>

                    {/* Slot for form + footer */}
                    <div className="px-5 pt-5 pb-6">{children}</div>
                </motion.div>
            </div>
        </div>
    );
}