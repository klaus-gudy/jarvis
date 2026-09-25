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
 * through `/api/members/[id]/sms`, drawn as a timeline.
 *
 * Fetched on the client when the tab opens, not with the rest of the page:
 * notifier is a separate service, and the member page must not wait on — or
 * fail with — it. Notifier filters and pages, so however many texts a number
 * has received the browser holds only what has been asked for — which is why
 * this isn't a `DataTable` (that filters rows already in memory). It keeps the
 * same shape, though: the action button above, and on a phone a sticky bar
 * whose filters open in a bottom sheet, with more loading as you scroll.
 *
 * Both layouts read one cache: pages keyed by number under a `base` (filters,
 * page size and send revision). Desktop shows one page; a phone shows pages
 * 1..n run together. Changing the base drops the cache, and "loading" is
 * derived from a missing page rather than set inside the effect.
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

  // Desktop: top right, above the content, full size — where the Lease tab
  // puts "Create lease" and Documents puts "Upload document".
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
        {/* Sticky, bled to the gutter with `-mx-4 px-4`, as `DataTable`'s
            mobile toolbar is. There's no search, so the count takes its place,
            and Send SMS joins Filters here rather than costing its own row. */}
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
          <SendSmsDialog
            membershipId={membershipId}
            defaultPhone={phone}
            onSent={onSent}
            className="h-9 shrink-0"
          />
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
    <div className="space-y-3">
      {sendButton}

      <Card className="gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.status}
            onValueChange={(next) =>
              setFilters((current) => ({ ...current, status: next as Filters["status"] }))
            }
          >
            <SelectTrigger size="sm" className="w-36 bg-background" aria-label="Status">
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

          <DateRange
            filters={filters}
            onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))}
          />

          {filtered && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <XIcon />
              Reset
            </Button>
          )}

          {loading && outcome && (
            <Loader2Icon
              className="ml-auto size-3.5 animate-spin text-muted-foreground"
              aria-label="Loading"
            />
          )}
        </div>

        {!outcome ? (
          <Loading />
        ) : outcome.kind === "no-phone" ? (
          <NoPhone />
        ) : outcome.kind === "error" ? (
          <EmptyState tone="error">{outcome.message}</EmptyState>
        ) : data && data.alerts.length === 0 ? (
          <NoAlerts filtered={filtered} />
        ) : data ? (
          <div className={cn("transition-opacity", loading && "opacity-60")}>
            <SmsTimeline alerts={data.alerts} surface="card" />
          </div>
        ) : null}

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
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
              <Select value={String(pageSize)} onValueChange={(next) => setPageSize(Number(next))}>
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
                <Pager
                  page={data.page}
                  totalPages={data.totalPages}
                  disabled={loading}
                  onPage={(next) => setDesktopPage({ base, page: next })}
                />
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DateRange({
  filters,
  onChange,
  stacked = false,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  /** Labels above, two columns — the sheet's layout. */
  stacked?: boolean;
}) {
  // No `text-sm` on the inputs: under 16px iOS zooms the page on focus. The
  // Input's own `md:text-sm` takes over on wider screens.
  const label = stacked
    ? "flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground"
    : "flex items-center gap-1.5 text-xs text-muted-foreground";
  const input = stacked ? "h-10 w-full min-w-0 bg-card" : "h-7 w-36 bg-background";

  return (
    <div className={stacked ? "grid grid-cols-2 gap-3" : "contents"}>
      <label className={label}>
        From
        <Input
          type="date"
          className={input}
          value={filters.from}
          max={filters.to || undefined}
          onChange={(event) => onChange({ from: event.target.value })}
        />
      </label>
      <label className={label}>
        To
        <Input
          type="date"
          className={input}
          value={filters.to}
          min={filters.from || undefined}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </label>
    </div>
  );
}

/**
 * The phone's filter sheet: a draft applied in one go, chips for the status —
 * the same as `DataTable`'s sheet, where a select popup has nowhere to open
 * from a sheet pinned to the bottom of the screen.
 */
function FilterSheetBody({
  current,
  onApply,
  onReset,
}: {
  current: Filters;
  onApply: (draft: Filters) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = React.useState<Filters>(current);
  const count = activeFilterCount(draft);
  const options: { label: string; value: Filters["status"] }[] = [
    { label: "All statuses", value: "all" },
    ...SMS_STATUSES.map((status) => ({ label: SMS_STATUS_LABELS[status], value: status })),
  ];

  return (
    <>
      <SheetHeader>
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription>
          {count === 0
            ? "Narrow the SMS alerts down."
            : `${count} filter${count === 1 ? "" : "s"} selected.`}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-2">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
            {options.map((option) => {
              const isSelected = draft.status === option.value;
              return (
                <Button
                  key={option.value}
                  role="radio"
                  aria-checked={isSelected}
                  variant={isSelected ? "default" : "outline"}
                  // h-10 touch target; `bg-card` so an unselected chip isn't
                  // just a border on the sheet's own colour.
                  className={cn("h-10 rounded-full", !isSelected && "bg-card")}
                  onClick={() => setDraft((d) => ({ ...d, status: option.value }))}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Sent between</p>
          <DateRange
            filters={draft}
            onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
            stacked
          />
        </div>
      </div>

      <SheetFooter className="flex-row gap-2 pb-6">
        <Button variant="outline" className="flex-1" onClick={onReset}>
          Reset
        </Button>
        <Button className="flex-1" onClick={() => onApply(draft)}>
          Apply
        </Button>
      </SheetFooter>
    </>
  );
}

function Pager({
  page,
  totalPages,
  disabled,
  onPage,
}: {
  page: number;
  totalPages: number;
  disabled: boolean;
  onPage: (page: number) => void;
}) {
  const buttons = [
    { label: "First page", icon: ChevronsLeftIcon, to: 1, off: page <= 1 },
    { label: "Previous page", icon: ChevronLeftIcon, to: page - 1, off: page <= 1 },
    { label: "Next page", icon: ChevronRightIcon, to: page + 1, off: page >= totalPages },
    { label: "Last page", icon: ChevronsRightIcon, to: totalPages, off: page >= totalPages },
  ];
  return (
    <>
      <span className="px-1 text-muted-foreground tabular-nums">
        Page {page} of {totalPages}
      </span>
      {buttons.map(({ label, icon: Icon, to, off }) => (
        <Button
          key={label}
          variant="outline"
          size="icon-sm"
          aria-label={label}
          disabled={disabled || off}
          onClick={() => onPage(to)}
        >
          <Icon />
        </Button>
      ))}
    </>
  );
}

function Loading() {
  return (
    <p className="py-10 text-center text-sm text-muted-foreground">
      Loading SMS alerts…
    </p>
  );
}

function NoPhone() {
  return (
    <EmptyState>
      This member has no valid phone number on file, so no SMS alerts can be
      matched to them. You can still send one to any number.
    </EmptyState>
  );
}

function NoAlerts({ filtered }: { filtered: boolean }) {
  return (
    <EmptyState>
      {filtered
        ? "No SMS alerts match these filters."
        : "No SMS alerts have been sent to this member yet."}
    </EmptyState>
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
