"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TourStep } from "@/lib/tours";
import { cn } from "@/lib/utils";

/** Breathing room between the spotlight ring and the element it surrounds. */
const PADDING = 8;
/** Gap between the spotlight and the tooltip card. */
const GAP = 12;
const CARD_WIDTH = 340;
/** Keeps the card off the very edge of small viewports. */
const MARGIN = 12;

type Rect = { top: number; left: number; width: number; height: number };

function readRect(element: Element): Rect {
  const { top, left, width, height } = element.getBoundingClientRect();
  return { top, left, width, height };
}

/**
 * Tracks a target's position in *viewport* coordinates.
 *
 * Re-measured on scroll and resize rather than once on open: the page behind
 * the tour still scrolls (the step scrolls its own target into view), and a
 * spotlight pinned to a stale rect would drift off the thing it is pointing at.
 * `useLayoutEffect` so the first paint already has the real position — with a
 * plain effect the ring renders at the top-left corner for one frame and visibly
 * jumps into place.
 */
function useTargetRect(selector: string | undefined) {
  const [rect, setRect] = React.useState<Rect | null>(null);

  React.useLayoutEffect(() => {
    /*
     * Nothing is cleared on the way out: `rect` starts null and the overlay is
     * remounted for each step, so there is never a stale rect to reset — which
     * also keeps this effect free of the synchronous setState the codebase
     * lints against. Every write below happens inside a frame or a timer.
     */
    if (!selector) return;

    const element = document.querySelector(selector);
    if (!element) return;

    element.scrollIntoView({ block: "center", behavior: "smooth" });

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      // Coalesced into a frame: scroll fires far more often than paint, and
      // measuring per event forces a layout each time.
      frame = requestAnimationFrame(() => setRect(readRect(element)));
    };

    measure();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    // The smooth scroll above settles over several frames, so the rect is
    // re-read until it stops moving rather than once at the start.
    const settle = window.setInterval(measure, 100);
    const stopSettling = window.setTimeout(
      () => window.clearInterval(settle),
      700
    );

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.clearInterval(settle);
      window.clearTimeout(stopSettling);
    };
  }, [selector]);

  return rect;
}

/** Places the card below the target, or above it when there is no room. */
function cardPosition(rect: Rect | null) {
  if (typeof window === "undefined") return undefined;

  if (!rect) {
    return {
      top: window.innerHeight / 2,
      left: window.innerWidth / 2,
      transform: "translate(-50%, -50%)",
    } as const;
  }

  const below = rect.top + rect.height + PADDING + GAP;
  const spaceBelow = window.innerHeight - below;
  // 200px is a rough card height; enough to decide which side has more room.
  const placeAbove = spaceBelow < 200 && rect.top > spaceBelow;

  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - CARD_WIDTH / 2, MARGIN),
    Math.max(window.innerWidth - CARD_WIDTH - MARGIN, MARGIN)
  );

  return placeAbove
    ? ({
        top: rect.top - PADDING - GAP,
        left,
        transform: "translateY(-100%)",
      } as const)
    : ({ top: below, left } as const);
}

export function TourOverlay({
  step,
  stepIndex,
  stepCount,
  onNext,
  onBack,
  onClose,
}: {
  step: TourStep;
  stepIndex: number;
  stepCount: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const rect = useTargetRect(step.target);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === stepCount - 1;

  // Bound to the window rather than the card, so the keys work no matter what
  // holds focus — including the page behind, which stays scrollable.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      } else if (event.key === "ArrowLeft" && !isFirst) {
        event.preventDefault();
        onBack();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onNext, onBack, isFirst]);

  return createPortal(
    <div className="fixed inset-0 z-50" role="presentation">
      {/*
       * The dimming is one element: a box the size of the target carrying a
       * shadow large enough to cover any viewport. Four separate panels around
       * the target would leave hairline seams at fractional device pixels, and
       * an SVG mask would need re-rendering on every scroll frame.
       *
       * `pointer-events-none` so the page underneath stays live — a tour that
       * traps the pointer can't point at something and let you try it.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute rounded-lg ring-2 ring-[var(--stat-accent)] transition-all duration-200 motion-reduce:transition-none"
        style={
          rect
            ? {
                top: rect.top - PADDING,
                left: rect.left - PADDING,
                width: rect.width + PADDING * 2,
                height: rect.height + PADDING * 2,
                boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.55)",
              }
            : {
                // No target: dim everything, with nothing cut out.
                inset: 0,
                boxShadow: "inset 0 0 0 9999px rgb(0 0 0 / 0.55)",
              }
        }
      />

      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={cn(
          "absolute w-[min(21rem,calc(100vw-1.5rem))] rounded-xl border bg-card p-4 shadow-xl",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 duration-200"
        )}
        style={cardPosition(rect)}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--stat-accent)] uppercase">
            Step {stepIndex + 1} of {stepCount}
          </p>
          <Button
            variant="ghost"
            size="icon-xs"
            className="-mt-1 -mr-1"
            onClick={onClose}
            aria-label="End tour"
          >
            <XIcon />
          </Button>
        </div>

        <h2 id="tour-title" className="font-heading mt-2 font-semibold">
          {step.title}
        </h2>
        <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>

        <div className="mt-4 flex items-center justify-between gap-2">
          {/* Progress as dots: at three-to-five steps a bar reads as heavier
              than the thing it is measuring. */}
          <div className="flex items-center gap-1" aria-hidden>
            {Array.from({ length: stepCount }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  index === stepIndex
                    ? "bg-[var(--stat-accent)]"
                    : "bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={onBack}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={onNext} autoFocus>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
