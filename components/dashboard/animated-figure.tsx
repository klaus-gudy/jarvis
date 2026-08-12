"use client";

import * as React from "react";

/**
 * Counts a dashboard figure up from zero on mount.
 *
 * Three things make this harder than a loop over a number:
 *
 * 1. **The value arrives already formatted.** Money reaches `MetricCard` as
 *    "TZS 900,000" or the compact "TZS 1.4M", not as a number, so the digits
 *    have to be found inside the string and put back with the same grouping,
 *    decimal places, prefix and suffix they came with. Reformatting from
 *    scratch here would mean a second copy of `lib/format.ts`'s rules.
 *
 * 2. **The server already rendered the final figure**, which is what should be
 *    in the HTML — it is the truth, and it is what a reader without JS, or
 *    with reduced motion, must see. So the count can't be React state seeded at
 *    zero; that would render zero on the server.
 *
 * 3. **Which means the reset to zero has to happen before the browser paints**,
 *    or the card visibly shows the real figure, blinks back to zero, and counts
 *    up to where it already was. Hence a layout effect writing `textContent`
 *    directly rather than state: it runs after the DOM is in place but before
 *    paint, and it sidesteps the codebase's set-state-in-effect rule for free.
 */

/** Matches the first number in a formatted figure: "TZS 1,250,000", "1.4M", "62.5". */
const NUMBER_PATTERN = /-?\d[\d,]*(?:\.\d+)?/;

const DURATION_MS = 900;

type Figure = {
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
  grouped: boolean;
};

function parseFigure(value: string | number): Figure | null {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { prefix: "", suffix: "", target: value, decimals: 0, grouped: false }
      : null;
  }

  const match = NUMBER_PATTERN.exec(value);
  if (!match) return null;

  const raw = match[0];
  const target = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(target)) return null;

  const dot = raw.indexOf(".");

  return {
    prefix: value.slice(0, match.index),
    suffix: value.slice(match.index + raw.length),
    target,
    // "1.4M" counts through one decimal place; "900,000" through none.
    decimals: dot === -1 ? 0 : raw.length - dot - 1,
    // Only re-group if the original was grouped — "1.4M" must not become "1.4M"
    // via a thousands separator it never had.
    grouped: raw.includes(","),
  };
}

function renderFigure(figure: Figure, current: number) {
  const fixed = current.toFixed(figure.decimals);
  const body = figure.grouped
    ? new Intl.NumberFormat("en-US", {
        minimumFractionDigits: figure.decimals,
        maximumFractionDigits: figure.decimals,
      }).format(Number(fixed))
    : fixed;

  return `${figure.prefix}${body}${figure.suffix}`;
}

/**
 * `useLayoutEffect` warns when React renders it on the server. The choice is
 * made once at module load, not per render, so this is a stable hook identity
 * rather than a conditional call.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function AnimatedFigure({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const text = String(value);

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const figure = parseFigure(value);
    // Nothing to count towards, and nothing worth animating from zero to zero.
    if (!figure || figure.target === 0) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const start = performance.now();
    let frame = 0;

    node.textContent = renderFigure(figure, 0);

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      // easeOutCubic — quick off the mark, settling gently onto the real
      // figure rather than stopping dead on it.
      const eased = 1 - Math.pow(1 - progress, 3);

      if (progress < 1) {
        node.textContent = renderFigure(figure, figure.target * eased);
        frame = requestAnimationFrame(tick);
        return;
      }

      // Land on the string the server rendered, not on the eased
      // approximation of it — rounding could otherwise leave the card a
      // shilling short of the real total.
      node.textContent = text;
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, text]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
