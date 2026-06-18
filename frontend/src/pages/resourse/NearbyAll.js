import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Fire,
  FunnelSimple,
  X,
  Lightning,
} from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { useRealtimeEvent, useRealtimeStatus } from "../../lib/realtime";
import { Spinner, Chip, Select, LiveDot } from "../../components/ui";
import { ListCard } from "../../components/ExploreCards";

export default function NearbyAll() {
  const navigate = useNavigate();
  const status = useRealtimeStatus();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ categories: [], conditions: [], colleges: [], faculties: [] });

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const [filterCollege, setFilterCollege] = useState("");
  const filterRef = useRef({});
  filterRef.current = { filterCategory, filterCondition, filterCollege };
  const activeFilterCount = [filterCategory, filterCondition, filterCollege].filter(Boolean).length;

  useEffect(() => {
    api.get("/items/meta").then(({ data }) => setMeta(data)).catch(() => {});
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const f = filterRef.current;
    const params = {};
    if (f.filterCategory) params.category = f.filterCategory;
    if (f.filterCondition) params.condition = f.filterCondition;
    if (f.filterCollege) params.college = f.filterCollege;
    try {
      const { data } = await api.get("/items", { params });
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(), 200);
    return () => clearTimeout(t);
  }, [filterCategory, filterCondition, filterCollege, load]);

  useRealtimeEvent("catalog.changed", () => load(true));
  useRealtimeEvent("transaction.updated", () => load(true));

  const clearFilters = () => {
    setFilterCategory("");
    setFilterCondition("");
    setFilterCollege("");
  };

  return (
    <div className="animate-fade-up">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={() => navigate("/home")}
          aria-label="Back to Home"
          className="w-10 h-10 rounded-2xl bg-surface border border-line shadow-soft flex items-center justify-center text-ink hover:border-brand-300 transition-colors shrink-0"
          data-testid="nearby-back"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="label-eyebrow">Discovery</p>
          <h1 className="font-head font-extrabold text-[22px] leading-tight tracking-tight text-ink flex items-center gap-2">
            <Fire size={22} weight="fill" className="text-orange-500 shrink-0" />
            Near You
          </h1>
        </div>
        <LiveDot status={status} />
      </div>

      {/* ── Category chips ── */}
      {meta.categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 mb-4">
          <Chip active={!filterCategory} onClick={() => setFilterCategory("")}>
            All
          </Chip>
          {meta.categories.map((c) => (
            <Chip
              key={c}
              active={filterCategory === c}
              onClick={() => setFilterCategory((prev) => (prev === c ? "" : c))}
              data-testid={`nearby-chip-${c}`}
            >
              {c}
            </Chip>
          ))}
        </div>
      )}

      {/* ── Filter toggle ── */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Lightning size={17} weight="fill" className="text-brand-500" />
          <span className="font-head font-bold text-base text-ink">Available now</span>
          {!loading && (
            <span className="text-xs text-muted font-medium">· {items.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            showFilters || activeFilterCount > 0
              ? "bg-brand-gradient text-white border-transparent shadow-glow-sm"
              : "bg-surface border-line text-muted hover:border-brand-300 hover:text-ink"
          }`}
          data-testid="nearby-filter-toggle"
        >
          <FunnelSimple size={14} weight={activeFilterCount > 0 ? "bold" : "regular"} />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white/30 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Inline filter dropdowns ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="bg-surface border border-line rounded-3xl p-4 shadow-soft grid grid-cols-2 gap-3 my-3" data-testid="nearby-filter-panel">
              <Select
                label="Condition"
                value={filterCondition}
                onChange={(e) => setFilterCondition(e.target.value)}
                data-testid="nearby-filter-condition"
              >
                <option value="">Any</option>
                {meta.conditions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>

              <Select
                label="College"
                value={filterCollege}
                onChange={(e) => setFilterCollege(e.target.value)}
                data-testid="nearby-filter-college"
              >
                <option value="">Any</option>
                {meta.colleges.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>

              <div className="col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-medium text-muted hover:text-status-cancelled flex items-center gap-1 transition-colors"
                  data-testid="nearby-clear-filters"
                >
                  <X size={14} /> Clear all
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Items list ── */}
      <div className="mt-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner className="w-8 h-8" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 bg-surface border border-line rounded-3xl text-sm text-muted">
            {activeFilterCount > 0
              ? "No items match these filters. Try adjusting them."
              : "Nothing nearby yet — be the first to lend something."}
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((it, idx) => (
              <ListCard
                key={it.id}
                item={it}
                index={idx}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
