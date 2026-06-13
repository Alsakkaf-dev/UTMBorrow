import { useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * Re-run loader when route matches and when user returns to the tab.
 * Fixes blank screens after bottom-nav taps without manual browser refresh.
 */
// loadFn = the data-loading callback; routePath = the path this hook should react to
export function useRouteRefresh(loadFn, routePath) {
  const location = useLocation();
  // Keep the latest loadFn in a ref so `run` stays stable (no re-subscribing on every render)
  const loadRef = useRef(loadFn);
  loadRef.current = loadFn;

  // Stable wrapper that calls whatever the current loadFn is
  const run = useCallback(() => {
    loadRef.current?.();
  }, []);

  // Re-load whenever we navigate to this route
  useEffect(() => {
    if (location.pathname === routePath) {
      run();
    }
  }, [location.pathname, routePath, run]);

  // Re-load when the tab becomes visible again (and we're still on this route)
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        location.pathname === routePath
      ) 
      {
        run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible); // cleanup listener
  }, [location.pathname, routePath, run]);

  return run; // expose run() so callers can trigger a manual refresh too
}
