import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck, CheckCircle, Lock, SignOut, EnvelopeSimple, DeviceMobile,
  Gavel, Scales, ClipboardText, WarningCircle, SealCheck,
} from "@phosphor-icons/react";
import { adminApi, formatApiError } from "../../lib/api";
import { Avatar, Card, Button, Spinner, EmptyState } from "../../components/ui";
import { toast } from "../../components/Toast";

function Toggle({ checked, onChange, testid }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      data-testid={testid}
      className={`relative w-12 h-7 rounded-full transition-colors duration-200 shrink-0 ${checked ? "bg-brand-gradient" : "bg-slate-200"}`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-soft ${checked ? "left-6" : "left-1"}`}
      />
    </button>
  );
}

function StatBox({ value, label, icon: Icon, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    red: "bg-red-50 text-status-cancelled",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <div className="bg-surface border border-line rounded-2xl p-3.5 flex flex-col gap-1">
      <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${tones[tone]}`}><Icon size={16} weight="bold" /></span>
      <span className="font-head font-extrabold text-2xl text-ink leading-none mt-1">{value}</span>
      <span className="text-[11px] text-muted leading-tight">{label}</span>
    </div>
  );
}

export default function AdminProfile() {
  const { lock, logout } = useOutletContext() || {};
  const [me, setMe] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const load = async () => {
    try {
      const [{ data: profile }, { data: acts }] = await Promise.all([
        adminApi.get("/admin/me"),
        adminApi.get("/admin/me/activity"),
      ]);
      setMe(profile);
      setActivity(acts.entries || []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const savePref = async (key, value) => {
    if (!me) return;
    const next = { ...me.alert_prefs, [key]: value };
    setMe({ ...me, alert_prefs: next });
    setSavingPrefs(true);
    try {
      await adminApi.patch("/admin/me/alerts", next);
      toast.success("Alert preferences updated.");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Could not save.");
      setMe((m) => ({ ...m, alert_prefs: { ...m.alert_prefs, [key]: !value } }));
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner className="w-7 h-7" /></div>;
  if (!me) return <EmptyState title="Profile unavailable" subtitle="Try reloading the admin portal." icon="!" />;

  return (
    <div className="space-y-5" data-testid="admin-profile-page">
      {/* Identity */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar name={me.full_name} size={60} className="ring-2 ring-brand-100" />
          <div className="min-w-0">
            <h1 className="font-head font-extrabold text-2xl tracking-tight text-ink truncate" data-testid="admin-profile-name">{me.full_name}</h1>
            <p className="text-sm text-muted truncate">{me.email}</p>
            <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-ink text-white text-xs font-semibold">
              <ShieldCheck size={13} weight="fill" /> {me.role_label}
            </span>
          </div>
        </div>
      </Card>

      {/* Permissions */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center"><Scales size={17} weight="bold" /></span>
          <div>
            <h2 className="font-head font-bold text-lg text-ink leading-none">Role &amp; permissions</h2>
            <p className="text-[11px] text-muted mt-0.5">What your elevated session is allowed to do</p>
          </div>
        </div>
        <ul className="space-y-2" data-testid="admin-permissions-list">
          {me.permissions.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm text-ink">
              <CheckCircle size={18} weight="fill" className="text-status-borrowed shrink-0 mt-0.5" />
              <span className="leading-snug">{p}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Accountability stats */}
      <div>
        <p className="label-eyebrow mb-2">My moderation activity</p>
        <div className="grid grid-cols-4 gap-2.5">
          <StatBox value={me.stats.total_actions} label="Total actions" icon={ClipboardText} tone="brand" />
          <StatBox value={me.stats.penalties} label="Penalties" icon={WarningCircle} tone="amber" />
          <StatBox value={me.stats.suspensions} label="Suspensions" icon={Gavel} tone="red" />
          <StatBox value={me.stats.resolutions} label="Resolutions" icon={SealCheck} tone="blue" />
        </div>
      </div>

      {/* High-priority alert preferences */}
      <Card className="p-5">
        <h2 className="font-head font-bold text-lg text-ink mb-1">Instant alerts</h2>
        <p className="text-[12px] text-muted mb-4 leading-snug">Get pinged immediately for high-priority reports — stolen or unreturned items, and escalated disputes.</p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-line bg-surface">
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><EnvelopeSimple size={18} weight="bold" /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-ink">Email alerts</p>
              <p className="text-[11px] text-muted">Sent to {me.email}</p>
            </div>
            <Toggle checked={!!me.alert_prefs.email} onChange={(v) => savePref("email", v)} testid="admin-alert-email" />
          </div>
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-line bg-surface">
            <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center"><DeviceMobile size={18} weight="bold" /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-ink">SMS alerts</p>
              <p className="text-[11px] text-muted">Text message for urgent escalations</p>
            </div>
            <Toggle checked={!!me.alert_prefs.sms} onChange={(v) => savePref("sms", v)} testid="admin-alert-sms" />
          </div>
        </div>
        {savingPrefs && <p className="text-[11px] text-muted mt-2 flex items-center gap-1.5"><Spinner className="w-3 h-3" /> Saving…</p>}
      </Card>

      {/* Security / MFA */}
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-emerald-50 text-status-borrowed flex items-center justify-center"><Lock size={18} weight="bold" /></span>
          <div className="flex-1">
            <p className="font-semibold text-sm text-ink">Two-factor authentication</p>
            <p className="text-[11px] text-muted">Required to elevate into the admin portal</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${me.mfa_enrolled ? "bg-emerald-50 text-status-borrowed" : "bg-amber-50 text-amber-700"}`}>
            {me.mfa_enrolled ? "Enrolled" : "Not set up"}
          </span>
        </div>
      </Card>

      {/* Recent activity log */}
      <div>
        <p className="label-eyebrow mb-2">Recent actions</p>
        {activity.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted">No actions recorded yet.</Card>
        ) : (
          <div className="space-y-2" data-testid="admin-activity-log">
            {activity.slice(0, 30).map((a) => (
              <div key={a.id} className="bg-surface border border-line rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="label-eyebrow !text-brand-600">{(a.action_type || "").replace(/_/g, " ")}</span>
                  <span className="text-[11px] text-muted shrink-0">{(a.created_at || "").slice(0, 16).replace("T", " ")}</span>
                </div>
                <p className="text-sm text-ink mt-1 leading-snug">{a.summary}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account actions */}
      <Card className="p-5 space-y-2.5">
        <Button variant="secondary" className="w-full" onClick={lock} data-testid="admin-profile-lock">
          <Lock size={17} weight="bold" /> Lock session (re-verify MFA)
        </Button>
        <Button variant="danger" className="w-full" onClick={logout} data-testid="admin-profile-logout">
          <SignOut size={17} weight="bold" /> Log out of UTM Borrow
        </Button>
      </Card>
    </div>
  );
}
