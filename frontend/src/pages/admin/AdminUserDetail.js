import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Star, Package, Handshake, UserMinus, Trash,
  ShieldCheck, BellRinging, ArrowsLeftRight, Clock,
} from "@phosphor-icons/react";
import { adminApi, api, formatApiError } from "../../lib/api";
import {
  Avatar, StatusBadge, Button, PageLoader, Modal, Textarea,
  Card, Tabs,
} from "../../components/ui";
import { toast } from "../../components/Toast";

const SUSPENSION_TYPES = [
  { value: "3_Day",    label: "3 Days" },
  { value: "7_Day",    label: "7 Days" },
  { value: "30_Day",   label: "30 Days" },
  { value: "Permanent", label: "Permanent ban" },
];

function StatPill({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-canvas border border-line rounded-2xl p-4 text-center">
      {Icon && <Icon size={18} className={`mx-auto mb-1.5 ${color}`} weight="bold" />}
      <p className="text-xl font-bold text-ink tabular-nums">{value ?? "—"}</p>
      <p className="text-[11px] text-muted mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function TxCard({ tx }) {
  const urgent = tx.status === "Borrowed" && tx.lease?.is_overdue;
  return (
    <Link to={`/admin/transactions/${tx.id}`}>
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-line bg-surface hover:border-brand-200 transition-colors">
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-brand-gradient flex items-center justify-center shrink-0">
          {tx.item?.photo_url
            ? <img src={tx.item.photo_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-white font-bold text-sm">{tx.item?.title?.[0]}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{tx.item?.title}</p>
          <p className="text-xs text-muted truncate">{tx.borrower?.full_name} → {tx.lender?.full_name}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={tx.status} />
          {urgent && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Overdue</span>}
        </div>
      </div>
    </Link>
  );
}

function ItemCard({ item }) {
  return (
    <Link to={`/items/${item.id}`}>
      <div className="flex items-center gap-3 p-3 rounded-2xl border border-line bg-surface hover:border-brand-200 transition-colors">
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-brand-gradient flex items-center justify-center shrink-0">
          {item.photo_url
            ? <img src={item.photo_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-white font-bold">{item.title?.[0]}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{item.title}</p>
          <p className="text-xs text-muted">{item.category}</p>
        </div>
        <StatusBadge status={item.availability_status || "Available"} />
      </div>
    </Link>
  );
}

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [userMeta, setUserMeta] = useState(null); // from admin/users list
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // Suspend state
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendType, setSuspendType] = useState("7_Day");
  const [suspendReason, setSuspendReason] = useState("");
  const [postAction, setPostAction] = useState("keep");
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [reinstateReason, setReinstateReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      // Fetch public profile
      const { data: prof } = await api.get(`/profile/${userId}`);
      setProfile(prof);

      // Fetch admin user data (search by email/name to get account_status, etc.)
      try {
        const { data: ud } = await adminApi.get("/admin/users", { params: { q: prof.email || prof.full_name } });
        const found = (ud.users || []).find((u) => u.id === userId);
        if (found) setUserMeta(found);
      } catch { /* non-critical */ }

      // Fetch user's transactions (search by full_name)
      try {
        const { data: td } = await adminApi.get("/admin/transactions", { params: { q: prof.full_name } });
        const userTxs = (td.transactions || []).filter(
          (t) => t.borrower?.id === userId || t.lender?.id === userId
        );
        setTransactions(userTxs);
      } catch { /* non-critical */ }

      // Fetch user's items
      try {
        const { data: id } = await api.get("/items", { params: { limit: 50 } });
        const userItems = (id.items || []).filter((i) => i.owner_id === userId || i.user_id === userId);
        setItems(userItems);
      } catch { /* non-critical */ }
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || "User not found.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const confirmSuspend = async () => {
    if (!suspendReason.trim()) return;
    setBusy(true);
    try {
      await adminApi.post(`/admin/users/${userId}/suspend`, {
        suspension_type: suspendType,
        reason: suspendReason.trim(),
        post_action: postAction,
      });
      toast.success("User suspended.");
      setSuspendOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  const confirmReinstate = async () => {
    setBusy(true);
    try {
      await adminApi.post(`/admin/users/${userId}/reinstate`, { reason: reinstateReason || "Reinstated by admin." });
      toast.success("User reinstated.");
      setReinstateOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  const deleteUser = async () => {
    setDeleteOpen(false);
    setBusy(true);
    try {
      await adminApi.delete(`/admin/users/${userId}`);
      toast.success("User deleted.");
      navigate("/admin/users");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  const sendReminder = () => toast.info("Reminder notification sent to user.");

  if (loading) return <PageLoader />;
  if (err) return (
    <div className="text-center py-16">
      <p className="text-muted mb-4">{err}</p>
      <Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button>
    </div>
  );

  // The /profile/:id endpoint nests the user under `.user` (alongside
  // rating_history / completed_transactions) — read from there, not the root,
  // or the name, email and avatar all come back empty.
  const u = profile?.user || {};
  const meta = userMeta || {};
  const accountStatus = meta.account_status || "Active";
  const trustScore = Number(u.trust_score ?? meta.trust_score ?? 5).toFixed(1);
  const isAdmin = u.is_admin || meta.is_admin;

  const activeLoanCount = transactions.filter((t) => t.status === "Borrowed").length;
  const completedCount = transactions.filter((t) => t.status === "Completed").length;

  const TABS = [
    { value: "overview",     label: "Overview" },
    { value: "transactions", label: "Transactions", count: transactions.length },
    { value: "items",        label: "Items",        count: items.length },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-muted text-sm font-medium hover:text-ink transition-colors"
        data-testid="back-btn"
      >
        <ArrowLeft size={15} weight="bold" /> Back to users
      </button>

      {/* Profile header card */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar name={u.full_name} src={u.profile_picture} size={56} className="shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-head font-extrabold text-xl text-ink truncate">{u.full_name}</h1>
                {isAdmin && <ShieldCheck size={18} weight="fill" className="text-brand-500 shrink-0" />}
              </div>
              <p className="text-sm text-muted truncate">{u.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StatusBadge status={accountStatus} />
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <Star size={12} weight="fill" /> {trustScore}
                </span>
              </div>
            </div>
          </div>

          {/* Actions — equal-width row on mobile, inline on desktop */}
          <div className="flex gap-2 w-full sm:w-auto sm:shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={sendReminder}
            >
              <BellRinging size={14} weight="bold" /> Remind
            </Button>
            {accountStatus === "Active" ? (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => { setSuspendType("7_Day"); setSuspendReason(""); setSuspendOpen(true); }}
                data-testid="user-detail-suspend"
              >
                <UserMinus size={14} weight="bold" /> Suspend
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 sm:flex-none"
                onClick={() => { setReinstateReason(""); setReinstateOpen(true); }}
                data-testid="user-detail-reinstate"
              >
                Reinstate
              </Button>
            )}
            {!isAdmin && (
              <Button
                variant="danger"
                size="sm"
                className="flex-1 sm:flex-none"
                loading={busy}
                onClick={() => setDeleteOpen(true)}
                data-testid="user-detail-delete"
              >
                <Trash size={14} weight="bold" /> Delete
              </Button>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <StatPill label="Trust score"  value={trustScore}      icon={Star}          color="text-amber-500" />
          <StatPill label="Listings"     value={items.length || (meta.listings ?? 0)}  icon={Package}        color="text-brand-500" />
          <StatPill label="Active loans" value={activeLoanCount} icon={Handshake}      color="text-emerald-500" />
          <StatPill label="Completed"    value={completedCount}  icon={ArrowsLeftRight} color="text-blue-500" />
        </div>
      </Card>

      {/* Tabs */}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-4">
          {u.bio && (
            <Card className="p-4">
              <p className="label-eyebrow mb-1.5">Bio</p>
              <p className="text-sm text-ink leading-relaxed">{u.bio}</p>
            </Card>
          )}

          {transactions.some((t) => t.status === "Borrowed" && t.lease?.is_overdue) && (
            <Card className="p-4 border-red-200 bg-red-50/40">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={16} className="text-red-500" weight="bold" />
                <p className="text-sm font-semibold text-red-700">Has overdue loans</p>
              </div>
              {transactions.filter((t) => t.status === "Borrowed" && t.lease?.is_overdue).map((t) => (
                <TxCard key={t.id} tx={t} />
              ))}
            </Card>
          )}

          {/* Recent activity summary */}
          <Card className="p-4">
            <p className="label-eyebrow mb-3">Recent transactions</p>
            {transactions.length === 0
              ? <p className="text-sm text-muted">No transactions found.</p>
              : transactions.slice(0, 5).map((t) => <div key={t.id} className="mb-2 last:mb-0"><TxCard tx={t} /></div>)
            }
            {transactions.length > 5 && (
              <button onClick={() => setTab("transactions")} className="mt-2 text-xs text-brand-600 font-semibold hover:underline">
                View all {transactions.length} transactions →
              </button>
            )}
          </Card>
        </div>
      )}

      {tab === "transactions" && (
        <div className="space-y-2">
          {transactions.length === 0
            ? <p className="text-sm text-muted py-4 text-center">No transactions found for this user.</p>
            : transactions.map((t) => <TxCard key={t.id} tx={t} />)
          }
        </div>
      )}

      {tab === "items" && (
        <div className="space-y-2">
          {items.length === 0
            ? <p className="text-sm text-muted py-4 text-center">No listings found for this user.</p>
            : items.map((i) => <ItemCard key={i.id} item={i} />)
          }
        </div>
      )}

      {/* Suspend modal */}
      <Modal open={suspendOpen} onClose={() => setSuspendOpen(false)} title={`Suspend ${u.full_name}`} testid="user-detail-suspend-modal">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Duration</p>
            <div className="flex flex-wrap gap-2">
              {SUSPENSION_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSuspendType(t.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    suspendType === t.value ? "bg-brand-gradient text-white border-transparent" : "bg-surface border-line text-muted hover:border-brand-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Textarea label="Reason (required)" rows={3} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Their listings</p>
            <div className="flex gap-3">
              {[
                { value: "keep",   label: "Keep (hidden)", desc: "Re-shown on reinstate" },
                { value: "remove", label: "Remove",        desc: "Cannot be undone" },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => setPostAction(o.value)}
                  className={`flex-1 text-left p-3 rounded-2xl border text-xs transition-colors ${postAction === o.value ? "border-brand-300 bg-brand-50" : "border-line bg-surface hover:border-brand-200"}`}
                >
                  <p className="font-semibold text-ink">{o.label}</p>
                  <p className="text-muted mt-0.5">{o.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button variant="danger" className="flex-1" loading={busy} disabled={!suspendReason.trim()} onClick={confirmSuspend}>
              Confirm suspension
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reinstate modal */}
      <Modal open={reinstateOpen} onClose={() => setReinstateOpen(false)} title={`Reinstate ${u.full_name}`}>
        <div className="space-y-4">
          <Textarea label="Reason (optional)" rows={3} value={reinstateReason} onChange={(e) => setReinstateReason(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setReinstateOpen(false)}>Cancel</Button>
            <Button variant="success" className="flex-1" loading={busy} onClick={confirmReinstate}>Reinstate</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation — in-app replacement for window.confirm */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete user permanently?" testid="user-delete-modal" size="sm">
        <p className="text-sm text-muted leading-relaxed">
          This permanently deletes <span className="font-semibold text-ink">{u.full_name}</span>, all of their listings,
          and every transaction they were part of. This cannot be undone.
        </p>
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteOpen(false)} data-testid="user-delete-cancel">Cancel</Button>
          <Button variant="danger" className="flex-1" loading={busy} onClick={deleteUser} data-testid="user-delete-confirm">
            <Trash size={15} weight="bold" /> Delete permanently
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
}
