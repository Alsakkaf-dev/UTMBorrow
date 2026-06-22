import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    SignOut, Camera, PencilSimple, ShieldCheck, Gear, Bell, ArrowRight,
    Star, BookmarkSimple, HandArrowUp, Package, Trophy, Sparkle,
} from "@phosphor-icons/react";
import { api, formatApiError } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { Button, Input, Textarea, Select, Modal, PageLoader, StarRating, Avatar, StatusBadge, TrustRing, ProgressBar } from "../../components/ui";
import { toast } from "../../components/Toast";
import { staggerContainer, riseItem, slideItem } from "../../lib/motion";

/* ── Animated stat box ── */
function StatBox({ icon, value, label, color = "brand" }) {
    const COLORS = {
        brand:   { bg: "bg-brand-50",   text: "text-brand-600",   border: "border-brand-100" },
        amber:   { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-100" },
        emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
        blue:    { bg: "bg-blue-50",    text: "text-blue-600",    border: "border-blue-100" },
    };
    const c = COLORS[color] || COLORS.brand;
    return (
        <motion.div
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 26 }}
            className={`flex-1 rounded-2xl ${c.bg} border ${c.border} p-3 text-center`}
        >
            <div className={`flex items-center justify-center gap-1 ${c.text}`}>
                {icon}
                <span className="font-head font-extrabold text-xl text-ink">{value}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted mt-1">{label}</p>
        </motion.div>
    );
}

