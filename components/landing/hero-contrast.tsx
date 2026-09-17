"use client";

import { ArrowDownIcon } from "lucide-react";
import { m } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * The hero visual: what rent tracking looks like today, and what it looks like
 * afterwards.
 *
 * It argues rather than demonstrates. A screenshot of the dashboard answers
 * "what does it look like?", which is a question someone only asks once they
 * are already interested; the gap between the two panels answers "why would I
 * bother?", which is the one standing between a landlord and signing up.
 *
 * Built from theme tokens rather than an image file: it stays sharp at any
 * width, follows the theme into dark mode, costs no download, and cannot go
 * stale the way a captured screenshot of an interface still in development can.
 * Every element carries `data-reveal` so the page's `<noscript>` rule can force
 * it visible — motion serves these at `opacity: 0` from the server.
 */

/** The auth ripple's curve, as everywhere else on this page. */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * The scraps rent currently lives in. Rotations are hand-picked rather than
 * random: a fixed set renders identically on the server and the client, where
 * `Math.random()` would differ between them and trip a hydration mismatch.
 */
const SCRAPS = [
  { className: "left-0 top-0 -rotate-[4deg]", delay: 0.3 },
  /*
   * Anchored to the *bottom* rather than offset from the top: the scraps have
   * different heights, and measuring the overlap downward from the top meant
   * the notebook landed squarely over the chat reply at narrow widths, hiding
   * the line the exchange exists for. From the bottom it clips a corner at
   * every width instead — still cluttered, still readable.
   */
  { className: "bottom-0 left-[38%] rotate-[3deg]", delay: 0.4 },
  { className: "top-1 right-0 rotate-[7deg]", delay: 0.5 },
] as const;

const ROWS = [
  { unit: "A3", note: "Paid in full", status: "Paid", tone: "var(--kind-lease)" },
  { unit: "B1", note: "Due in 3 days", status: "Due", tone: "var(--stat-accent)" },
  { unit: "C2", note: "Empty since June", status: "Vacant", tone: "var(--kind-unit)" },
] as const;

function PanelLabel({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "muted" | "accent";
}) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold tracking-[0.14em] uppercase",
        tone === "muted" ? "text-muted-foreground" : "text-[var(--stat-accent)]"
      )}
    >
      {children}
    </p>
  );
}

export function HeroContrast({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      {/* Decorative warmth behind the lower panel, never hit-tested. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(60%_50%_at_50%_75%,var(--stat-accent),transparent)] opacity-15 blur-2xl"
      />

      {/* ---------------------------------------------------------- before */}
      <m.div
        data-reveal
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
        className="rounded-2xl border border-dashed bg-muted/40 p-5"
      >
        <PanelLabel tone="muted">Today</PanelLabel>

        {/*
         * A fixed height because the scraps inside are absolutely positioned —
         * they overlap on purpose, and overlapping is exactly what a flow
         * layout cannot express. The clutter is the argument.
         */}
        <div className="relative mt-3 mb-3 h-32 sm:h-36">
          {/* WhatsApp, where the chasing actually happens. */}
          <Scrap index={0} className="w-[62%] max-w-[15rem]">
            <p className="rounded-lg rounded-bl-sm bg-background px-2.5 py-1.5 text-[11px] leading-snug">
              Umelipa kodi ya mwezi huu?
            </p>
            <p className="mt-1.5 ml-6 rounded-lg rounded-br-sm bg-[color-mix(in_oklch,var(--kind-lease),transparent_86%)] px-2.5 py-1.5 text-[11px] leading-snug">
              Nitalipa kesho 🙏
            </p>
          </Scrap>

          {/* The notebook: a maintenance complaint written down and then
              lost in it — a different failure than the chat's unpaid rent,
              and than the spreadsheet's stale occupancy. */}
          <Scrap index={1} className="w-[42%] max-w-[10.5rem]">
            <p className="text-[10px] font-semibold text-muted-foreground">
              Kumbukumbu
            </p>
            <div className="mt-2 space-y-1 text-[10.5px] leading-snug text-muted-foreground">
              <p>Bomba B1 linavuja</p>
              <p className="pl-2 italic">Niliandika wapi?</p>
            </div>
          </Scrap>

          {/* The spreadsheet nobody has opened since March — still claiming
              what it said back then, which the "After" panel later corrects
              for this same unit. */}
          <Scrap index={2} className="w-[40%] max-w-[9.5rem]">
            <p className="text-[10px] font-semibold text-muted-foreground">
              Machi
            </p>
            <div className="mt-1.5 grid grid-cols-3 gap-px overflow-hidden rounded bg-border">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-2.5 bg-background/90" aria-hidden />
              ))}
            </div>
            <div className="mt-2 space-y-1 text-[10.5px] leading-snug text-muted-foreground">
              <p>C2 — Kupangwa</p>
              <p className="pl-2 italic">...au?</p>
            </div>
          </Scrap>
        </div>

        <p className="text-sm text-muted-foreground">
          Rent lives in five places, and none of them agree.
        </p>
      </m.div>

      {/* --------------------------------------------------------- connector */}
      <m.div
        data-reveal
        initial={{ opacity: 0, scaleY: 0.2 }}
        animate={{ opacity: 1, scaleY: 1 }}
        transition={{ duration: 0.45, ease: EASE, delay: 0.75 }}
        style={{ transformOrigin: "top" }}
        className="flex justify-center py-3"
      >
        <span className="flex size-8 items-center justify-center rounded-full border bg-card shadow-sm">
          <ArrowDownIcon
            className="size-4 text-[var(--stat-accent)]"
            aria-hidden
          />
        </span>
      </m.div>

      {/* ----------------------------------------------------------- after */}
      <m.div
        data-reveal
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.9 }}
        className="overflow-hidden rounded-2xl border bg-card shadow-xl"
      >
        <div className="border-b px-5 py-4">
          <PanelLabel tone="accent">With Rentoo</PanelLabel>
        </div>

        <ul className="divide-y">
          {ROWS.map(({ unit, note, status, tone }, index) => (
            <m.li
              key={unit}
              data-reveal
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: EASE, delay: 1.1 + index * 0.12 }}
              className="flex items-center gap-3 px-5 py-3.5"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                style={{
                  color: tone,
                  backgroundColor: `color-mix(in oklch, ${tone}, transparent 88%)`,
                }}
              >
                {unit}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {note}
              </span>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  color: tone,
                  backgroundColor: `color-mix(in oklch, ${tone}, transparent 88%)`,
                }}
              >
                {status}
              </span>
            </m.li>
          ))}
        </ul>

        <p className="border-t px-5 py-4 text-sm font-medium">
          Every unit and every payment, on one screen.
        </p>
      </m.div>
    </div>
  );
}

function Scrap({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  const { className: position, delay } = SCRAPS[index];

  return (
    <m.div
      data-reveal
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className={cn(
        "absolute rounded-lg border bg-card p-2.5 shadow-sm",
        position,
        className
      )}
    >
      {children}
    </m.div>
  );
}
