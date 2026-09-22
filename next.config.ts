import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /**
   * The dev overlay's badge defaults to the bottom-left corner, which is
   * exactly where the lease-template editor puts its floating actions on a
   * phone — the badge sat on top of Save. It only exists in development, so
   * moving it costs nothing and makes the mobile editor testable without
   * fighting a button that will not ship.
   */
  devIndicators: { position: "bottom-right" },

  /**
   * `amqplib` opens raw TCP sockets and resolves its own frame codecs at
   * runtime — bundling it into the server build breaks both. Next auto-externals
   * a list of known packages (`pg` and `@prisma/client` among them); amqplib
   * isn't on it, so it has to be named here.
   */
  serverExternalPackages: ["amqplib"],

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

    /**
     * Turns on React's `<ViewTransition>` integration, used in
     * `app/(app)/layout.tsx` to animate the content area on navigation. Next
     * marks route navigations as React Transitions, which is what activates
     * the component — a plain `setState` would not.
     *
     * The flag only enables the integration; without browser support the app
     * behaves exactly as before, the transition simply doesn't animate.
     */
    viewTransition: true,
  },
};

export default nextConfig;
