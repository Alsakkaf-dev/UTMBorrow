import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Rows, Cards, UserMinus, Trash, BellRinging, Star,
  ArrowRight, ShieldCheck,
} from "@phosphor-icons/react";
import { adminApi, formatApiError } from "../../lib/api";
import {
  Card, DataTable, SearchBar, Select, Button, PageLoader, EmptyState,
  StatusBadge, Avatar, Modal, Textarea, SlideDrawer, BulkActionBar,
  PageHeader,
} from "../../components/ui";
import { toast } from "../../components/Toast";

const SUSPENSION_TYPES = [
  { value: "3_Day",    label: "3 Days" },
  { value: "7_Day",    label: "7 Days" },
  { value: "14_Day",   label: "14 Days" },
  { value: "30_Day",   label: "30 Days" },
  { value: "Permanent", label: "Permanent ban" },
];

const TABLE_COLS = [
  { key: "full_name",    label: "Name",     sortable: true,  render: (v, row) => (
    <div className="flex items-center gap-2.5">
      <Avatar name={v} src={row.profile_picture} size={32} />
      <div className="min-w-0">
        <p className="font-semibold text-ink text-sm truncate leading-tight">
          {v}
          {row.is_admin && <ShieldCheck size={12} className="inline ml-1 text-brand-500" weight="fill" />}
        </p>
        <p className="text-xs text-muted truncate">{row.email}</p>
      </div>
    </div>
  )},
  { key: "account_status", label: "Status", sortable: true,  render: (v) => <StatusBadge status={v} /> },
  { key: "trust_score",   label: "Trust",   sortable: true,  align: "right", render: (v) => (
    <span className="inline-flex items-center gap-1 text-sm font-semibold text-ink">
      <Star size={12} weight="fill" className="text-amber-400" />
      {Number(v ?? 5).toFixed(1)}
    </span>
  )},
  { key: "listings",     label: "Listings",  sortable: true, align: "right", render: (v) => <span className="text-sm tabular-nums">{v ?? 0}</span> },
  { key: "active_loans", label: "Loans",    sortable: true,  align: "right", render: (v) => <span className="text-sm tabular-nums">{v ?? 0}</span> },
];

