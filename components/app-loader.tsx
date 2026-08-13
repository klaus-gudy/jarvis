import { RentopsLogo } from "@/components/logo";

/**
 * The wait every route shows while its data is in flight.
 *
 * Replaces the per-route skeletons: those earn their keep on a slow, uncertain
 * load, where holding the page's shape stops the reader losing their place.
 * Here the wait is a second or two, and a dozen bespoke grey outlines flashing
 * past read as the interface breaking rather than working.
 *
 * So: the mark itself, with rings running out of it like a drop hitting water,
 * and one gold arc turning. Built from the app's own tokens — `--stat-accent`
 * is the same gold as the active sidebar item, the occupancy bars and the
 * toast — so it belongs to the app rather than being a generic spinner parked
 * in the middle of it.
 */
export function AppLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-7"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex size-28 items-center justify-center">
        {/* Three rings on one keyframe, staggered a third of a cycle apart, so
            one is always leaving as the next arrives. */}
        <span className="app-loader-ring" />
        <span className="app-loader-ring [animation-delay:600ms]" />
        <span className="app-loader-ring [animation-delay:1200ms]" />

        {/* A single gold quadrant on an otherwise transparent border — the
            turning edge, not a full circle, so it reads as motion. */}
        <span className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-stat-accent animation-duration-[1.1s]" />

        <RentopsLogo className="relative size-12 drop-shadow-sm" />
      </div>

      <p className="app-loader-label font-heading text-sm font-medium tracking-wide">
        {label}
      </p>
    </div>
  );
}
