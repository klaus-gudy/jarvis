"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { TourOverlay } from "@/components/tour/tour-overlay";
import { tourStorage } from "@/lib/tour-storage";
import { findTourForPath, type Tour, type TourStep } from "@/lib/tours";

type TourContextValue = {
  /** The tour for the page currently open, if it has one. */
  availableTour: Tour | undefined;
  /** Replays the current page's tour from the top. */
  restartCurrent: () => void;
  /** Forgets every tour, so each greets its page again. */
  resetAll: () => void;
  isRunning: boolean;
};

const TourContext = React.createContext<TourContextValue | null>(null);

export function useTour() {
  const context = React.useContext(TourContext);
  if (!context) throw new Error("useTour must be used inside <TourProvider>");
  return context;
}

/**
 * Steps whose target is actually on the page, plus every untargeted step.
 *
 * Resolved when the tour starts rather than when it is written, because what
 * exists depends on the data: a first-time user's Properties page has no
 * property card to point at, and a step spotlighting nothing would be a
 * dead frame in the middle of their very first impression of the app.
 */
function resolveSteps(tour: Tour): TourStep[] {
  return tour.steps.filter(
    (step) => !step.target || document.querySelector(step.target)
  );
}

/** How long after a navigation a first-time tour waits before opening. */
const AUTOSTART_DELAY = 600;

type TourSession = {
  /** The route the tour was opened on. See `active` below. */
  pathname: string;
  tourId: string;
  steps: TourStep[];
  stepIndex: number;
};

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const seen = React.useSyncExternalStore(
    tourStorage.subscribe,
    tourStorage.getSnapshot,
    tourStorage.getServerSnapshot
  );

  const availableTour = findTourForPath(pathname);

  const [session, setSession] = React.useState<TourSession | null>(null);

  /*
   * A tour belongs to the page it describes, so a session opened on another
   * route simply isn't active — derived here rather than cleared by an effect
   * on `pathname`, which would be the set-state-in-effect pattern this codebase
   * lints against. Deriving also closes the gap that version had, where the old
   * tour stayed painted over the new page until the effect ran.
   */
  const active = session && session.pathname === pathname ? session : null;

  const start = React.useCallback((tour: Tour, path: string) => {
    const steps = resolveSteps(tour);
    if (steps.length === 0) return;
    setSession({ pathname: path, tourId: tour.id, steps, stepIndex: 0 });
  }, []);

  const finish = React.useCallback(() => {
    // Marked seen however it ended — finished, skipped or dismissed. Someone
    // who closed a tour has said they don't want it; re-opening it on their
    // next visit would be the app arguing with them.
    if (active) tourStorage.markSeen(active.tourId);
    setSession(null);
  }, [active]);

  /*
   * First-visit auto-start.
   *
   * A genuine effect rather than the set-state-in-effect the codebase lints
   * against: it is not deriving state from props, it is waiting for the DOM to
   * exist. The targets are rendered by the page this provider wraps, and after
   * a client-side navigation they are not in the document at the moment the
   * route changes — the delay lets the page (and its entrance animation) land
   * before anything is measured.
   */
  const seenSet = React.useMemo(() => new Set(seen), [seen]);
  const tourId = availableTour?.id;
  const alreadySeen = tourId ? seenSet.has(tourId) : true;

  React.useEffect(() => {
    if (!availableTour || alreadySeen) return;
    // Never interrupts a tour already on screen. Once one finishes it is marked
    // seen, so `alreadySeen` above stops this reopening what was just closed.
    if (active) return;

    const timer = window.setTimeout(
      () => start(availableTour, pathname),
      AUTOSTART_DELAY
    );
    return () => window.clearTimeout(timer);
  }, [availableTour, alreadySeen, active, start, pathname]);

  const value = React.useMemo<TourContextValue>(
    () => ({
      availableTour,
      isRunning: active !== null,
      restartCurrent: () => {
        if (availableTour) start(availableTour, pathname);
      },
      resetAll: () => {
        tourStorage.resetAll();
        // Restarts here rather than leaving it to the auto-start effect: the
        // reset was an explicit request to see them again, and beginning right
        // away is the confirmation that it worked.
        if (availableTour) start(availableTour, pathname);
      },
    }),
    [availableTour, active, start, pathname]
  );

  const step = active?.steps[active.stepIndex];

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && step && (
        <TourOverlay
          // Remounting per step re-runs the measurement from scratch, so a
          // step never inherits the previous target's rect.
          key={`${active.tourId}-${active.stepIndex}`}
          step={step}
          stepIndex={active.stepIndex}
          stepCount={active.steps.length}
          onNext={() => {
            if (active.stepIndex === active.steps.length - 1) finish();
            else
              setSession((current) =>
                current ? { ...current, stepIndex: current.stepIndex + 1 } : null
              );
          }}
          onBack={() =>
            setSession((current) =>
              current
                ? { ...current, stepIndex: Math.max(0, current.stepIndex - 1) }
                : null
            )
          }
          onClose={finish}
        />
      )}
    </TourContext.Provider>
  );
}
