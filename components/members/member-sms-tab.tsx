"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Loader2Icon,
  MessageSquareIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react";

import { SendSmsDialog } from "@/components/members/send-sms-dialog";
import { SmsTimeline } from "@/components/members/sms-timeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadMoreSentinel } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  SMS_DEFAULT_PAGE_SIZE,
  SMS_PAGE_SIZES,
  SMS_STATUSES,
  SMS_STATUS_LABELS,
  type SmsAlert,
  type SmsAlertsPage,
  type SmsStatus,
} from "@/lib/sms/sms-types";
import { cn } from "@/lib/utils";

type Filters = { status: SmsStatus | "all"; from: string; to: string };

const NO_FILTERS: Filters = { status: "all", from: "", to: "" };

/** Each batch a phone loads as the reader nears the bottom. */
const MOBILE_BATCH = 20;

type PageData = SmsAlertsPage & { recipient: string };

type Outcome =
  | { kind: "ok"; data: PageData }
  | { kind: "no-phone" }
  | { kind: "error"; message: string };

type Cache = {
  base: string;
  pages: Record<number, Outcome>;
  /** The page that arrived last — what desktop keeps showing, dimmed, while the next loads. */
  last: Outcome | null;
};

function filterParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}

function activeFilterCount(filters: Filters) {
  return (
    Number(filters.status !== "all") +
    Number(filters.from !== "" || filters.to !== "")
  );
}

async function loadPage(url: string, signal: AbortSignal): Promise<Outcome> {
  const response = await fetch(url, { signal });
  const body = await response.json().catch(() => ({}));
  if (response.ok && body.reason === "no-phone") return { kind: "no-phone" };
  if (response.ok) return { kind: "ok", data: body };
  if (body.reason === "not-configured") {
    return {
      kind: "error",
      message: "SMS history isn't set up on this server (NOTIFIER_API_URL is missing).",
    };
  }
  return {
    kind: "error",
    message: "The SMS service couldn't be reached. Try again in a moment.",
  };
}

/**
 * Every SMS sent to this member's phone number, read live from notifier
 * through `/api/members/[id]/sms`.
 *
 * Fetched on the client when the tab opens, not on the server with the rest of
 * the page: notifier is a separate service, and the member page must not wait
 * on — or fail with — it. Filtering and paging happen in notifier, so however
 * many texts a number has received, the browser only ever holds one page —
 * which is why this isn't a `DataTable` (that filters rows already in memory).
 * It borrows the same shape, though: one card, toolbar on top, count and
 * paging at the foot.
 */
