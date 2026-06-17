import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Star } from "@phosphor-icons/react";
import { StatusBadge } from "./ui";

export default function ItemCard({ item, showStatus = false, index = 0, highlight = false, variant = "grid" }) {
  const navigate = useNavigate();
  const trust = item.owner?.trust_score;
  const isCarousel = variant === "carousel";

  return (
    <motion.button
      layout={!isCarousel}
      initial={isCarousel ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={isCarousel ? undefined : { opacity: 1, y: 0, scale: 1 }}
      exit={isCarousel ? undefined : { opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: [0.22, 1, 0.36, 1] }}
      whileHover={isCarousel ? undefined : { y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/items/${item.id}`)}
      data-testid={`item-card-${item.id}`}
      className={`text-left bg-surface overflow-hidden flex flex-col rounded-3xl border shadow-card hover:shadow-pop transition-shadow duration-300 group w-full ${
        highlight ? "border-brand-400 ring-4 ring-brand-100" : "border-line"
      } ${isCarousel ? "h-[240px]" : ""}`}
    >
      <div className={`w-full relative overflow-hidden shrink-0 ${isCarousel ? "h-[130px]" : "aspect-square"}`}>
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-brand-gradient">
            <span className={`font-head font-extrabold text-white/90 ${isCarousel ? "text-4xl" : "text-5xl"}`}>{item.title?.[0]?.toUpperCase()}</span>
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 glass text-ink text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-soft">
          {item.category}
        </span>
        {showStatus && <span className="absolute top-2.5 right-2.5"><StatusBadge status={item.availability_status} /></span>}
        {highlight && (
          <span className="absolute bottom-2.5 left-2.5 bg-brand-gradient text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-glow-sm animate-pulse-soft">
            New
          </span>
        )}
      </div>
      <div className={`p-3.5 flex flex-col gap-1.5 flex-1 min-h-0 ${isCarousel ? "justify-between" : ""}`}>
        <h3 className={`font-head font-semibold text-ink truncate ${isCarousel ? "text-sm leading-snug line-clamp-2" : "text-[15px]"}`}>{item.title}</h3>
        <div className="text-xs text-muted flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 truncate"><MapPin size={13} weight="fill" className="text-brand-400 shrink-0" /> {item.location_college}</span>
          {typeof trust === "number" ? (
            <span className="flex items-center gap-0.5 font-semibold text-ink shrink-0">
              <Star size={12} weight="fill" className="text-amber-400" /> {trust.toFixed(1)}
            </span>
          ) : (
            <span className="font-medium text-ink shrink-0">{item.condition}</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
