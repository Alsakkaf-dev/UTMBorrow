import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Star, Tag, Sparkle, Package } from "@phosphor-icons/react";
import { StatusBadge } from "./ui";

/* ── Category emoji map ── */
const CATEGORY_EMOJI = {
  "Electronics":   "💻",
  "Textbooks":     "📚",
  "Lab Equipment": "🧪",
  "Tools":         "🔧",
  "Clothing":      "👕",
  "Other":         "📦",
};

/* ── Condition dot color ── */
const CONDITION_COLOR = {
  "New":        "#10B981",
  "Like New":   "#6366F1",
  "Good":       "#3B82F6",
  "Fair":       "#F59E0B",
  "Poor":       "#EF4444",
};

function Placeholder({ title, gradient = "bg-brand-gradient", letterClass = "text-4xl" }) {
  return (
    <div className={`w-full h-full flex items-center justify-center ${gradient}`}>
      <span className={`font-head font-extrabold text-white/90 ${letterClass}`}>
        {title?.[0]?.toUpperCase() || "?"}
      </span>
    </div>
  );
}

/* ──────────────────────── Popular Card (Airbnb-style vertical) ──────────────────────── */
export function PopularCard({ item }) {
  const navigate = useNavigate();
  const trust    = item.owner?.trust_score;
  const emoji    = CATEGORY_EMOJI[item.category] || "📦";

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      onClick={() => navigate(`/items/${item.id}`)}
      data-testid={`popular-card-${item.id}`}
      className="relative w-[220px] h-[280px] shrink-0 rounded-4xl overflow-hidden shadow-card text-left group cursor-pointer"
    >
      {/* Photo */}
      {item.photo_url ? (
        <img
          src={item.photo_url}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
          style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
        />
      ) : (
        <Placeholder title={item.title} letterClass="text-6xl" />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-hero-overlay-lg" />

      {/* Top-left: category chip */}
      <div className="absolute top-3 left-3 flex items-center gap-1 glass-card px-2.5 py-1 rounded-full shadow-soft">
        <span className="text-[13px]">{emoji}</span>
        <span className="text-[11px] font-bold text-ink/90">{item.category}</span>
      </div>

      {/* Top-right: trust badge */}
      {typeof trust === "number" && (
        <div className="absolute top-3 right-3 flex items-center gap-1 glass-card px-2 py-1 rounded-full shadow-soft">
          <Star size={12} weight="fill" className="text-amber-400" />
          <span className="text-[11px] font-bold text-ink/90">{trust.toFixed(1)}</span>
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="font-head font-bold text-[16px] leading-snug line-clamp-2 text-white mb-2">
          {item.title}
        </h3>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[11px] text-white/80 truncate">
            <MapPin size={12} weight="fill" className="shrink-0" />
            {item.location_college}
          </span>
          {item.condition && (
            <span
              className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full text-white/90"
              style={{ background: `${CONDITION_COLOR[item.condition] || "#6366F1"}55`, border: `1px solid ${CONDITION_COLOR[item.condition] || "#6366F1"}80` }}
            >
              {item.condition}
            </span>
          )}
        </div>
      </div>

      {/* Shine on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-card-shine pointer-events-none" />
    </motion.button>
  );
}

/* ──────────────────────── List Card (full-width horizontal) ──────────────────────── */
export function ListCard({ item, index = 0 }) {
  const navigate = useNavigate();
  const trust    = item.owner?.trust_score;
  const emoji    = CATEGORY_EMOJI[item.category] || "📦";

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1], delay: Math.min(index * 0.045, 0.28) }}
      whileTap={{ scale: 0.985 }}
      whileHover={{ y: -2 }}
      onClick={() => navigate(`/items/${item.id}`)}
      data-testid={`list-card-${item.id}`}
      className="w-full flex gap-3.5 p-3 bg-surface border border-line rounded-3xl shadow-soft hover:shadow-card hover:border-brand-200 transition-all text-left group"
    >
      {/* Thumbnail */}
      <div className="relative w-[96px] h-[96px] shrink-0 rounded-2xl overflow-hidden">
        {item.photo_url ? (
          <img
            src={item.photo_url}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
          />
        ) : (
          <Placeholder title={item.title} letterClass="text-3xl" />
        )}
        {/* Category emoji overlay */}
        <div className="absolute bottom-1.5 left-1.5 w-6 h-6 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-[13px] shadow-soft">
          {emoji}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between gap-1">
        {/* Title + trust */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-head font-semibold text-[15px] text-ink line-clamp-1 leading-snug flex-1">
            {item.title}
          </h3>
          {typeof trust === "number" && (
            <span className="flex items-center gap-0.5 text-xs font-bold text-ink shrink-0">
              <Star size={12} weight="fill" className="text-amber-400" />
              {trust.toFixed(1)}
            </span>
          )}
        </div>

        {/* Category + condition */}
        <div className="flex items-center gap-2 text-[12px] text-muted flex-wrap">
          <span className="flex items-center gap-1">
            <Tag size={12} weight="fill" className="text-brand-400 shrink-0" />
            {item.category}
          </span>
          {item.condition && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1">
                <Sparkle size={12} weight="fill" className="text-brand-400 shrink-0" />
                {item.condition}
              </span>
            </>
          )}
        </div>

        {/* Location + status */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[12px] text-muted truncate">
            <MapPin size={12} weight="fill" className="text-brand-400 shrink-0" />
            {item.location_college}
          </span>
          <StatusBadge status={item.availability_status} className="shrink-0 scale-90 origin-right" />
        </div>
      </div>
    </motion.button>
  );
}

/* ──────────────────────── Featured Card (wide spotlight) ──────────────────────── */
export function FeaturedCard({ item }) {
  const navigate = useNavigate();
  const trust    = item.owner?.trust_score;
  const emoji    = CATEGORY_EMOJI[item.category] || "📦";

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      onClick={() => navigate(`/items/${item.id}`)}
      data-testid={`featured-card-${item.id}`}
      className="relative w-full h-[200px] rounded-4xl overflow-hidden shadow-card text-left group"
    >
      {item.photo_url ? (
        <img
          src={item.photo_url}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
        />
      ) : (
        <Placeholder title={item.title} letterClass="text-8xl" />
      )}

      <div className="absolute inset-0 bg-hero-overlay-lg" />

      {/* Top badges */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <span className="glass-card px-3 py-1.5 rounded-full text-[12px] font-bold text-ink/90 flex items-center gap-1 shadow-soft">
          <span>{emoji}</span> {item.category}
        </span>
        {typeof trust === "number" && (
          <span className="glass-card px-2.5 py-1 rounded-full text-[12px] font-bold text-ink/90 flex items-center gap-1 shadow-soft">
            <Star size={13} weight="fill" className="text-amber-400" /> {trust.toFixed(1)}
          </span>
        )}
      </div>

      {/* Featured label */}
      <div className="absolute top-4 right-4 bg-brand-gradient px-2.5 py-1 rounded-full shadow-glow-sm">
        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Featured</span>
      </div>

      {/* Bottom */}
      <div className="absolute inset-x-0 bottom-0 p-4">
        <h3 className="font-head font-bold text-xl leading-snug line-clamp-1 text-white">{item.title}</h3>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1.5 text-[12px] text-white/80">
            <MapPin size={13} weight="fill" /> {item.location_college}
          </span>
          {item.owner?.full_name && (
            <span className="text-[12px] text-white/70">
              by {item.owner.full_name.split(" ")[0]}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ──────────────────────── Compact Grid Card ──────────────────────── */
export function GridCard({ item }) {
  const navigate = useNavigate();
  const trust    = item.owner?.trust_score;

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 350, damping: 26 }}
      onClick={() => navigate(`/items/${item.id}`)}
      data-testid={`grid-card-${item.id}`}
      className="w-full aspect-[3/4] rounded-3xl overflow-hidden shadow-card text-left group relative"
    >
      {item.photo_url ? (
        <img
          src={item.photo_url}
          alt={item.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          style={{ transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)" }}
        />
      ) : (
        <Placeholder title={item.title} letterClass="text-5xl" />
      )}
      <div className="absolute inset-0 bg-hero-overlay" />

      {typeof trust === "number" && (
        <span className="absolute top-2.5 left-2.5 glass-card px-1.5 py-0.5 rounded-full text-[11px] font-bold text-ink/90 flex items-center gap-0.5">
          <Star size={11} weight="fill" className="text-amber-400" />
          {trust.toFixed(1)}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="font-head font-bold text-[13px] line-clamp-1 text-white leading-snug">{item.title}</p>
        <p className="text-[11px] text-white/70 flex items-center gap-1 mt-0.5">
          <Package size={11} weight="fill" /> {item.condition || item.category}
        </p>
      </div>
    </motion.button>
  );
}