export function MemberSmsTab({
  membershipId,
  phone,
}: {
  membershipId: string;
  phone: string | null;
}) {
  const isMobile = useIsMobile();
  const [filters, setFilters] = React.useState<Filters>(NO_FILTERS);
  const [pageSize, setPageSize] = React.useState<number>(SMS_DEFAULT_PAGE_SIZE);
  // Bumped after a send so the same query is asked again.
  const [revision, setRevision] = React.useState(0);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const params = filterParams(filters);
  params.set("limit", String(isMobile ? MOBILE_BATCH : pageSize));
  const query = params.toString();
  const base = `${query}#${revision}`;

  // Both counters only mean something under the base they were set for, so a
  // filter change falls back to page 1 without an effect resetting them.
  const [desktopPage, setDesktopPage] = React.useState({ base: "", page: 1 });
  const [mobileCount, setMobileCount] = React.useState({ base: "", count: 1 });
  const page = desktopPage.base === base ? desktopPage.page : 1;
  const count = mobileCount.base === base ? mobileCount.count : 1;
  const needed = isMobile ? count : page;

  const [cache, setCache] = React.useState<Cache>({ base: "", pages: {}, last: null });
  const pages = cache.base === base ? cache.pages : {};
  const loading = !pages[needed];

  React.useEffect(() => {
    if (!loading) return;
    const controller = new AbortController();
    loadPage(`/api/members/${membershipId}/sms?${query}&page=${needed}`, controller.signal)
      .catch((error: unknown): Outcome | null => {
        if (controller.signal.aborted) return null;
        console.error(error);
        return { kind: "error", message: "Couldn't load SMS alerts." };
      })
      .then((outcome) => {
        if (!outcome) return;
        setCache((current) => ({
          base,
          pages: { ...(current.base === base ? current.pages : {}), [needed]: outcome },
          last: outcome,
        }));
      });
    return () => controller.abort();
  }, [membershipId, query, base, needed, loading]);

  const onSent = () => setRevision((current) => current + 1);
  const filtered = activeFilterCount(filters) > 0;
  const reset = () => setFilters(NO_FILTERS);

  // Top right, above the content, full size — where the Lease tab puts
  // "Create lease" and Documents puts "Upload document".
  const sendButton = (
    <div className="flex justify-end">
      <SendSmsDialog membershipId={membershipId} defaultPhone={phone} onSent={onSent} />
    </div>
  );

  if (isMobile) {
    // Pages 1..n, stopping at the first that hasn't arrived. De-duplicated by
    // id: a text sent between two batches shifts notifier's offsets by one.
    const loaded: PageData[] = [];
    let failure: Outcome | undefined;
    for (let n = 1; n <= count; n++) {
      const outcome = pages[n];
      if (!outcome) break;
      if (outcome.kind !== "ok") {
        failure = outcome;
        break;
      }
      loaded.push(outcome.data);
    }
    const seen = new Set<string>();
    const alerts: SmsAlert[] = [];
    for (const alert of loaded.flatMap((data) => data.alerts)) {
      if (seen.has(alert.id)) continue;
      seen.add(alert.id);
      alerts.push(alert);
    }
    const latest = loaded.at(-1);
    const hasMore = latest ? latest.page < latest.totalPages : false;
    const remaining = latest ? Math.max(0, latest.total - alerts.length) : 0;

    return (
      <div className="space-y-3">
        {sendButton}

        {/* Sticky, bled to the gutter with `-mx-4 px-4`, as `DataTable`'s
            mobile toolbar is. There's no search, so the count takes its place. */}
        <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {latest
              ? `${latest.total} message${latest.total === 1 ? "" : "s"}`
              : "SMS alerts"}
          </p>
          <Button
            variant="outline"
            className="h-9 shrink-0 bg-card"
            onClick={() => setFiltersOpen(true)}
            aria-label="Filters"
          >
            <SlidersHorizontalIcon />
            Filters
            {filtered && (
              <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
                {activeFilterCount(filters)}
              </span>
            )}
          </Button>
        </div>

        {failure?.kind === "no-phone" ? (
          <NoPhone />
        ) : failure?.kind === "error" ? (
          <EmptyState tone="error">{failure.message}</EmptyState>
        ) : !latest ? (
          <Loading />
        ) : alerts.length === 0 ? (
          <NoAlerts filtered={filtered} />
        ) : (
          <SmsTimeline alerts={alerts} surface="page" animate />
        )}

        {latest && hasMore && !failure && (
          loading ? (
            <div className="flex justify-center py-4">
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Loading" />
            </div>
          ) : (
            // Keyed on the count, as in `DataTable`: an observer fires on a
            // change of intersection, so only a fresh node can fire again
            // while still in view.
            <LoadMoreSentinel
              key={count}
              remaining={remaining}
              onReach={() => setMobileCount({ base, count: count + 1 })}
            />
          )
        )}
        {latest && !hasMore && alerts.length > 0 && (
          <p className="pt-1 pb-2 text-center text-xs text-muted-foreground">
            {latest.total} message{latest.total === 1 ? "" : "s"} to{" "}
            <span className="font-mono">+{latest.recipient}</span>
          </p>
        )}

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom" className="max-h-[85vh]">
            {/* Keyed on open so the draft re-seeds from the live filters. */}
            <FilterSheetBody
              key={String(filtersOpen)}
              current={filters}
              onApply={(draft) => {
                setFilters(draft);
                setFiltersOpen(false);
              }}
              onReset={() => {
                reset();
                setFiltersOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // While another page or filter loads, the last page that arrived stays on
  // screen, dimmed, instead of flashing the placeholder.
  const outcome = pages[page] ?? cache.last;
  const data = outcome?.kind === "ok" ? outcome.data : null;

  return (
    <Card className="gap-4 p-4">
      {/* Phone: status + Send on one row, the two dates sharing the next.
          From `sm` up it's one inline toolbar, Send pushed to the end. */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.status}
          onValueChange={(next) => update({ status: next as Filters["status"] })}
        >
          <SelectTrigger
            size="sm"
            className="min-w-0 flex-1 bg-background sm:w-36 sm:flex-none"
            aria-label="Status"
          >
            <SelectValue>
              {(selected: string) =>
                selected === "all"
                  ? "All statuses"
                  : SMS_STATUS_LABELS[selected as SmsStatus]
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SMS_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {SMS_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 sm:order-last sm:ml-auto">
          {loading && outcome && (
            <Loader2Icon
              className="size-3.5 animate-spin text-muted-foreground"
              aria-label="Loading"
            />
          )}
          <SendSmsDialog
            membershipId={membershipId}
            defaultPhone={phone}
            onSent={() => setRevision((current) => current + 1)}
          />
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          {/* No `text-sm` on these: under 16px iOS zooms the page on focus.
              The Input's own `md:text-sm` takes over on wider screens. Labels
              sit above on a phone so `dd/mm/yyyy` isn't clipped. */}
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-1.5">
            From
            <Input
              type="date"
              className="h-8 w-full min-w-0 bg-background sm:h-7 sm:w-36"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(event) => update({ from: event.target.value })}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-1.5">
            To
            <Input
              type="date"
              className="h-8 w-full min-w-0 bg-background sm:h-7 sm:w-36"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(event) => update({ to: event.target.value })}
            />
          </label>
        </div>

        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters((current) => ({ ...NO_FILTERS, limit: current.limit }))}
          >
            <XIcon />
            Reset
          </Button>
        )}
      </div>

      {!outcome && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Loading SMS alerts…
        </p>
      )}

      {outcome?.kind === "no-phone" && (
        <EmptyState>
          This member has no valid phone number on file, so no SMS alerts can be
          matched to them. You can still send one to any number.
        </EmptyState>
      )}

      {outcome?.kind === "error" && (
        <EmptyState tone="error">{outcome.message}</EmptyState>
      )}

      {data && data.alerts.length === 0 && (
        <EmptyState>
          {filtered
            ? "No SMS alerts match these filters."
            : "No SMS alerts have been sent to this member yet."}
        </EmptyState>
      )}

      {data && data.alerts.length > 0 && (
        <ul
          className={cn(
            "divide-y rounded-xl bg-background/60 ring-1 ring-foreground/10 transition-opacity",
            loading && "opacity-60"
          )}
        >
          {data.alerts.map((alert) => (
            <li key={alert.id} className="space-y-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium",
                    STATUS_TONE[alert.status]
                  )}
                >
                  {SMS_STATUS_LABELS[alert.status] ?? alert.status}
                </span>
                <time dateTime={alert.createdAt}>
                  {dateTime.format(new Date(alert.createdAt))}
                </time>
                <span aria-hidden>·</span>
                <span>{alert.serviceName}</span>
              </div>
              <p className="text-sm whitespace-pre-line">{alert.message}</p>
              {alert.status === "FAILED" && alert.errorMessage && (
                <p className="text-xs text-destructive">{alert.errorMessage}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {data && data.total > 0 && (
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground tabular-nums">
            {data.total > data.alerts.length
              ? `${(data.page - 1) * data.limit + 1}–${
                  (data.page - 1) * data.limit + data.alerts.length
                } of `
              : ""}
            {data.total} message{data.total === 1 ? "" : "s"} to{" "}
            <span className="font-mono">+{data.recipient}</span>
          </p>

          <div className="flex items-center gap-2">
            <Select
              value={String(filters.limit)}
              onValueChange={(next) => update({ limit: Number(next) })}
            >
              <SelectTrigger size="sm" className="w-17 bg-background" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SMS_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {data.totalPages > 1 && (
              <>
                <span className="mr-auto px-1 text-muted-foreground tabular-nums sm:mr-0">
                  Page {data.page} of {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="First page"
                  disabled={loading || filters.page <= 1}
                  onClick={() => goTo(1)}
                >
                  <ChevronsLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Previous page"
                  disabled={loading || filters.page <= 1}
                  onClick={() => goTo(filters.page - 1)}
                >
                  <ChevronLeftIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next page"
                  disabled={loading || filters.page >= data.totalPages}
                  onClick={() => goTo(filters.page + 1)}
                >
                  <ChevronRightIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Last page"
                  disabled={loading || filters.page >= data.totalPages}
                  onClick={() => goTo(data.totalPages)}
                >
                  <ChevronsRightIcon />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function EmptyState({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "error";
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
      <MessageSquareIcon
        className={cn(
          "size-6",
          tone === "error" ? "text-destructive" : "text-muted-foreground"
        )}
        aria-hidden
      />
      <p className="max-w-sm text-sm text-muted-foreground">{children}</p>
    </div>
  );
}
