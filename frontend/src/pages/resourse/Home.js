import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MagnifyingGlass, Star, X, FunnelSimple, ArrowRight, SlidersHorizontal,
  Sparkle, Lightning, Fire, MapPin,
} from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { toast } from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { useRealtimeEvent } from "../../lib/realtime";
import { useRouteRefresh } from "../../hooks/useRouteRefresh";
import { PageLoader, Avatar, Spinner, Select } from "../../components/ui";
import { PopularCard, ListCard } from "../../components/ExploreCards";
import ActiveLoanBanner from "../../components/ActiveLoanBanner";
import { staggerContainer, riseItem } from "../../lib/motion";

/* ── Time-of-day greeting ── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return { text: "Night owl 🌙", sub: "Browse while everyone sleeps" };
  if (h < 12) return { text: "Good morning ☀️", sub: "What will you borrow today?" };
  if (h < 17) return { text: "Good afternoon 👋", sub: "Find something you need" };
  if (h < 21) return { text: "Good evening 🌆", sub: "Discover what's available" };
  return { text: "Good night 🌙", sub: "Last chance to browse today" };
}

/* ── Condition level descriptions (SRS/SDD UC2202) — mirrors ItemForm copy ── */
const CONDITION_DESCRIPTIONS = {
  "Like New": "No visible wear, as good as new",
  Good: "Light use, works perfectly",
  Fair: "Noticeable wear, functional",
  Poor: "Heavy wear, still usable",
};

/* ── Category definitions ── */
const CATEGORY_META = [
  { label: "Electronics",   emoji: "💻", color: "bg-blue-50 text-blue-700 border-blue-100" },
  { label: "Textbooks",     emoji: "📚", color: "bg-amber-50 text-amber-700 border-amber-100" },
  { label: "Lab Equipment", emoji: "🧪", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  { label: "Tools",         emoji: "🔧", color: "bg-slate-50 text-slate-700 border-slate-200" },
  { label: "Clothing",      emoji: "👕", color: "bg-pink-50 text-pink-700 border-pink-100" },
  { label: "Other",         emoji: "📦", color: "bg-brand-50 text-brand-700 border-brand-100" },
];

/* ── Section header with gradient "See all" link ── */
function SectionHead({ title, to, icon, count }) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <div className="flex items-center gap-2">
        {icon && <span>{icon}</span>}
        <h2 className="font-head font-bold text-lg text-ink">{title}</h2>
        {count !== undefined && (
          <span className="text-xs font-bold text-muted bg-slate-100 px-1.5 py-0.5 rounded-full">{count}</span>
        )}
      </div>
      <Link
        to={to}
        className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 transition-colors"
      >
        See all <ArrowRight size={12} weight="bold" />
      </Link>
    </div>
  );
}

/* ── Animated search placeholder cycling ── */
const SEARCH_PLACEHOLDERS = [
  "Search laptops, cameras…",
  "Find sports equipment…",
  "Looking for textbooks?",
  "Borrow tools & gear…",
  "Search any item…",
];

