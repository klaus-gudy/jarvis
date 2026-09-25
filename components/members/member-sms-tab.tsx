"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  MessageSquareIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
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

type Filters = { status: SmsStatus | "all"; from: string; to: string; page: number };

const NO_FILTERS: Filters = { status: "all", from: "", to: "", page: 1 };

type Outcome =
  | { kind: "ok"; data: SmsAlertsPage & { recipient: string } }
  | { kind: "no-phone" }
  | { kind: "error"; message: string };

function toQueryString(filters: Filters) {
  const params = new URLSearchParams({ page: String(filters.page) });
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
 * on — or fail with — it. Filtering and paging are done by notifier, so this
 * holds one page at a time rather than a `DataTable` over everything.
 */
export function MemberSmsTab({ membershipId }: { membershipId: string }) {
  const [filters, setFilters] = React.useState<Filters>(NO_FILTERS);
  // Keyed by the query that produced it, so "loading" is derived rather than
  // set inside the effect: the result on screen belongs to an older query.
  const [result, setResult] = React.useState<{ key: string; outcome: Outcome } | null>(
    null
  );

  const queryString = toQueryString(filters);
  const loading = result?.key !== queryString;

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
        setResult({ key: queryString, outcome });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setResult({
          key: queryString,
          outcome: { kind: "error", message: "Couldn't load SMS alerts." },
        });
      });
    return () => controller.abort();
  }, [membershipId, queryString]);

  // Any filter change starts again from the first page.
  const update = (patch: Partial<Omit<Filters, "page">>) =>
    setFilters((current) => ({ ...current, ...patch, page: 1 }));

  const filtered =
    filters.status !== "all" || filters.from !== "" || filters.to !== "";
  const outcome = result?.outcome;

  if (outcome?.kind === "no-phone") {
    return (
      <EmptyState>
        This member has no valid phone number on file, so no SMS alerts can be
        matched to them.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
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
            className="h-8 w-38 bg-background"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => update({ from: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          To
          <Input
            type="date"
            className="h-8 w-38 bg-background"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => update({ to: event.target.value })}
          />
        </label>

        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(NO_FILTERS)}>
            <XIcon />
            Reset
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {loading && <Loader2Icon className="size-3.5 animate-spin" aria-hidden />}
          {outcome?.kind === "ok" && (
            <span>
              {outcome.data.total} message{outcome.data.total === 1 ? "" : "s"} to{" "}
              <span className="font-mono">+{outcome.data.recipient}</span>
            </span>
          )}
        </div>
      </div>

      {outcome?.kind === "error" && (
        <EmptyState tone="error">{outcome.message}</EmptyState>
      )}

      {outcome?.kind === "ok" && outcome.data.alerts.length === 0 && (
        <EmptyState>
          {filtered
            ? "No SMS alerts match these filters."
            : "No SMS alerts have been sent to this member yet."}
        </EmptyState>
      )}

      {outcome?.kind === "ok" && outcome.data.alerts.length > 0 && (
        <ul className={cn("space-y-2 transition-opacity", loading && "opacity-60")}>
          {outcome.data.alerts.map((alert) => (
            <li key={alert.id}>
              <Card size="sm">
                <CardContent className="space-y-2">
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
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {outcome?.kind === "ok" && outcome.data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">
            Page {outcome.data.page} of {outcome.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={loading || filters.page <= 1}
            onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={loading || filters.page >= outcome.data.totalPages}
            onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      )}

      {!outcome && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Loading SMS alerts…
        </p>
      )}
    </div>
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
