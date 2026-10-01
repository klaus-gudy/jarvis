"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ActivityItem, ActivityPage } from "@/lib/activity";
import { APP_TIME_ZONE } from "@/lib/dates";
import { cn } from "@/lib/utils";

// On the landlord's clock, as the SMS timeline is.
const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** Consecutive items (already newest first) grouped under their day. */
function groupByDay(items: ActivityItem[]) {
  const days: { key: string; label: string; items: ActivityItem[] }[] = [];
  for (const item of items) {
    const date = new Date(item.at);
    const key = dayKey.format(date);
    const last = days.at(-1);
    if (last?.key === key) last.items.push(item);
    else days.push({ key, label: dayLabel.format(date), items: [item] });
  }
  return days;
}

type State =
  | { status: "loading"; items: ActivityItem[]; cursor: string | null }
  | { status: "idle"; items: ActivityItem[]; cursor: string | null }
  | { status: "error"; items: ActivityItem[]; cursor: string | null };

/**
 * What happened to a record, newest first — read from the audit log by
 * `GET /api/activity`. Fetched when the tab opens, so a slow history never
 * holds up the page around it.
 *
 * `subject` is a `Type:id` key (`Unit:…`); leave it out for the org-wide feed,
 * and pass `feed="payments"` to narrow that to money.
 */
export function ActivityTimeline({
  subject,
  feed = "all",
  emptyMessage = "Nothing has happened here yet.",
}: {
  subject?: string;
  feed?: "all" | "payments";
  emptyMessage?: string;
}) {
  const isMobile = useIsMobile();
  const [state, setState] = React.useState<State>({ status: "loading", items: [], cursor: null });
  // Bumped to ask for the page after `state.cursor`.
  const [request, setRequest] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ feed });
    if (subject) params.set("subject", subject);
    // Request 0 is the first page; later ones continue from the last item.
    const cursor = request > 0 ? state.cursor : null;
    if (cursor) params.set("cursor", cursor);

    fetch(`/api/activity?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`activity ${response.status}`);
        return response.json() as Promise<ActivityPage>;
      })
      .then((page) =>
        setState((current) => ({
          status: "idle",
          items: request > 0 ? [...current.items, ...page.items] : page.items,
          cursor: page.nextCursor,
        }))
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setState((current) => ({ ...current, status: "error" }));
      });
    return () => controller.abort();
    // `state.cursor` is read, not watched: only a new request should fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, feed, request]);

  const loadMore = React.useCallback(() => {
    setState((current) => ({ ...current, status: "loading" }));
    setRequest((current) => current + 1);
  }, []);

  // Phones load the next page as the end scrolls into view, like the other
  // mobile lists; desktop keeps an explicit button.
  const sentinel = React.useRef<HTMLDivElement>(null);
  const canLoadMore = state.status === "idle" && state.cursor !== null;
  React.useEffect(() => {
    if (!isMobile || !canLoadMore || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [isMobile, canLoadMore, loadMore]);

  if (state.items.length === 0) {
    if (state.status === "loading") return <TimelineSkeleton />;
    return (
      <Card className="items-center p-8 text-center text-sm text-muted-foreground">
        {state.status === "error" ? "Couldn't load the activity." : emptyMessage}
      </Card>
    );
  }

  return (
    <Card className="gap-5 p-4 sm:p-5">
      {groupByDay(state.items).map((day) => (
        <section key={day.key} aria-label={day.label}>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">{day.label}</h3>
          <ol className="ml-1 space-y-4 border-l border-border pl-4">
            {day.items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ol>
        </section>
      ))}

      <div ref={sentinel} className="flex justify-center">
        {state.status === "error" ? (
          <Button variant="outline" size="sm" onClick={loadMore}>
            Couldn&apos;t load more. Try again
          </Button>
        ) : state.status === "loading" ? (
          <span className="text-xs text-muted-foreground">Loading…</span>
        ) : state.cursor ? (
          !isMobile && (
            <Button variant="outline" size="sm" onClick={loadMore}>
              Load more
            </Button>
          )
        ) : (
          <span className="text-xs text-muted-foreground">That&apos;s everything</span>
        )}
      </div>
    </Card>
  );
}

/**
 * Three lines: what happened and when; a short summary; who did it and to
 * what. Anything longer belongs on the record's own page, one click away.
 */
function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <li className="space-y-0.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-sm font-medium">{item.title}</p>
        <time dateTime={item.at} className="text-xs text-muted-foreground tabular-nums">
          {timeLabel.format(new Date(item.at))}
        </time>
      </div>
      {item.detail && <p className="truncate text-sm text-muted-foreground">{item.detail}</p>}
      <p className="text-xs text-muted-foreground">
        {item.actor}
        {item.entity && (
          <>
            {" · "}
            {item.entity.href ? (
              // The gold of the active sidebar item, in both themes —
              // `text-primary` is navy in light mode.
              <Link href={item.entity.href} className="text-stat-accent hover:underline">
                {item.entity.label}
              </Link>
            ) : (
              item.entity.label
            )}
          </>
        )}
      </p>
    </li>
  );
}

function TimelineSkeleton() {
  return (
    <Card className="gap-4 p-4 sm:p-5" aria-busy="true" aria-label="Loading activity">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className={cn("space-y-2", index === 0 && "pt-1")}>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </Card>
  );
}