function AnimatedSearchBar({ value, onChange, onFocus, isFocused }) {
  const [phIdx, setPhIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value) return;
    const t = setInterval(() => setPhIdx((i) => (i + 1) % SEARCH_PLACEHOLDERS.length), 2800);
    return () => clearInterval(t);
  }, [value]);

  return (
    <motion.div
      animate={isFocused ? { scale: 1.01 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`flex-1 flex items-center gap-3 h-13 px-4 rounded-2xl bg-surface border transition-all duration-200 shadow-soft ${
        isFocused
          ? "border-brand-400 ring-4 ring-brand-100 shadow-glow-sm"
          : "border-line"
      }`}
    >
      <MagnifyingGlass
        size={19}
        weight={isFocused ? "bold" : "regular"}
        className={`shrink-0 transition-colors ${isFocused ? "text-brand-500" : "text-slate-400"}`}
      />
      <div className="flex-1 min-w-0 relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder=""
          data-testid="home-search"
          className="w-full bg-transparent outline-none text-sm text-ink font-plex relative z-10"
        />
        {!value && (
          <AnimatePresence mode="wait">
            <motion.span
              key={phIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28 }}
              className="absolute inset-0 flex items-center text-sm text-slate-400 font-plex pointer-events-none"
            >
              {SEARCH_PLACEHOLDERS[phIdx]}
            </motion.span>
          </AnimatePresence>
        )}
      </div>
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            data-testid="home-search-clear"
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-ink transition-colors"
          >
            <X size={14} weight="bold" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Category bubbles row (Airbnb-style) ── */
// SRS UC2201: categories are multi-select. `active` is an array of labels;
// tapping a pill toggles membership, "All" clears the whole selection.
function CategoryRow({ active, onToggle, onClear, available }) {
  const items = CATEGORY_META.filter(
    (c) => !available.length || available.includes(c.label)
  );

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
      <motion.button
        whileTap={{ scale: 0.93 }}
        onClick={onClear}
        className={`category-pill shrink-0 border ${
          active.length === 0
            ? "bg-ink text-white border-ink shadow-soft"
            : "bg-surface text-muted border-line hover:border-brand-300 hover:text-ink"
        }`}
      >
        <span className="text-[14px]">✨</span>
        <span className="text-xs font-bold">All</span>
      </motion.button>

      {items.map((cat) => {
        const on = active.includes(cat.label);
        return (
          <motion.button
            key={cat.label}
            whileTap={{ scale: 0.93 }}
            onClick={() => onToggle(cat.label)}
            data-testid={`filter-chip-${cat.label}`}
            className={`category-pill shrink-0 border ${
              on
                ? "bg-brand-gradient text-white border-transparent shadow-glow-sm"
                : `${cat.color} hover:shadow-soft`
            }`}
          >
            <span className="text-[14px]">{cat.emoji}</span>
            <span className="text-xs font-bold">{cat.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ════════════════════════ Main Page ════════════════════════ */
export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const greeting = useMemo(getGreeting, []);

  const [loading, setLoading]   = useState(true);
  const [items, setItems]       = useState([]);
  const [activeLoan, setActiveLoan] = useState(null);

  // Search
  const [q, setQ]               = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching]         = useState(false);

  // Inline filter panel
  const [showFilters, setShowFilters] = useState(false);
  const [meta, setMeta]   = useState({ categories: [], conditions: [], colleges: [], faculties: [] });
  const [filterCategories, setFilterCategories] = useState([]);   // UC2201 multi-select
  const [filterCondition, setFilterCondition] = useState("");      // UC2202 minimum threshold
  const [filterCollege, setFilterCollege]     = useState("");
  const [filterFaculty, setFilterFaculty]     = useState("");
  const [sort, setSort]   = useState("");                          // "" | recent | distance_asc | distance_desc
  const [coords, setCoords] = useState(null);                      // UC2302 device GPS {lat,lng}
  const [locating, setLocating] = useState(false);

  const toggleCategory = (c) =>
    setFilterCategories((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  // UC2302: request device location once, fall back gracefully on denial.
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.info("Location is not available on this device. Please select your college instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort((s) => (s === "distance_asc" || s === "distance_desc" ? s : "distance_asc"));
        setLocating(false);
        toast.success("Showing items near your current location.");
      },
      () => {
        setLocating(false);
        toast.info("Location access denied. You can manually select your college instead.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  // Filtered feed
  const [filteredItems, setFilteredItems]   = useState([]);
  const [filterLoading, setFilterLoading]   = useState(false);
  const filterRef = useRef({});
  filterRef.current = { filterCategories, filterCondition, filterCollege, filterFaculty, sort, coords };

  const activeFilterCount =
    filterCategories.length +
    [filterCondition, filterCollege, filterFaculty, sort, coords].filter(Boolean).length;

  useEffect(() => {
    api.get("/items/meta").then(({ data }) => setMeta(data)).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, itemsRes] = await Promise.all([
        api.get("/dashboard"),
        api.get("/items"),
      ]);
      const active = dashRes.data.borrowing.find((t) => t.status === "Borrowed");
      setActiveLoan(active || null);
      setItems(itemsRes.data.items.slice(0, 16));
    } catch (err) {
      console.error("Failed to load home data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useRouteRefresh(fetchData, "/home");
  useRealtimeEvent("transaction.updated", fetchData);
  useRealtimeEvent("catalog.changed",     fetchData);
  useRealtimeEvent("notification.new",    fetchData);

  // Live search — debounced
  const query = q.trim();
  useEffect(() => {
    if (!query) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/items", { params: { q: query } });
        setSearchResults(data.items || []);
      } catch { setSearchResults([]); }
      finally  { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Faceted catalog query (UC2201/2202/2203 + UC2301-2303)
  useEffect(() => {
    const f = filterRef.current;
    const hasFilter =
      f.filterCategories.length || f.filterCondition || f.filterCollege ||
      f.filterFaculty || f.sort || f.coords;
    if (!hasFilter) { setFilteredItems([]); return; }
    setFilterLoading(true);
    const params = {};
    if (f.filterCategories.length) params.category = f.filterCategories.join(",");
    if (f.filterCondition) params.condition = f.filterCondition;
    if (f.filterCollege)   params.college   = f.filterCollege;
    if (f.filterFaculty)   params.faculty   = f.filterFaculty;
    if (f.sort)            params.sort      = f.sort;
    if (f.coords)          { params.lat = f.coords.lat; params.lng = f.coords.lng; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/items", { params });
        setFilteredItems(data.items || []);
      } catch { setFilteredItems([]); }
      finally  { setFilterLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [filterCategories, filterCondition, filterCollege, filterFaculty, sort, coords]);

  const clearFilters = () => {
    setFilterCategories([]);
    setFilterCondition("");
    setFilterCollege("");
    setFilterFaculty("");
    setSort("");
    setCoords(null);
  };

  const popular = useMemo(
    () => [...items].sort((a, b) => (b.owner?.trust_score ?? 0) - (a.owner?.trust_score ?? 0)).slice(0, 8),
    [items]
  );
  const nearYou = useMemo(() => items.slice(0, 10), [items]);

  const isFiltering = activeFilterCount > 0;
  const showSearch  = !!query;

  if (loading) return <PageLoader />;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="page-enter"
    >
      {/* ── 1. Greeting header ── */}
      <motion.div variants={riseItem} className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <Avatar name={user.full_name} src={user.profile_picture} size={46} />
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-status-borrowed ring-2 ring-canvas" />
          </div>
          <div className="min-w-0">
            <p className="font-head font-bold text-base text-ink leading-tight truncate">
              {greeting.text}
            </p>
            <p className="text-xs text-muted mt-0.5 truncate">{greeting.sub}</p>
          </div>
        </div>

        {/* Trust score pill */}
        {user.trust_score != null && (
          <motion.div
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate("/settings/reputation")}
            className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
          >
            <Star size={14} weight="fill" className="text-amber-400" />
            <span className="font-head font-bold text-sm text-ink">
              {Number(user.trust_score).toFixed(1)}
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* ── 2. Headline ── */}
      <motion.div variants={riseItem} className="mb-5">
        <h1 className="font-head font-extrabold text-[30px] leading-tight tracking-tight text-ink">
          Find your next{" "}
          <span className="text-gradient">borrow</span>
        </h1>
        <p className="text-sm text-muted mt-1">Campus peer-to-peer lending — free, fast, trusted</p>
      </motion.div>

      {/* ── 3. Search + filter button ── */}
      <motion.div variants={riseItem} className="flex items-center gap-2.5 mb-3">
        <AnimatedSearchBar
          value={q}
          onChange={setQ}
          isFocused={searchFocused}
          onFocus={() => setSearchFocused(true)}
        />

        {/* Advanced filter toggle */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => setShowFilters((s) => !s)}
          aria-label="Toggle filters"
          data-testid="home-filter"
          className={`relative w-13 h-13 shrink-0 rounded-2xl flex items-center justify-center transition-all shadow-soft ${
            showFilters || activeFilterCount > 0
              ? "bg-brand-gradient text-white border-transparent shadow-glow-sm"
              : "bg-surface border border-line text-ink hover:border-brand-300 hover:bg-brand-50"
          }`}
        >
          <SlidersHorizontal size={20} weight={activeFilterCount > 0 ? "fill" : "regular"} />
          <AnimatePresence>
            {activeFilterCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="absolute -top-1.5 -right-1.5 bg-status-cancelled text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-canvas font-bold"
              >
                {activeFilterCount}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* ── 4. Category bubbles row ── */}
      <AnimatePresence>
        {!showSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mb-4">
              <CategoryRow
                active={filterCategories}
                onToggle={toggleCategory}
                onClear={() => setFilterCategories([])}
                available={meta.categories}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 5. Advanced filter panel ── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-2" data-testid="home-filter-panel">
              <div className="bg-surface border border-line rounded-3xl p-4 shadow-soft">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                    <FunnelSimple size={12} weight="bold" /> Advanced filters
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      data-testid="clear-filters"
                      className="flex items-center gap-1 text-xs font-semibold text-status-cancelled hover:text-red-600 transition-colors"
                    >
                      <X size={12} weight="bold" /> Clear all
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <Select label="Min. condition" value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} data-testid="filter-condition">
                    <option value="">Any condition</option>
                    {/* UC2202: each level carries its description as a hover/long-press tooltip. */}
                    {meta.conditions.map((c) => <option key={c} value={c} title={CONDITION_DESCRIPTIONS[c]}>{c}</option>)}
                  </Select>
                  <Select label="College" value={filterCollege} onChange={(e) => setFilterCollege(e.target.value)} data-testid="filter-college">
                    <option value="">Any college</option>
                    {meta.colleges.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <p className="text-[10.5px] text-muted -mt-1 mb-2">Condition shows the selected level and better (e.g. “Good” includes Like New).</p>
                {/* Per-level descriptions so the meaning is visible on any device (UC2202). */}
                <div className="mb-3 space-y-0.5" data-testid="filter-condition-legend">
                  {meta.conditions.map((c) => (
                    <p key={c} className="text-[10.5px] text-muted" title={CONDITION_DESCRIPTIONS[c]} data-testid={`filter-condition-desc-${c}`}>
                      <span className="font-semibold text-ink">{c}</span> — {CONDITION_DESCRIPTIONS[c]}
                    </p>
                  ))}
                </div>

                <Select label="Faculty" value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)} data-testid="filter-faculty">
                  <option value="">Any faculty</option>
                  {meta.faculties.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>

                {/* Proximity & sorting (SRS UC2301-2303) */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Select label="Sort by" value={sort} onChange={(e) => setSort(e.target.value)} data-testid="filter-sort">
                    <option value="">Recommended</option>
                    <option value="recent">Recently added</option>
                    <option value="distance_asc">Distance: nearest first</option>
                    <option value="distance_desc">Distance: farthest first</option>
                  </Select>
                  <div className="flex flex-col justify-end">
                    <button
                      type="button"
                      onClick={useMyLocation}
                      data-testid="filter-use-location"
                      className={`flex items-center justify-center gap-1.5 h-[42px] rounded-2xl text-xs font-semibold border transition-colors ${
                        coords ? "bg-brand-gradient text-white border-transparent" : "bg-surface border-line text-ink hover:border-brand-300 hover:bg-brand-50"
                      }`}
                    >
                      <MapPin size={15} weight="bold" />
                      {locating ? "Locating…" : coords ? "Using your location" : "Use my location"}
                    </button>
                  </div>
                </div>
                {coords && (
                  <p className="text-[10.5px] text-muted mt-2">Showing items within 2&nbsp;km of your current location. <button type="button" className="text-brand-600 font-semibold" onClick={() => setCoords(null)}>Clear</button></p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active filter pills (panel closed) ── */}
      <AnimatePresence>
        {!showFilters && (filterCondition || filterCollege || filterFaculty || sort || coords) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 flex-wrap pt-1 pb-2">
              {filterCondition && (
                <motion.button
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setFilterCondition("")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-200 hover:bg-brand-100 transition-colors"
                >
                  {filterCondition} <X size={10} weight="bold" />
                </motion.button>
              )}
              {filterCollege && (
                <motion.button
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setFilterCollege("")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-200 hover:bg-brand-100 transition-colors"
                >
                  {filterCollege} <X size={10} weight="bold" />
                </motion.button>
              )}
              {filterFaculty && (
                <motion.button
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setFilterFaculty("")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-200 hover:bg-brand-100 transition-colors"
                >
                  {filterFaculty} <X size={10} weight="bold" />
                </motion.button>
              )}
              {sort && (
                <motion.button
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setSort("")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-200 hover:bg-brand-100 transition-colors"
                >
                  {{ recent: "Recently added", distance_asc: "Nearest first", distance_desc: "Farthest first" }[sort]} <X size={10} weight="bold" />
                </motion.button>
              )}
              {coords && (
                <motion.button
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setCoords(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold border border-brand-200 hover:bg-brand-100 transition-colors"
                >
                  <MapPin size={11} weight="bold" /> Near me <X size={10} weight="bold" />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 6. Content area ── */}
      <div className="mt-1">

        {/* ── Search results ── */}
        {showSearch ? (
          <div data-testid="home-search-results">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-head font-bold text-lg text-ink">
                  Search results
                </h2>
                {searchResults && !searching && (
                  <p className="text-xs text-muted mt-0.5">{searchResults.length} item{searchResults.length !== 1 ? "s" : ""} found</p>
                )}
              </div>
              <button onClick={() => setQ("")} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <X size={12} weight="bold" /> Clear
              </button>
            </div>
            {searching && (!searchResults || searchResults.length === 0) ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <Spinner className="w-8 h-8" />
                <p className="text-sm text-muted">Searching…</p>
              </div>
            ) : searchResults && searchResults.length === 0 ? (
              <div className="text-center py-14 bg-surface border border-line rounded-3xl">
                <p className="text-3xl mb-3">🔍</p>
                <p className="font-head font-bold text-ink">No results for "{query}"</p>
                <p className="text-sm text-muted mt-1">Try a different keyword or category</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {(searchResults || []).map((it, idx) => (
                  <ListCard key={it.id} item={it} index={idx} />
                ))}
              </div>
            )}
          </div>

        /* ── Filtered results ── */
        ) : isFiltering ? (
          <div data-testid="home-filtered-results">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-head font-bold text-lg text-ink flex items-center gap-2">
                  <Sparkle size={18} className="text-brand-500" />
                  {filterCategories.join(", ") || "Filtered"}
                </h2>
                {!filterLoading && (
                  <p className="text-xs text-muted mt-0.5">{filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}</p>
                )}
              </div>
              <button onClick={clearFilters} className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                <X size={12} weight="bold" /> Clear
              </button>
            </div>
            {filterLoading ? (
              <div className="flex flex-col items-center py-16 gap-3">
                <Spinner className="w-8 h-8" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-14 bg-surface border border-line rounded-3xl">
                <p className="text-3xl mb-3">📭</p>
                <p className="font-head font-bold text-ink">No items match</p>
                <p className="text-sm text-muted mt-1">Try adjusting your filters</p>
                <button onClick={clearFilters} className="mt-4 text-sm font-bold text-brand-600">Clear filters</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredItems.map((it, idx) => (
                  <ListCard key={it.id} item={it} index={idx} />
                ))}
              </div>
            )}
          </div>

        /* ── Default discovery feed ── */
        ) : (
          <>
            {/* Active loan banner */}
            <ActiveLoanBanner
              loan={activeLoan}
              onReturn={() => activeLoan && navigate(`/transactions/${activeLoan.id}`, { state: { showQR: true } })}
              onOpen={() => activeLoan && navigate(`/transactions/${activeLoan.id}`)}
            />

            {/* Most popular section */}
            <div className="mb-7">
              <SectionHead
                title="Most popular"
                to="/home/popular"
                icon={<Fire size={18} className="text-orange-500" weight="fill" />}
                count={popular.length}
              />
              {popular.length === 0 ? (
                <div className="text-center py-10 bg-surface border border-line rounded-3xl">
                  <p className="text-3xl mb-2">📦</p>
                  <p className="text-sm text-muted">No items listed yet. Be the first!</p>
                </div>
              ) : (
                <div className="flex gap-3.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-2">
                  {popular.map((it) => (
                    <PopularCard key={it.id} item={it} />
                  ))}
                </div>
              )}
            </div>

            {/* Near you section */}
            <div>
              <SectionHead
                title="Near you"
                to="/home/nearby"
                icon={<Lightning size={18} className="text-brand-500" weight="fill" />}
                count={nearYou.length}
              />
              {nearYou.length === 0 ? (
                <div className="text-center py-10 bg-surface border border-line rounded-3xl">
                  <p className="text-3xl mb-2">🌍</p>
                  <p className="text-sm text-muted">Nothing nearby yet — be the first to lend.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {nearYou.map((it, idx) => (
                    <ListCard key={it.id} item={it} index={idx} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
