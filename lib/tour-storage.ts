import { TOURS_VERSION } from "@/lib/tours";

/**
 * Which tours this browser has already been shown.
 *
 * localStorage rather than a column on the user: it is a per-device UI
 * preference, not organization data, and putting it in the database would mean
 * a migration and a write on every page a first-time user opens.
 *
 * Exposed as an external store so React reads it through `useSyncExternalStore`
 * — the same pattern `useIsMobile` uses here, and the reason "Reset all tours"
 * updates every subscriber without a re-render being wired up by hand. The
 * server snapshot is empty, so the first client render matches the server's and
 * nothing about a tour can cause a hydration mismatch.
 */

const KEY = `rentops.tours.seen.v${TOURS_VERSION}`;

/** Same-tab writes don't fire `storage`, so changes are announced explicitly. */
const CHANGE_EVENT = "rentops:tours-changed";

const EMPTY: readonly string[] = Object.freeze([]);

/*
 * `getSnapshot` must return the *same reference* while the underlying value is
 * unchanged, or `useSyncExternalStore` re-renders forever. Parsing on every call
 * would return a new array each time, so the parsed value is cached and only
 * rebuilt when the raw string actually differs.
 */
let cachedRaw: string | null = null;
let cachedValue: readonly string[] = EMPTY;

function getSnapshot(): readonly string[] {
  const raw = window.localStorage.getItem(KEY);
  if (raw === cachedRaw) return cachedValue;

  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedValue = Object.freeze(
      Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []
    );
  } catch {
    // Corrupt or hand-edited value: treat as "nothing seen" rather than throw.
    cachedValue = EMPTY;
  }
  return cachedValue;
}

function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Fired by other tabs, so resetting tours in one settles them all.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(ids: readonly string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private mode, or storage full. The tour still runs for this visit; it
    // just won't be remembered, which is better than breaking the page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export const tourStorage = {
  subscribe,
  getSnapshot,
  getServerSnapshot,

  markSeen(id: string) {
    const seen = getSnapshot();
    if (seen.includes(id)) return;
    write([...seen, id]);
  },

  /** Forgets one tour, so it auto-starts again on its page. */
  forget(id: string) {
    write(getSnapshot().filter((seen) => seen !== id));
  },

  resetAll() {
    write([]);
  },
};