export default function AdminUsers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // Default to cards on narrow screens, table on desktop
  const [view, setView] = useState(() => window.innerWidth < 640 ? "cards" : "table");
  const [sortKey, setSortKey] = useState("full_name");
  const [sortDir, setSortDir] = useState("asc");
  const [selected, setSelected] = useState([]);

  // Drawers / modals
  const [drawerUser, setDrawerUser] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendType, setSuspendType] = useState("7_Day");
  const [suspendReason, setSuspendReason] = useState("");
  const [postAction, setPostAction] = useState("keep");
  const [reinstateTarget, setReinstateTarget] = useState(null);
  const [reinstateReason, setReinstateReason] = useState("");
  const [busy, setBusy] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // In-app confirmation dialog (replaces native window.confirm)
  const [confirmCfg, setConfirmCfg] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = {};
      if (q) params.q = q;
      if (statusFilter) params.status = statusFilter;
      const { data } = await adminApi.get("/admin/users", { params });
      setUsers(data.users || []);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // ─── Sorting ────────────────────────────────────────────────────────────────

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = [...users].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  // ─── Actions ────────────────────────────────────────────────────────────────

  const openSuspend = (u) => {
    setSuspendTarget(u);
    setSuspendType("7_Day");
    setSuspendReason("");
    setPostAction("keep");
    setDrawerUser(null);
  };

  const confirmSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    setBusy(suspendTarget.id);
    try {
      const { data } = await adminApi.post(`/admin/users/${suspendTarget.id}/suspend`, {
        suspension_type: suspendType,
        reason: suspendReason.trim(),
        post_action: postAction,
      });
      const suffix = data.removed_posts > 0 ? ` (${data.removed_posts} posts removed)` : "";
      toast.success(`User suspended.${suffix}`);
      setSuspendTarget(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setBusy(null); }
  };

  const confirmReinstate = async () => {
    if (!reinstateTarget) return;
    setBusy(reinstateTarget.id);
    try {
      await adminApi.post(`/admin/users/${reinstateTarget.id}/reinstate`, { reason: reinstateReason || "Reinstated by admin." });
      toast.success("User reinstated.");
      setReinstateTarget(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setBusy(null); }
  };

  const doRemove = async (u) => {
    setBusy(u.id);
    try {
      const { data } = await adminApi.delete(`/admin/users/${u.id}`);
      toast.success(`Deleted ${u.full_name} — ${data.deleted_items} listings, ${data.deleted_transactions} transactions.`);
      setDrawerUser(null);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setBusy(null); }
  };

  const remove = (u) => setConfirmCfg({
    title: "Delete user permanently?",
    message: `This permanently deletes ${u.full_name}, ALL their listings, and every transaction they were part of. This cannot be undone.`,
    confirmLabel: "Delete permanently",
    variant: "danger",
    onConfirm: () => doRemove(u),
  });

  const doBulkSuspend = async () => {
    setBulkBusy(true);
    let ok = 0;
    for (const id of selected) {
      try {
        await adminApi.post(`/admin/users/${id}/suspend`, {
          suspension_type: "7_Day",
          reason: "Bulk suspension by admin.",
          post_action: "keep",
        });
        ok++;
      } catch { /* skip */ }
    }
    toast.success(`Suspended ${ok} of ${selected.length} users.`);
    setSelected([]);
    setBulkBusy(false);
    load();
  };

  const bulkSuspend = () => {
    if (!selected.length) return;
    setConfirmCfg({
      title: `Suspend ${selected.length} user${selected.length > 1 ? "s" : ""}?`,
      message: "Each selected user will be suspended for 7 days. Their listings stay hidden until they are reinstated.",
      confirmLabel: "Suspend users",
      variant: "danger",
      onConfirm: doBulkSuspend,
    });
  };

  const bulkNotify = async () => {
    toast.info(`Warning notification sent to ${selected.length} users.`);
    setSelected([]);
  };

  const doBulkDelete = async () => {
    setBulkBusy(true);
    let ok = 0;
    for (const id of selected) {
      const u = users.find((x) => x.id === id);
      if (u?.is_admin) continue;
      try { await adminApi.delete(`/admin/users/${id}`); ok++; } catch { /* skip */ }
    }
    toast.success(`Deleted ${ok} users.`);
    setSelected([]);
    setBulkBusy(false);
    load();
  };

  const bulkDelete = () => {
    if (!selected.length) return;
    setConfirmCfg({
      title: `Delete ${selected.length} user${selected.length > 1 ? "s" : ""}?`,
      message: "This permanently deletes the selected users and all of their data. Admin accounts are skipped. This cannot be undone.",
      confirmLabel: "Delete permanently",
      variant: "danger",
      onConfirm: doBulkDelete,
    });
  };

  // ─── Table columns with actions ─────────────────────────────────────────────

  const fullCols = [
    ...TABLE_COLS,
    {
      key: "_actions",
      label: "",
      render: (_, row) => (
        <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {row.account_status === "Active" ? (
            <Button variant="ghost" size="sm" onClick={() => openSuspend(row)} data-testid={`suspend-${row.id}`}>
              Suspend
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => { setReinstateTarget(row); setReinstateReason(""); }} data-testid={`reinstate-${row.id}`}>
              Reinstate
            </Button>
          )}
        </div>
      ),
      tdClassName: "text-right",
    },
  ];

  // ─── Drawer content ──────────────────────────────────────────────────────────

  const DrawerBody = ({ user: u }) => (
    <div className="space-y-5">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <Avatar name={u.full_name} src={u.profile_picture} size={52} />
        <div>
          <p className="font-head font-bold text-lg text-ink">{u.full_name}
            {u.is_admin && <ShieldCheck size={16} className="inline ml-1.5 text-brand-500" weight="fill" />}
          </p>
          <p className="text-sm text-muted">{u.email}</p>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Trust score", value: Number(u.trust_score ?? 5).toFixed(1) },
          { label: "Listings",    value: u.listings ?? 0 },
          { label: "Active loans", value: u.active_loans ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="bg-canvas border border-line rounded-2xl p-3 text-center">
            <p className="text-lg font-bold text-ink tabular-nums">{stat.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted">Account status</span>
        <StatusBadge status={u.account_status} />
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <Button
          variant="secondary"
          className="w-full justify-start gap-2"
          onClick={() => navigate(`/admin/users/${u.id}`)}
        >
          <ArrowRight size={15} weight="bold" /> View full profile
        </Button>
        {u.account_status === "Active" ? (
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => openSuspend(u)}>
            <UserMinus size={15} weight="bold" /> Suspend user
          </Button>
        ) : (
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => { setReinstateTarget(u); setReinstateReason(""); setDrawerUser(null); }}>
            Reinstate user
          </Button>
        )}
        {!u.is_admin && (
          <Button variant="danger" className="w-full justify-start gap-2" loading={busy === u.id} onClick={() => remove(u)} data-testid={`delete-user-${u.id}`}>
            <Trash size={15} weight="bold" /> Delete permanently
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div data-testid="admin-users-page" className="space-y-5 max-w-5xl">
      <PageHeader eyebrow="Oversight" title="Users" subtitle={`${users.length} total`} />

      {/* Filters + view toggle — stacks to 2 rows on mobile */}
      <div className="flex flex-col gap-2.5">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Search name, email, matric…"
          className="w-full"
          testid="users-search"
        />
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} data-testid="users-status">
              <option value="">All statuses</option>
              <option value="Active">Active</option>
              <option value="Suspended">Suspended</option>
              <option value="Banned">Banned</option>
            </Select>
          </div>
          {/* View toggle — only shown on sm+ since mobile always uses cards */}
          <div className="hidden sm:flex gap-1 p-1 bg-canvas rounded-xl border border-line">
            <button
              onClick={() => setView("table")}
              className={`p-1.5 rounded-lg transition-colors ${view === "table" ? "bg-surface shadow-soft text-brand-600" : "text-muted hover:text-ink"}`}
              title="Table view"
            >
              <Rows size={16} weight="bold" />
            </button>
            <button
              onClick={() => setView("cards")}
              className={`p-1.5 rounded-lg transition-colors ${view === "cards" ? "bg-surface shadow-soft text-brand-600" : "text-muted hover:text-ink"}`}
              title="Card view"
            >
              <Cards size={16} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : sorted.length === 0 ? (
        <EmptyState title="No users found" subtitle="Try adjusting your search or filter." />
      ) : view === "table" ? (
        <DataTable
          columns={fullCols}
          rows={sorted}
          selectable
          selectedIds={selected}
          onSelectChange={setSelected}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={(row) => setDrawerUser(row)}
          testid="admin-users-table"
          rowTestid="admin-user-row"
        />
      ) : (
        // Card view
        <div className="space-y-3">
          {sorted.map((u) => (
            <motion.div
              key={u.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              data-testid={`admin-user-${u.id}`}
            >
              <Card
                className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:border-brand-200 transition-all"
                onClick={() => setDrawerUser(u)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={u.full_name} src={u.profile_picture} />
                  <div className="min-w-0">
                    <p className="font-semibold text-ink truncate">
                      {u.full_name}
                      {u.is_admin && <span className="ml-2 text-xs text-brand-600 font-bold">admin</span>}
                    </p>
                    <p className="text-sm text-muted truncate">{u.email}</p>
                    <p className="text-xs text-muted mt-0.5">
                      <Star size={10} weight="fill" className="inline text-amber-400 mr-0.5" />
                      {Number(u.trust_score ?? 5).toFixed(1)} · {u.listings} listings · {u.active_loans} loans
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={u.account_status} />
                  <ArrowRight size={15} className="text-slate-300" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Bulk action floating bar */}
      <BulkActionBar
        count={selected.length}
        onClear={() => setSelected([])}
        actions={[
          { label: "Suspend", icon: <UserMinus size={14} />, onClick: bulkSuspend, loading: bulkBusy },
          { label: "Warn", icon: <BellRinging size={14} />, onClick: bulkNotify },
          { label: "Delete", icon: <Trash size={14} />, onClick: bulkDelete, danger: true, loading: bulkBusy },
        ]}
      />

      {/* User detail drawer */}
      <SlideDrawer
        open={!!drawerUser}
        onClose={() => setDrawerUser(null)}
        title={drawerUser?.full_name || "User"}
        testid="admin-user-drawer"
      >
        {drawerUser && <DrawerBody user={drawerUser} />}
      </SlideDrawer>

      {/* Suspend modal */}
      <Modal open={!!suspendTarget} onClose={() => setSuspendTarget(null)} title={`Suspend ${suspendTarget?.full_name}`} testid="admin-suspend-modal">
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
                  data-testid={`suspend-type-${t.value}`}
                >{t.label}</button>
              ))}
            </div>
          </div>
          <Textarea label="Reason (required)" rows={3} placeholder="Explain the reason…" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} data-testid="suspend-reason" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Their listings</p>
            <div className="flex gap-3">
              {[
                { value: "keep",   label: "Keep (hidden while suspended)", desc: "Re-shown on reinstate" },
                { value: "remove", label: "Remove permanently",             desc: "Cannot be undone" },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => setPostAction(o.value)}
                  className={`flex-1 text-left p-3 rounded-2xl border text-xs transition-colors ${postAction === o.value ? "border-brand-300 bg-brand-50" : "border-line bg-surface hover:border-brand-200"}`}
                  data-testid={`post-action-${o.value}`}
                >
                  <p className="font-semibold text-ink">{o.label}</p>
                  <p className="text-muted mt-0.5">{o.desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button variant="danger" className="flex-1" loading={busy === suspendTarget?.id} disabled={!suspendReason.trim()} onClick={confirmSuspend} data-testid="suspend-confirm">
              Confirm suspension
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reinstate modal */}
      <Modal open={!!reinstateTarget} onClose={() => setReinstateTarget(null)} title={`Reinstate ${reinstateTarget?.full_name}`} testid="admin-reinstate-modal">
        <div className="space-y-4">
          <Textarea label="Reason (optional)" rows={3} placeholder="Reason for reinstatement…" value={reinstateReason} onChange={(e) => setReinstateReason(e.target.value)} data-testid="reinstate-reason" />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setReinstateTarget(null)}>Cancel</Button>
            <Button variant="success" className="flex-1" loading={busy === reinstateTarget?.id} onClick={confirmReinstate} data-testid="reinstate-confirm">
              Reinstate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Generic confirmation dialog — in-app replacement for window.confirm */}
      <Modal open={!!confirmCfg} onClose={() => setConfirmCfg(null)} title={confirmCfg?.title} testid="admin-confirm-modal" size="sm">
        <p className="text-sm text-muted leading-relaxed">{confirmCfg?.message}</p>
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmCfg(null)} data-testid="admin-confirm-cancel">
            Cancel
          </Button>
          <Button
            variant={confirmCfg?.variant || "primary"}
            className="flex-1"
            onClick={() => { const fn = confirmCfg?.onConfirm; setConfirmCfg(null); if (fn) fn(); }}
            data-testid="admin-confirm-ok"
          >
            {confirmCfg?.confirmLabel || "Confirm"}
          </Button>
        </div>
      </Modal>

    </div>
  );
}
