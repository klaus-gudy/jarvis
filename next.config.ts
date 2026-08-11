import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /**
     * Every page here is dynamic — they all read the session cookie — and
     * Next 15 changed the `dynamic` client-cache default to 0, so returning to
     * a page you were just on re-ran its queries from scratch. Holding the
     * rendered segment for half a minute makes moving around the app feel
     * instant without letting anything go meaningfully stale:
     *
     * - mutations already call `revalidatePath` server-side and
     *   `router.refresh()` client-side, and both evict this cache, so a change
     *   you just made is never the thing being cached;
     * - the window is short enough that another user's change shows up on the
     *   next navigation after it, not minutes later.
     *
     * `static` is left at its 5-minute default; nothing here is static anyway.
     */
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
