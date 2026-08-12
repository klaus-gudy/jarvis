import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * The placeholders every `loading.tsx` is built from.
 *
 * Each one mirrors the real component's own wrapper — `DataTableSkeleton` uses
 * the same `<Card className="gap-4 p-4">` and `<Table>` that `DataTable` does,
 * `MetricCardSkeleton` the same padding and figure sizes as `MetricCard` — so
 * the swap from placeholder to content doesn't shift the page under the
 * reader. A skeleton that jumps on arrival is worse than none.
 *
 * Bar widths cycle through a fixed list rather than being randomised: these
 * render on the server, and `Math.random()` would produce different markup on
 * each side of hydration.
 */
const BAR_WIDTHS = ["w-24", "w-16", "w-28", "w-20", "w-32", "w-14"];

function barWidth(index: number) {
  return BAR_WIDTHS[index % BAR_WIDTHS.length];
}

/** The date line, heading and blurb the dashboard and detail pages open with. */
export function PageHeadingSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  );
}

/**
 * Stands in for `DataTable`. `columns` and `rows` should match what the real
 * table shows on a first page, so the card is the same height either way.
 */
export function DataTableSkeleton({
  columns = 6,
  rows = 6,
  filters = 1,
  search = true,
}: {
  columns?: number;
  rows?: number;
  /** Facet selects beside the search box. */
  filters?: number;
  search?: boolean;
}) {
  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {search && <Skeleton className="h-8 w-full max-w-3xs" />}
        {Array.from({ length: filters }).map((_, index) => (
          <Skeleton key={index} className="h-8 w-36" />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, index) => (
                <TableHead key={index}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: columns }).map((_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton
                      className={cn("h-4", barWidth(rowIndex + cellIndex))}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
    </Card>
  );
}

/** Mirrors `MetricCard` — icon tile, figure, label, and the sub-stat rule. */
export function MetricCardSkeleton({ stats = true }: { stats?: boolean }) {
  return (
    <Card className="gap-0 p-0 shadow-sm">
      <div className="flex h-full flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="mt-auto pt-6">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-1.5 h-3 w-40" />
          {stats && (
            <div className="mt-3 grid grid-cols-2 gap-3 border-t pt-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Mirrors `DashboardPanel` — bordered header, then divided rows. */
export function DashboardPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="gap-0 p-0 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
      <ul className="divide-y">
        {Array.from({ length: rows }).map((_, index) => (
          <li key={index} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className={cn("h-4", barWidth(index))} />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-4 w-12 shrink-0" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Mirrors `PropertyCard` on the properties grid. */
export function PropertyCardSkeleton() {
  return (
    <Card className="gap-0 p-0 shadow-sm">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-3 border-t pt-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** A label/value `<dl>` card, as used across the lease, property and member detail pages. */
export function DetailCardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Card className="gap-4 p-5 shadow-sm">
      <Skeleton className="h-5 w-32" />
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className={cn("h-4", barWidth(index))} />
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The underlined tab strip on the property, lease and member detail pages. */
export function TabsSkeleton({ tabs = 3 }: { tabs?: number }) {
  return (
    <div className="flex gap-6 border-b pb-2">
      {Array.from({ length: tabs }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-20" />
      ))}
    </div>
  );
}

/** Mirrors the property form: a couple of two-column rows, then the accordion. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="max-w-3xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <Card className="gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: fields }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </Card>
    </div>
  );
}
