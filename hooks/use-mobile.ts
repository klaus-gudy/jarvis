import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

// matchMedia is an external store, so subscribing to it directly avoids the
// setState-in-effect pattern (and the extra render it causes on mount).
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // The server can't know the viewport; assume desktop so the sidebar renders
    // in its docked form and hydration matches the non-mobile markup.
    () => false
  )
}
