"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Loader2Icon,
  MessageSquareIcon,
  XIcon,
} from "lucide-react";

import { SendSmsDialog } from "@/components/members/send-sms-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SMS_DEFAULT_PAGE_SIZE,
  SMS_PAGE_SIZES,
  SMS_STATUSES,
  SMS_STATUS_LABELS,
  type SmsAlertsPage,
  type SmsStatus,
} from "@/lib/sms/sms-types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<SmsStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PROCESSING: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  SENT: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DELIVERED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  FAILED: "bg-destructive/10 text-destructive",
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Dar_es_Salaam",
});

type Filters = {
  status: SmsStatus | "all";
  from: string;
  to: string;
  page: number;
  limit: number;
};

const NO_FILTERS: Filters = {
  status: "all",
  from: "",
  to: "",
  page: 1,
  limit: SMS_DEFAULT_PAGE_SIZE,
};

type Outcome =
  | { kind: "ok"; data: SmsAlertsPage & { recipient: string } }
  | { kind: "no-phone" }
  | { kind: "error"; message: string };

function toQueryString(filters: Filters) {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
  });
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
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
  const [filters, setFilters] = React.useState<Filters>(NO_FILTERS);
  // Bumped after a send so the same query is asked again.
  const [revision, setRevision] = React.useState(0);
  // Keyed by the query that produced it, so "loading" is derived rather than
  // set inside the effect: the result on screen belongs to an older query.
  const [result, setResult] = React.useState<{ key: string; outcome: Outcome } | null>(
    null
  );

  const queryString = toQueryString(filters);
  const requestKey = `${queryString}#${revision}`;
  const loading = result?.key !== requestKey;

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/members/${membershipId}/sms?${queryString}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        let outcome: Outcome;
        if (response.ok && body.reason === "no-phone") {
          outcome = { kind: "no-phone" };
        } else if (response.ok) {
          outcome = { kind: "ok", data: body };
        } else if (body.reason === "not-configured") {
          outcome = {
            kind: "error",
            message: "SMS history isn't set up on this server (NOTIFIER_API_URL is missing).",
          };
        } else {
          outcome = {
            kind: "error",
            message: "The SMS service couldn't be reached. Try again in a moment.",
          };
        }
        setResult({ key: requestKey, outcome });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setResult({
          key: requestKey,
          outcome: { kind: "error", message: "Couldn't load SMS alerts." },
        });
      });
    return () => controller.abort();
  }, [membershipId, queryString, requestKey]);

  // Any filter change starts again from the first page.
  const update = (patch: Partial<Omit<Filters, "page">>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));
  const goTo = (page: number) => setFilters((current) => ({ ...current, page }));

  const filtered =
    filters.status !== "all" || filters.from !== "" || filters.to !== "";
  const outcome = result?.outcome;
  const data = outcome?.kind === "ok" ? outcome.data : null;

  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.status}
          onValueChange={(next) => update({ status: next as Filters["status"] })}
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

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          From
          <Input
            type="date"
            className="h-7 w-36 bg-background text-sm"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => update({ from: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          To
          <Input
            type="date"
            className="h-7 w-36 bg-background text-sm"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => update({ to: event.target.value })}
          />
        </label>

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

        <div className="ml-auto flex items-center gap-2">
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
                <span className="px-1 text-muted-foreground tabular-nums">
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