/* ── Quick action button ── */
function QuickAction({ icon, label, onClick, variant = "secondary", testid }) {
    const IS_PRIMARY = variant === "primary";
    return (
        <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={onClick}
            data-testid={testid}
            className={`flex flex-col items-center gap-2 py-4 px-3 rounded-3xl border transition-all ${
                IS_PRIMARY
                    ? "bg-brand-gradient text-white border-transparent shadow-glow-sm"
                    : "bg-surface border-line text-ink hover:border-brand-200 hover:bg-brand-50/40 shadow-soft"
            }`}
        >
      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center ${IS_PRIMARY ? "bg-white/20" : "bg-brand-50 text-brand-600"}`}>
        {icon}
      </span>
            <span className={`text-[11px] font-bold ${IS_PRIMARY ? "text-white" : "text-ink"}`}>{label}</span>
        </motion.button>
    );
}

/* ── Rating bar chart ── */
function RatingDistribution({ ratings }) {
    if (!ratings || ratings.length === 0) return null;
    const counts = [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: ratings.filter((r) => Math.round(r.stars) === star).length,
    }));
    const max = Math.max(...counts.map((c) => c.count), 1);
    return (
        <div className="space-y-2 mb-4">
            {counts.map(({ star, count }) => (
                <div key={star} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-muted w-3 text-right">{star}</span>
                    <Star size={11} weight="fill" className="text-amber-400 shrink-0" />
                    <ProgressBar value={count} max={max} color="amber" className="flex-1 !h-1.5" />
                    <span className="text-[11px] text-muted w-4 text-right">{count}</span>
                </div>
            ))}
        </div>
    );
}

/* ══════════════════ Main Page ══════════════════ */
export default function Profile() {
    const { user, setUser, logout } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile]       = useState(null);
    const [dashboard, setDashboard]   = useState(null);
    const [savedItems, setSavedItems] = useState([]);
    const [editOpen, setEditOpen]     = useState(false);
    const [phone, setPhone]           = useState("");
    const [photo, setPhoto]           = useState(null);
    const [bio, setBio]               = useState("");
    const [campus, setCampus]         = useState("");
    const [busy, setBusy]             = useState(false);
    const [err, setErr]               = useState("");
    const [showAllRatings, setShowAllRatings] = useState(false);

    const load = async () => {
        const [{ data: prof }, { data: dash }, savedRes] = await Promise.all([
            api.get(`/profile/${user.id}`),
            api.get("/dashboard"),
            api.get("/saved").catch(() => ({ data: { items: [] } })),
        ]);
        setProfile(prof);
        setDashboard(dash);
        setSavedItems(savedRes.data.items || []);
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user.id]);

    const openEdit = () => {
        setPhone(user.phone_number || "");
        setPhoto(user.profile_picture || null);
        setBio(user.bio || "");
        setCampus(user.campus || "");
        setErr("");
        setEditOpen(true);
    };

    const CAMPUS_OPTIONS = ["Skudai", "Kuala Lumpur", "Pagoh"];

    const onPhoto = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        // UC1201 A1: only JPEG/PNG under 5MB.
        if (!["image/jpeg", "image/png"].includes(f.type) || f.size > 5 * 1024 * 1024) {
            setErr("Please upload a valid JPEG or PNG image under 5MB.");
            return;
        }
        const r = new FileReader();
        r.onload = () => setPhoto(r.result);
        r.readAsDataURL(f);
    };

    const save = async () => {
        setBusy(true); setErr("");
        try {
            const { data } = await api.put("/profile", { phone_number: phone, profile_picture: photo, bio, campus });
            setUser({ ...user, phone_number: data.user.phone_number, profile_picture: data.user.profile_picture, bio: data.user.bio, campus: data.user.campus });
            setEditOpen(false);
            toast.success("Profile updated.");
            load();
        } catch (e) { setErr(formatApiError(e.response?.data?.detail) || e.message); }
        finally { setBusy(false); }
    };

    if (!profile) return <PageLoader />;

    const u           = profile.user;
    const lendCount   = dashboard?.lending?.length  || 0;
    const borrowCount = dashboard?.borrowing?.length || 0;
    const myListings  = dashboard?.lending?.filter((t) => t.status === "Borrowed") || [];
    const borrowHistory = [
        ...(dashboard?.borrowing || []),
        ...(dashboard?.lending   || []),
    ]
        .filter((t) => ["Completed", "Borrowed", "Cancelled", "Rejected"].includes(t.status))
        .slice(0, 5);

    const visibleRatings = showAllRatings
        ? profile.rating_history
        : profile.rating_history.slice(0, 3);

    const trustScore = Number(u.trust_score || 0);
    const memberYear = new Date(u.created_at || Date.now()).getFullYear();

    return (
        <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="pb-4"
        >
            {/* ── Header ── */}
            <motion.div variants={riseItem} className="flex items-center justify-between mb-5">
                <div>
                    <p className="label-eyebrow">Your identity</p>
                    <h1 className="font-head font-extrabold text-3xl tracking-tight leading-tight">My Profile</h1>
                </div>
                <motion.button
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ rotate: 45 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    onClick={() => navigate("/settings")}
                    className="w-11 h-11 rounded-2xl bg-surface border border-line flex items-center justify-center shadow-soft hover:border-brand-200 hover:bg-brand-50 transition-colors"
                    data-testid="profile-settings-btn"
                >
                    <Gear size={20} className="text-ink" />
                </motion.button>
            </motion.div>

            {/* ── Hero profile card ── */}
            <motion.div
                variants={riseItem}
                className="relative bg-surface border border-line rounded-4xl shadow-card mb-4 overflow-hidden"
                data-testid="profile-card"
            >
                {/* Subtle top gradient */}
                <div className="h-24 bg-mesh-brand relative">
                    <div className="absolute inset-0 bg-brand-50/40" />
                </div>

                {/* Avatar (overlapping gradient) */}
                <div className="px-5 pb-5 -mt-10">
                    <div className="flex items-end justify-between gap-3 mb-4">
                        <div className="relative">
                            <div className="ring-4 ring-surface rounded-full shadow-card">
                                <Avatar name={u.full_name} src={u.profile_picture} size={72} />
                            </div>
                            <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={openEdit}
                                data-testid="edit-profile-btn"
                                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-glow-sm"
                            >
                                <PencilSimple size={13} weight="bold" />
                            </motion.button>
                        </div>

                        {/* Trust ring */}
                        <div className="flex flex-col items-center gap-1">
                            <TrustRing score={trustScore} size={68} strokeWidth={5} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Trust</span>
                        </div>
                    </div>

                    {/* Name + meta */}
                    <h2 className="font-head font-bold text-xl text-ink leading-tight">{u.full_name}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-sm text-muted">{u.matric_no}</span>
                        {user.is_admin && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold border border-brand-100">
                <ShieldCheck size={11} weight="fill" /> Admin
              </span>
                        )}
                        <span className="text-[11px] text-muted">· Member since {memberYear}</span>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-2.5 mt-4">
                        <StatBox
                            icon={<Star size={14} weight="fill" className="text-amber-400" />}
                            value={trustScore.toFixed(1)}
                            label="Reputation"
                            color="amber"
                        />
                        <StatBox
                            icon={<HandArrowUp size={14} weight="fill" />}
                            value={lendCount}
                            label="Lent"
                            color="brand"
                        />
                        <StatBox
                            icon={<Package size={14} weight="fill" />}
                            value={borrowCount}
                            label="Borrowed"
                            color="emerald"
                        />
                    </div>
                </div>
            </motion.div>

            {/* ── Quick actions ── */}
            <motion.div variants={riseItem} className="grid grid-cols-3 gap-2.5 mb-5">
                <QuickAction
                    icon={<Gear size={20} weight="fill" />}
                    label="Settings"
                    onClick={() => navigate("/settings")}
                    variant="primary"
                    testid="profile-quick-settings"
                />
                <QuickAction
                    icon={<Bell size={20} />}
                    label="Alerts"
                    onClick={() => navigate("/notifications")}
                    testid="profile-quick-alerts"
                />
                <QuickAction
                    icon={<Trophy size={20} />}
                    label="Reputation"
                    onClick={() => navigate("/settings/reputation")}
                    testid="profile-quick-trust"
                />
            </motion.div>

            {/* ── Active lending ── */}
            {myListings.length > 0 && (
                <motion.div variants={riseItem} className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-head font-bold text-base text-ink flex items-center gap-2">
                            <HandArrowUp size={17} weight="fill" className="text-brand-500" />
                            Active loans
                        </h3>
                        <Link to="/lend" className="text-xs font-bold text-brand-600 flex items-center gap-1">
                            Manage <ArrowRight size={12} weight="bold" />
                        </Link>
                    </div>
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                        {myListings.map((tx) => (
                            <motion.button
                                key={tx.id}
                                variants={slideItem}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => navigate(`/transactions/${tx.id}`)}
                                className="shrink-0 w-[160px] bg-surface border border-line rounded-3xl p-3 text-left shadow-soft hover:shadow-card hover:border-brand-200 transition-all"
                            >
                                <div className="w-full h-[80px] rounded-2xl overflow-hidden mb-2.5 bg-brand-gradient">
                                    {tx.item?.photo_url
                                        ? <img src={tx.item.photo_url} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-white font-head font-extrabold text-2xl">{tx.item?.title?.[0]}</span>
                                        </div>}
                                </div>
                                <p className="font-semibold text-sm text-ink truncate mb-1.5">{tx.item?.title}</p>
                                <StatusBadge status={tx.status} />
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ── Saved items ── */}
            <motion.div variants={riseItem} className="mb-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-head font-bold text-base text-ink flex items-center gap-2">
                        <BookmarkSimple size={17} weight="fill" className="text-brand-500" />
                        Saved items
                        {savedItems.length > 0 && (
                            <span className="text-xs text-muted font-plex">({savedItems.length})</span>
                        )}
                    </h3>
                </div>
                {savedItems.length === 0 ? (
                    <div className="bg-surface border border-line rounded-3xl p-5 flex flex-col items-center gap-2 text-center shadow-soft">
                        <BookmarkSimple size={30} className="text-slate-200" />
                        <p className="text-sm font-semibold text-ink">Nothing saved yet</p>
                        <p className="text-xs text-muted">Tap the bookmark on any item to save it here.</p>
                    </div>
                ) : (
                    <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                        {savedItems.map((item) => (
                            <motion.button
                                key={item.id}
                                variants={slideItem}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => navigate(`/items/${item.id}`)}
                                className="shrink-0 w-[150px] bg-surface border border-line rounded-3xl p-3 text-left shadow-soft hover:shadow-card hover:border-brand-200 transition-all"
                                data-testid={`saved-item-${item.id}`}
                            >
                                <div className="relative w-full h-[90px] rounded-2xl overflow-hidden mb-2.5">
                                    {item.photo_url
                                        ? <img src={item.photo_url} alt={item.title} className="w-full h-full object-cover" />
                                        : <div className="w-full h-full bg-brand-gradient flex items-center justify-center">
                                            <span className="font-head font-extrabold text-white/90 text-2xl">{item.title?.[0]?.toUpperCase()}</span>
                                        </div>}
                                    <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-brand-500/90 flex items-center justify-center shadow-soft">
                    <BookmarkSimple size={12} weight="fill" className="text-white" />
                  </span>
                                </div>
                                <p className="font-semibold text-sm text-ink line-clamp-1 leading-snug">{item.title}</p>
                                <p className="text-xs text-muted mt-0.5 truncate">{item.category}</p>
                            </motion.button>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* ── Borrow history ── */}
            {borrowHistory.length > 0 && (
                <motion.div variants={riseItem} className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-head font-bold text-base text-ink flex items-center gap-2">
                            <Sparkle size={17} weight="fill" className="text-brand-500" />
                            Recent activity
                        </h3>
                        <Link to="/history" className="text-xs font-bold text-brand-600 flex items-center gap-1">
                            View all <ArrowRight size={12} weight="bold" />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {borrowHistory.map((tx, i) => (
                            <motion.button
                                key={tx.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => navigate(`/transactions/${tx.id}`)}
                                className="w-full flex items-center gap-3 bg-surface border border-line rounded-3xl p-3.5 shadow-soft hover:shadow-card hover:border-brand-200 transition-all text-left"
                            >
                                {/* Item thumb */}
                                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 bg-brand-gradient">
                                    {tx.item?.photo_url
                                        ? <img src={tx.item.photo_url} alt="" className="w-full h-full object-cover" />
                                        : <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-white font-head font-bold text-sm">{tx.item?.title?.[0]}</span>
                                        </div>}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm text-ink truncate">{tx.item?.title}</p>
                                    <p className="text-xs text-muted mt-0.5">{tx.borrow_start_date} → {tx.borrow_end_date}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <StatusBadge status={tx.status} />
                                    <ArrowRight size={14} className="text-slate-300" />
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ── Ratings section ── */}
            <motion.div variants={riseItem} className="mb-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-head font-bold text-base text-ink flex items-center gap-2">
                        <ShieldCheck size={17} weight="fill" className="text-brand-500" />
                        Reviews ({profile.rating_count})
                    </h3>
                    {profile.rating_count > 0 && (
                        <div className="flex items-center gap-1">
                            <Star size={13} weight="fill" className="text-amber-400" />
                            <span className="text-sm font-bold text-ink">{trustScore.toFixed(1)}</span>
                        </div>
                    )}
                </div>

                {profile.rating_history.length === 0 ? (
                    <div className="bg-surface border border-line rounded-3xl p-6 text-center shadow-soft">
                        <Star size={30} className="text-slate-200 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-ink">No reviews yet</p>
                        <p className="text-xs text-muted mt-1">Complete a borrow to earn your first review.</p>
                    </div>
                ) : (
                    <>
                        {/* Rating distribution chart */}
                        <div className="bg-surface border border-line rounded-3xl p-4 shadow-soft mb-3">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="text-center">
                                    <p className="font-head font-extrabold text-4xl text-ink">{trustScore.toFixed(1)}</p>
                                    <StarRating value={trustScore} size={14} />
                                    <p className="text-xs text-muted mt-1">{profile.rating_count} review{profile.rating_count !== 1 ? "s" : ""}</p>
                                </div>
                                <div className="flex-1">
                                    <RatingDistribution ratings={profile.rating_history} />
                                </div>
                            </div>
                        </div>

                        {/* Individual ratings */}
                        <div className="space-y-3">
                            {visibleRatings.map((r, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="border border-line rounded-3xl p-4 bg-surface shadow-card"
                                    data-testid={`rating-${i}`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2.5">
                                            <Avatar name={r.rater_name} size={34} />
                                            <span className="font-semibold text-ink text-sm">{r.rater_name}</span>
                                        </div>
                                        <StarRating value={r.stars} size={14} />
                                    </div>
                                    {r.feedback && (
                                        <p className="text-sm text-muted leading-relaxed mt-2 pl-1 border-l-2 border-brand-100">
                                            "{r.feedback}"
                                        </p>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        {profile.rating_history.length > 3 && (
                            <button
                                onClick={() => setShowAllRatings(!showAllRatings)}
                                className="w-full mt-3 py-3 rounded-3xl border border-line text-sm font-bold text-brand-600 hover:bg-brand-50 transition-colors"
                            >
                                {showAllRatings ? "Show less" : `Show all ${profile.rating_history.length} reviews`}
                            </button>
                        )}
                    </>
                )}
            </motion.div>

            {/* ── Sign out ── */}
            <motion.button
                variants={riseItem}
                whileTap={{ scale: 0.98 }}
                onClick={async () => { await logout(); navigate("/login"); }}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-3xl border border-red-100 bg-red-50 text-status-cancelled font-semibold text-sm hover:bg-red-100 transition-colors"
                data-testid="logout-btn"
            >
                <SignOut size={16} weight="bold" /> Sign out
            </motion.button>

            {/* ── Edit profile modal ── */}
            <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit profile" testid="edit-profile-modal">
                {err && (
                    <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-2xl px-3.5 py-2.5 mb-4">
                        {err}
                    </div>
                )}
                {/* Photo upload */}
                <div className="flex justify-center mb-5">
                    <label
                        className="relative w-24 h-24 rounded-3xl overflow-hidden cursor-pointer group"
                        data-testid="profile-photo-upload"
                    >
                        {photo
                            ? <img src={photo} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-brand-50 border-2 border-dashed border-brand-200 flex items-center justify-center">
                                <Camera size={26} className="text-brand-400" />
                            </div>}
                        <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera size={22} className="text-white" />
                        </div>
                        <input
                            type="file"
                            accept="image/png,image/jpeg"
                            className="hidden"
                            onChange={onPhoto}
                            data-testid="profile-photo-input"
                        />
                    </label>
                </div>
                <Input
                    label="Phone number"
                    placeholder="+60..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    data-testid="profile-phone-input"
                />
                <div className="mt-3">
                    <Textarea
                        label="Personal bio"
                        placeholder="Tell the community a little about yourself…"
                        rows={3}
                        maxLength={300}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        data-testid="profile-bio-input"
                    />
                    <span className="text-slate-400 text-xs mt-1 block text-right">{bio.length}/300</span>
                </div>
                <div className="mt-3">
                    <Select
                        label="Verified campus"
                        value={campus}
                        onChange={(e) => setCampus(e.target.value)}
                        data-testid="profile-campus-input"
                    >
                        <option value="">Not set</option>
                        {CAMPUS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                </div>
                <Button className="w-full mt-5" loading={busy} onClick={save} disabled={busy} data-testid="profile-save">
                    Save changes
                </Button>
            </Modal>
        </motion.div>
    );
}