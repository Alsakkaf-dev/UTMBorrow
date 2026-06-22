import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Star, Trophy, SortDescending } from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { useRealtimeEvent } from "../../lib/realtime";
import { Spinner } from "../../components/ui";
import { ListCard } from "../../components/ExploreCards";

const SORT_OPTIONS = [
  { value: "trust", label: "Top rated" },
  { value: "title", label: "A → Z" },
  { value: "newest", label: "Newest" },
];

export default function PopularAll() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("trust");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/items");
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeEvent("catalog.changed", () => load(true));
  useRealtimeEvent("transaction.updated", () => load(true));

  const sorted = [...items].sort((a, b) => {
    if (sort === "trust") return (b.owner?.trust_score ?? 0) - (a.owner?.trust_score ?? 0);
    if (sort === "title") return a.title.localeCompare(b.title);
    return 0;
  });

  return (
    <div className="animate-fade-up">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate("/home")}
          aria-label="Back to Home"
          className="w-10 h-10 rounded-2xl bg-surface border border-line shadow-soft flex items-center justify-center text-ink hover:border-brand-300 transition-colors shrink-0"
          data-testid="popular-back"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="label-eyebrow">Discovery</p>
          <h1 className="font-head font-extrabold text-[22px] leading-tight tracking-tight text-ink flex items-center gap-2">
            <Trophy size={22} weight="fill" className="text-amber-400 shrink-0" />
            Most Popular
          </h1>
        </div>
      </div>

      {/* ── Sort bar ── */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        <span className="shrink-0 flex items-center gap-1 text-xs text-muted font-medium">
          <SortDescending size={15} /> Sort
        </span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSort(opt.value)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap border transition-all ${
              sort === opt.value
                ? "bg-brand-gradient text-white border-transparent shadow-glow-sm"
                : "bg-surface border-line text-muted hover:border-brand-300 hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Podium trio ── */}
      {!loading && sorted.length >= 3 && (
        <div className="mb-6">
          <div className="flex items-end justify-center gap-3 px-2">
            <PodiumTile item={sorted[1]} rank={2} navigate={navigate} />
            <PodiumTile item={sorted[0]} rank={1} navigate={navigate} />
            <PodiumTile item={sorted[2]} rank={3} navigate={navigate} />
          </div>
        </div>
      )}

      {/* ── Full list ── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-head font-bold text-base text-ink">All items</h2>
        {!loading && (
          <span className="text-xs text-muted font-medium">{sorted.length} available</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-line rounded-3xl text-sm text-muted">
          No items available right now.
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((it, idx) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3) }}
              className="relative"
            >
              {idx < 3 && (
                <span className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-amber-400 text-white text-[11px] font-extrabold flex items-center justify-center shadow-soft">
                  {idx + 1}
                </span>
              )}
              <div className={idx < 3 ? "pl-4" : ""}>
                <ListCard item={it} index={idx} />
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function PodiumTile({ item, rank, navigate }) {
  const RANK_META = {
    1: { height: "h-[148px]", crown: "🥇", ring: "ring-2 ring-amber-400" },
    2: { height: "h-[116px]", crown: "🥈", ring: "ring-2 ring-slate-300" },
    3: { height: "h-[100px]", crown: "🥉", ring: "ring-2 ring-orange-300" },
  };
  const m = RANK_META[rank];
  const trust = item.owner?.trust_score;

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate(`/items/${item.id}`)}
      className={`relative flex-1 max-w-[120px] ${m.height} rounded-3xl overflow-hidden shadow-card group ${m.ring}`}
    >
      {item.photo_url ? (
        <img src={item.photo_url} alt={item.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="absolute inset-0 bg-brand-gradient flex items-center justify-center">
          <span className="font-head font-extrabold text-white/90 text-3xl">{item.title?.[0]?.toUpperCase()}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
      <span className="absolute top-2 left-1/2 -translate-x-1/2 text-xl">{m.crown}</span>
      <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
        <p className="font-head font-bold text-[13px] leading-tight line-clamp-1">{item.title}</p>
        {typeof trust === "number" && (
          <span className="flex items-center gap-0.5 text-[11px] text-white/90 mt-0.5">
            <Star size={11} weight="fill" className="text-amber-400" /> {trust.toFixed(1)}
          </span>
        )}
      </div>
    </motion.button>
  );
}
