import Link from "next/link";
import { ArrowRightIcon, type LucideIcon } from "lucide-react";

import { AnimatedFigure } from "@/components/dashboard/animated-figure";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricSubStat = {
  label: string;
  value: string | number;
  /**
   * `accent` is the gold reserved for figures that need chasing (vacancies,
   * expiries). Plain vs gold rather than two theme tokens, because `--primary`
   * and `--secondary-foreground` swap roles between light and dark.
   */
  tone?: "default" | "accent";
};

export type MetricCardProps = {
  icon: LucideIcon;
  /** The headline figure — a count, or a formatted currency string. */
  value: string | number;
  /** The line under the figure that says what it counts. */
  label: string;
  /**
   * `filled` is the dark slab reserved for the money card, so exactly one card
   * per row leads. Everything else is `default`.
   */
  variant?: "default" | "filled";
  /** Makes the whole card a link and shows the "View" affordance. */
  href?: string;
  /** Pill in the top-right corner, e.g. "69%". Replaces the "View" affordance. */
  badge?: string;
  /** 0–100. Renders the bar under the label. */
  progress?: number;
  /** Small caption below the bar. */
  footer?: string;
  /** Supporting figures under a rule. Two reads best at this width. */
  stats?: MetricSubStat[];
};

/**
 * The one card the dashboard's top row is built from. Both looks — the filled
 * lead card and the plain count cards — come from here, so the row can't drift
 * apart: every proportion below (icon tile, figure, rule, sub-stats) is defined
 * once and shared.
 *
 * When `href` is set the whole card is the link and the "View" affordance is
 * decorative, so no anchor ends up nested inside another.
 */
export function MetricCard({
  icon: Icon,
  value,
  label,
  variant = "default",
  href,
  badge,
  progress,
  footer,
  stats,
}: MetricCardProps) {
  const filled = variant === "filled";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg",
            filled
              ? "bg-stat-foreground/15 text-stat-foreground"
              : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>

        {badge ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
              filled ? "bg-stat-foreground/15" : "bg-muted text-muted-foreground"
            )}
          >
            {badge}
          </span>
        ) : href ? (
          // Underlines on hover anywhere over the card, not just over these
          // two words — the whole card is the link, so the affordance should
          // answer to the whole card. `group/card` comes from <Card>.
          <span className="flex items-center gap-1 text-xs font-semibold text-primary group-hover/card:underline">
            View
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </span>
        ) : null}
      </div>

      <div className="mt-auto pt-6">
        <p
          className={cn(
            "font-bold tracking-tight tabular-nums",
            // Counts arrive as numbers, money as an already-formatted string —
            // and "TZS 1,300,000" needs a smaller step than "3" to stay on one
            // line. Keying off the type keeps every money card the same size.
            typeof value === "string" ? "text-xl" : "text-2xl"
          )}
        >
          {/* Only the headline figure counts. The sub-stats below are 11px
              captions — animating those too turns a row of six cards into a
              flickering wall rather than one figure arriving. */}
          <AnimatedFigure value={value} />
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            filled ? "text-stat-foreground/70" : "text-muted-foreground"
          )}
        >
          {label}
        </p>

        {progress !== undefined && (
          <div
            className={cn(
              "mt-2.5 h-1.5 overflow-hidden rounded-full",
              filled ? "bg-stat-foreground/15" : "bg-muted"
            )}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={label}
          >
            {/* Grows from zero to its own computed width on mount, in step
                with the figure above it. Pure CSS, so the card stays a server
                component and the final width is still in the HTML. */}
            <div
              className="h-full animate-bar-grow rounded-full bg-stat-accent transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}

        {footer && (
          <p
            className={cn(
              "mt-1.5 text-[11px]",
              filled ? "text-stat-foreground/55" : "text-muted-foreground"
            )}
          >
            {footer}
          </p>
        )}

        {/* An even split rather than content-width columns: at five cards
            across, flex sizing squeezed "Occupied units" into an ellipsis. */}
        {stats && stats.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
            {stats.map((stat) => (
              <div key={stat.label} className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    stat.tone === "accent" ? "text-stat-accent" : "text-foreground"
                  )}
                >
                  {stat.value}
                </p>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <Card
      className={cn(
        "gap-0 p-0 shadow-sm transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring",
        filled && "bg-stat text-stat-foreground ring-0"
      )}
    >
      {href ? (
        <Link
          href={href}
          className="flex h-full flex-col p-5 outline-none"
          aria-label={label}
        >
          {body}
        </Link>
      ) : (
        <div className="flex h-full flex-col p-5">{body}</div>
      )}
    </Card>
  );
}
