import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The list counterpart to `MetricCard`: a titled card holding a handful of
 * rows, with a link through to the page that holds the rest. Every list panel
 * on the dashboard goes through here so their headers, rules, empty states and
 * padding stay identical — same reasoning as the single `MetricCard`.
 */
export function DashboardPanel({
  title,
  icon: Icon,
  href,
  linkLabel = "View all",
  count,
  empty,
  children,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  linkLabel?: string;
  /** Shown beside the title when there is more than the rows on screen. */
  count?: number;
  /** Rendered instead of `children` when there is nothing to list. */
  empty: string;
  children?: React.ReactNode;
}) {
  const isEmpty = React.Children.count(children) === 0;

  return (
    <Card className="group/panel gap-0 p-0 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {count !== undefined && count > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        <Link
          href={href}
          className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary outline-none hover:underline focus-visible:underline"
        >
          {linkLabel}
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </div>

      {isEmpty ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </Card>
  );
}

/**
 * One row. `trailing` is the figure on the right — a count of days, an amount,
 * a percentage — and `tone` gives it the gold when it wants attention.
 */
export function PanelRow({
  leading,
  title,
  subtitle,
  trailing,
  trailingCaption,
  tone = "default",
  href,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: string;
  trailingCaption?: string;
  tone?: "default" | "accent" | "muted";
  href?: string;
}) {
  const content = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {trailing && (
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              tone === "accent" && "text-stat-accent",
              // For trailing text that labels rather than measures — a role, a
              // timestamp — which shouldn't outweigh the row's own title.
              tone === "muted" && "text-xs font-normal text-muted-foreground",
              tone === "default" && "text-foreground"
            )}
          >
            {trailing}
          </p>
          {trailingCaption && (
            <p className="text-[11px] text-muted-foreground">{trailingCaption}</p>
          )}
        </div>
      )}
    </>
  );

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="flex items-center gap-3 px-5 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-center gap-3 px-5 py-3">{content}</div>
      )}
    </li>
  );
}
