import React from "react";

// Building block: one grey shimmer placeholder (the `skeleton` class lives in index.css).
// Pass width/height via className, e.g. <Skeleton className="h-4 w-1/2" />
export function Skeleton({ className = "" }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

// Placeholder shaped like a catalog item card: square image + two text lines
export function ItemCardSkeleton() {
  return (
    <div className="bg-surface rounded-2.5xl border border-line overflow-hidden shadow-soft">
      <Skeleton className="aspect-square w-full rounded-none" /> {/* image area */}
      <div className="p-3.5 space-y-2">
        <Skeleton className="h-4 w-3/4" /> {/* title line */}
        <Skeleton className="h-3 w-1/2" /> {/* subtitle line */}
      </div>
    </div>
  );
}

// Catalog loading grid: `count` item-card placeholders in a 2-column layout
export function CatalogSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 gap-3.5" data-testid="catalog-skeleton">
      {Array.from({ length: count }).map((_, i) => <ItemCardSkeleton key={i} />)}
    </div>
  );
}

// Placeholder shaped like a list row: square thumbnail + two text lines
export function RowSkeleton() {
  return (
    <div className="bg-surface rounded-2xl border border-line p-4 flex items-center gap-3 shadow-soft">
      <Skeleton className="w-14 h-14 rounded-xl shrink-0" /> {/* thumbnail */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

// List loading state: a vertical stack of `count` row placeholders
export function ListSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <RowSkeleton key={i} />)}
    </div>
  );
}
