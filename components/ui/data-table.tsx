"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  MoreVerticalIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type FacetFilter = {
  columnId: string;
  /** Shown in the closed select, and used as the "no filter" option. */
  placeholder: string;
  /**
   * Field name for the mobile filter sheet, where the select carries its own
   * caption above it. Without this the caption repeats the placeholder —
   * "All statuses" over a control already reading "All statuses". Falls back
   * to the placeholder, so a filter that hasn't been given one still reads.
   */
  label?: string;
  options: { label: string; value: string }[];
};

/**
 * One thing you can do to a row. On mobile these fill a bottom sheet, where a
 * strip of 28px icon buttons would be unusable; a table that also shows them on
 * desktop should build its actions column from this same list rather than a
 * second copy, so the two can't offer different things.
 */
export type RowAction = {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** A destination. Mutually exclusive with `onSelect`. */
  href?: string;
  onSelect?: () => void;
  tone?: "default" | "destructive";
  /**
   * Shown but not usable, rather than omitted.
   *
   * Keeping the slot means the actions sit in the same order on every row, so
   * the one you want is always in the same place — dropping an action shifts
   * everything after it and turns a familiar position into a misclick.
   */
  disabled?: boolean;
  /** Why it is unavailable. Surfaced on hover, and beside the label on mobile. */
  disabledReason?: string;
};

/** Rows added each time the sentinel comes into view. */
const MOBILE_PAGE = 8;

type StickyTableState = {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
  globalFilter: string;
};

/**
 * What each table was filtered and sorted by, kept for the life of the tab.
 *
 * Deliberately a module-level map rather than storage: it is empty on the
 * server *and* on a fresh page load, so the first render matches on both sides
 * and there is no hydration mismatch to paper over — and it only ever holds a
 * value after a client-side navigation, which is exactly the case being fixed
 * ("I set a filter, went to another page, came back, and it was gone").
 *
 * A hard reload starts clean, which is the right default for a filter: it
 * should never be a hidden reason a list looks empty.
 */
const stickyTableState = new Map<string, StickyTableState>();

export function DataTable<TData, TValue>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = "Search…",
  facetFilters = [],
  pageSize = 10,
  emptyMessage = "No results.",
  getRowHref,
  stateKey,
  renderCard,
  rowActions,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /**
   * The box searches **every column**, not one nominated field, so a tenant can
   * be found by phone or unit as readily as by name. Placeholders stay
   * table-specific ("Search leases…") because they name the thing being
   * searched, not the field.
   *
   * Columns with no accessor — the select checkbox, the actions cell — are
   * excluded by TanStack automatically, as are values that aren't strings or
   * numbers.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  facetFilters?: FacetFilter[];
  pageSize?: number;
  emptyMessage?: string;
  /**
   * Detail route for a row. Supplying it makes double-clicking the row navigate
   * there. Rows stay single-click inert, so selecting text and using the
   * checkbox still behave normally; the explicit view button in the actions
   * column remains the keyboard-reachable path.
   */
  getRowHref?: (row: TData) => string | undefined;
  /**
   * Opt in to remembering this table's search, filters and sort while the tab
   * lives. Must be unique per table; include an id for a table that appears
   * once per entity, so one property's filters can't show up on another's.
   */
  stateKey?: string;
  /**
   * Renders one row as a card. Supplying it is what turns on the mobile view —
   * a table under 768px either scrolls sideways or crushes its columns, and
   * neither is worth reading. Without it, mobile keeps the scrolling table.
   */
  renderCard?: (row: TData) => React.ReactNode;
  /** Row actions for the mobile sheet. See `RowAction`. */
  rowActions?: (row: TData) => RowAction[];
}) {
  const router = useRouter();
  const isMobile = useIsMobile();
  // `useIsMobile` reports desktop on the server, so the first client render
  // matches the server markup and only then swaps — no hydration mismatch.
  const asCards = isMobile && Boolean(renderCard);

  const [visibleCount, setVisibleCount] = React.useState(MOBILE_PAGE);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [actionsRow, setActionsRow] = React.useState<TData | null>(null);
  const remembered = stateKey ? stickyTableState.get(stateKey) : undefined;
  const [sorting, setSorting] = React.useState<SortingState>(
    remembered?.sorting ?? []
  );
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    remembered?.columnFilters ?? []
  );
  const [globalFilter, setGlobalFilter] = React.useState(
    remembered?.globalFilter ?? ""
  );
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  /**
   * Written from the change handlers rather than during render or an effect —
   * the value is known at the moment the user acts, and the codebase's
   * set-state-in-effect rule rules out the usual "sync it afterwards" shape.
   */
  function remember(next: Partial<StickyTableState>) {
    if (!stateKey) return;
    stickyTableState.set(stateKey, {
      sorting,
      columnFilters,
      globalFilter,
      ...next,
    });
  }

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    setSorting(next);
    remember({ sorting: next });
    // Written from the change handler, not an effect: re-sorting reorders the
    // whole list, so the eight rows already revealed are no longer the eight
    // the reader was looking at.
    setVisibleCount(MOBILE_PAGE);
  };

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater;
    setColumnFilters(next);
    remember({ columnFilters: next });
    setVisibleCount(MOBILE_PAGE);
  };

  const handleGlobalFilterChange: OnChangeFn<string> = (updater) => {
    const next = typeof updater === "function" ? updater(globalFilter) : updater;
    setGlobalFilter(next);
    remember({ globalFilter: next });
    // The search narrows the list too, so the mobile window resets with it —
    // it no longer arrives through `handleColumnFiltersChange`, which is where
    // this used to be handled when search was a column filter.
    setVisibleCount(MOBILE_PAGE);
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onGlobalFilterChange: handleGlobalFilterChange,
    // Explicit rather than the `auto` default, which picks a matcher from the
    // value's type and would rank-sort some columns and substring-match others.
    globalFilterFn: "includesString",
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    /**
     * Identify a row by its record's own id, not its position.
     *
     * TanStack defaults to the array index, which makes "row 0" a different
     * record the moment a filter or sort changes. Two things depend on getting
     * this right: React reuses the `<TableRow>` for a row that survives a
     * filter change instead of tearing it down and building another (so the
     * enter animation below plays only for rows that genuinely just appeared),
     * and row selection follows the record rather than sticking to whatever
     * now occupies that slot.
     *
     * Falls back to the index for any data that has no id.
     */
    getRowId: (row, index) => {
      const id = (row as { id?: unknown }).id;
      return typeof id === "string" ? id : String(index);
    },
    initialState: { pagination: { pageSize } },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
  });
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const filteredCount = table.getFilteredRowModel().rows.length;

  if (asCards) {
    // Sorted-but-unpaginated: on mobile the page size is replaced by a window
    // that only ever grows, so pagination controls never appear.
    const allRows = table.getSortedRowModel().rows;
    const shown = allRows.slice(0, visibleCount);
    const more = allRows.length - shown.length;

    const activeFacetCount = facetFilters.filter((filter) =>
      columnFilters.some(
        (columnFilter) => columnFilter.id === filter.columnId
      )
    ).length;

    return (
      <div className="space-y-3">
        {/*
          Sticky, and the search is always here rather than behind the filter
          button: searching is the common case and should cost no taps, while
          the facets are the occasional case and can afford a sheet.
          `-mx-4 px-4` bleeds it to the edges of the page's own p-4 gutter.
        */}
        <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur">
          {searchable && (
            <Input
              value={globalFilter}
              onChange={(event) => table.setGlobalFilter(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 flex-1 bg-card"
              aria-label={searchPlaceholder}
            />
          )}

          {facetFilters.length > 0 && (
            <Button
              variant="outline"
              className="h-9 shrink-0 bg-card"
              onClick={() => setFiltersOpen(true)}
              aria-label="Filters"
            >
              <SlidersHorizontalIcon />
              Filters
              {activeFacetCount > 0 && (
                <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground tabular-nums">
                  {activeFacetCount}
                </span>
              )}
            </Button>
          )}
        </div>

        {shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {shown.map((row, index) => {
              const href = getRowHref?.(row.original);
              const actions = rowActions?.(row.original) ?? [];
              const body = renderCard!(row.original);

              return (
                <li
                  key={row.id}
                  className={cn(
                    "flex items-start gap-1 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10",
                    "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-200"
                  )}
                  style={{
                    // Only the newly revealed rows stagger — the ones already on
                    // screen keep their DOM nodes and never re-animate, the same
                    // `getRowId` property the desktop rows rely on.
                    animationDelay: `${Math.min(index % MOBILE_PAGE, 7) * 25}ms`,
                    animationFillMode: "both",
                  }}
                >
                  {/* A link beside the actions button, not wrapped around it —
                      a <button> inside an <a> is invalid, and the stretched-link
                      alternative costs the card its text selection. */}
                  {href ? (
                    <Link href={href} className="min-w-0 flex-1 outline-none">
                      {body}
                    </Link>
                  ) : (
                    <div className="min-w-0 flex-1">{body}</div>
                  )}

                  {actions.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="-mr-1 shrink-0"
                      onClick={() => setActionsRow(row.original)}
                      aria-label="Actions"
                    >
                      <MoreVerticalIcon />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {more > 0 && (
          /*
           * Remounted on every growth (`key`), which is what makes repeated
           * loads work: an IntersectionObserver fires on a *change* of
           * intersection, so a sentinel that stays on screen after a short
           * batch would never fire twice. A fresh node re-observes and fires
           * immediately if it is still in view.
           */
          <LoadMoreSentinel
            key={visibleCount}
            remaining={more}
            onReach={() => setVisibleCount((count) => count + MOBILE_PAGE)}
          />
        )}

        {allRows.length > 0 && more === 0 && (
          <p className="pt-1 pb-2 text-center text-xs text-muted-foreground">
            {allRows.length} {allRows.length === 1 ? "result" : "results"}
          </p>
        )}

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="bottom" className="max-h-[85vh]">
            {/* Keyed on open so the draft re-seeds from the live filters each
                time, rather than being synced back by an effect. */}
            <FilterSheetBody
              key={String(filtersOpen)}
              facetFilters={facetFilters}
              current={Object.fromEntries(
                columnFilters.map((filter) => [filter.id, String(filter.value)])
              )}
              onApply={(draft) => {
                /*
                 * Applied as ONE `setColumnFilters`, never a loop of
                 * `setFilterValue` calls.
                 *
                 * Each `setFilterValue` resolves its updater against
                 * `columnFilters` as captured in the current render, so two
                 * calls in the same tick both start from the same stale array
                 * and the second silently discards the first — with two facets
                 * selected, only the last one survived Apply.
                 *
                 * Non-facet filters are carried over untouched, which is what
                 * keeps the search box working alongside the facets.
                 */
                const facetIds = new Set(
                  facetFilters.map((filter) => filter.columnId)
                );

                table.setColumnFilters([
                  ...columnFilters.filter((filter) => !facetIds.has(filter.id)),
                  ...facetFilters
                    .filter(
                      (filter) => (draft[filter.columnId] ?? "all") !== "all"
                    )
                    .map((filter) => ({
                      id: filter.columnId,
                      value: draft[filter.columnId],
                    })),
                ]);

                setFiltersOpen(false);
                // Back to the top of the new results. Applying a facet while
                // scrolled deep otherwise leaves you in the middle of a list
                // that just changed underneath you — and the window reset is
                // undone anyway, since the sentinel is in view down there.
                //
                // Deliberately *not* done for the search box: that fires per
                // keystroke, and yanking the page to the top on every letter
                // is unusable.
                window.scrollTo({ top: 0 });
              }}
              onReset={() => {
                // One call, for the same reason as Apply above — looping
                // `setFilterValue(undefined)` over two facets left the first
                // one still applied.
                //
                // The search box is deliberately untouched: it is visible and
                // clearable on its own, and wiping it from a panel the reader
                // can't see it in would look like the list broke. Keeping every
                // non-facet filter is what preserves it.
                const facetIds = new Set(
                  facetFilters.map((filter) => filter.columnId)
                );
                table.setColumnFilters(
                  columnFilters.filter((filter) => !facetIds.has(filter.id))
                );

                setFiltersOpen(false);
                window.scrollTo({ top: 0 });
              }}
            />
          </SheetContent>
        </Sheet>

        <Sheet
          open={actionsRow !== null}
          onOpenChange={(open) => !open && setActionsRow(null)}
        >
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Actions</SheetTitle>
              <SheetDescription className="sr-only">
                Choose an action for the selected row.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4 pb-6">
              {(actionsRow ? (rowActions?.(actionsRow) ?? []) : []).map(
                (action) => {
                  const Icon = action.icon;
                  const className = cn(
                    "h-11 justify-start gap-3 px-3 text-sm",
                    action.tone === "destructive" &&
                      "text-destructive hover:text-destructive"
                  );

                  // Kept in place rather than dropped, so every row's sheet
                  // lists the same actions in the same order. The reason sits
                  // beside the label, since a greyed row with no explanation
                  // just raises the question.
                  if (action.disabled) {
                    return (
                      <Button
                        key={action.label}
                        variant="ghost"
                        className={className}
                        disabled
                        aria-disabled
                      >
                        {Icon && <Icon />}
                        {action.label}
                        {action.disabledReason && (
                          <span className="ml-auto text-xs font-normal">
                            {action.disabledReason}
                          </span>
                        )}
                      </Button>
                    );
                  }

                  if (action.href) {
                    return (
                      <Button
                        key={action.label}
                        variant="ghost"
                        className={className}
                        nativeButton={false}
                        render={<Link href={action.href} />}
                        onClick={() => setActionsRow(null)}
                      >
                        {Icon && <Icon />}
                        {action.label}
                      </Button>
                    );
                  }

                  return (
                    <Button
                      key={action.label}
                      variant="ghost"
                      className={className}
                      onClick={() => {
                        // Closed first: the action usually opens a dialog, and
                        // two layered overlays trap focus in the wrong one.
                        setActionsRow(null);
                        action.onSelect?.();
                      }}
                    >
                      {Icon && <Icon />}
                      {action.label}
                    </Button>
                  );
                }
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <Card className="gap-4 p-4" data-tour="data-table">
      <div className="flex flex-wrap items-center gap-2">
        {searchable && (
          <Input
            value={globalFilter}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full max-w-3xs bg-background"
            aria-label={searchPlaceholder}
          />
        )}

        {facetFilters.map((filter) => {
          const column = table.getColumn(filter.columnId);
          if (!column) return null;
          const value = (column.getFilterValue() as string) ?? "all";
          return (
            <Select
              key={filter.columnId}
              value={value}
              onValueChange={(next) =>
                column.setFilterValue(next === "all" ? undefined : next)
              }
            >
              <SelectTrigger
                size="sm"
                className="w-36 bg-background"
                aria-label={filter.placeholder}
              >
                {/* Base UI renders the raw value unless given a formatter. */}
                <SelectValue>
                  {(selected: string) =>
                    filter.options.find((option) => option.value === selected)?.label ??
                    filter.placeholder
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{filter.placeholder}</SelectItem>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}

        {columnFilters.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
            className="h-8"
          >
            Reset
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border bg-background">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row, rowIndex) => {
                  const href = getRowHref?.(row.original);
                  return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                      // Plays on mount only, so with the stable `getRowId`
                      // above it marks rows arriving in the view — a filter
                      // loosening, a page turn, the first paint — and stays
                      // quiet for rows that were already here.
                      "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 duration-200",
                      href && "cursor-pointer"
                    )}
                    style={{
                      // Cascades down the page, capped so a 50-row page still
                      // finishes arriving in under half a second.
                      animationDelay: `${Math.min(rowIndex, 10) * 25}ms`,
                      // tw-animate-css leaves fill-mode at `none`, which would
                      // paint the row in place for the length of its delay and
                      // only then snap back to animate. `both` holds it at the
                      // start state until its turn.
                      animationFillMode: "both",
                    }}
                    onDoubleClick={
                      href
                        ? (event) => {
                            // Ignore double-clicks that land on a control —
                            // the checkbox, the row's own action buttons, or a
                            // link already do their own thing.
                            if (
                              (event.target as HTMLElement).closest(
                                "a,button,input,select,textarea,[role=checkbox]"
                              )
                            ) {
                              return;
                            }
                            // Double-click selects a word first; drop it so the
                            // page isn't left with a stray highlight.
                            window.getSelection()?.removeAllRanges();
                            router.push(href);
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {selectedCount > 0
            ? `${selectedCount} of ${filteredCount} row(s) selected`
            : `${filteredCount} row(s)`}
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(next) => table.setPageSize(Number(next))}
            >
              <SelectTrigger
                size="sm"
                className="w-17 bg-background"
                aria-label="Rows per page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[5, 10, 20, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * The desktop actions cell, rendered from the same `RowAction[]` the mobile
 * sheet is given. Every table with an icon strip goes through here, so the
 * strip's spacing, sizing and accessible naming are defined once — and adding
 * an action to a table adds it to both surfaces or neither.
 *
 * The label doubles as the accessible name, which is why callers write it as
 * "Remove Amani Mwakalinga" rather than "Remove".
 */
export function RowActionButtons({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex justify-end gap-1">
      {actions.map((action) => {
        const Icon = action.icon;
        const shared = {
          variant: "outline" as const,
          size: "icon-sm" as const,
          "aria-label": action.label,
          title: action.disabled ? action.disabledReason : undefined,
          // Border stays neutral like its neighbours; only the glyph goes red,
          // so danger reads from the icon rather than the frame. No hover fill
          // — the hover shadow is the button's only hover feedback.
          className: cn(action.tone === "destructive" && "text-destructive"),
        };

        // A disabled action renders as a button even when it would normally be
        // a link: an anchor has no disabled state, and `pointer-events-none`
        // would leave it focusable and followable by keyboard.
        if (action.disabled) {
          return (
            <Button key={action.label} {...shared} disabled aria-disabled>
              {Icon && <Icon />}
            </Button>
          );
        }

        return action.href ? (
          <Button
            key={action.label}
            {...shared}
            nativeButton={false}
            render={<Link href={action.href} />}
          >
            {Icon && <Icon />}
          </Button>
        ) : (
          <Button key={action.label} {...shared} onClick={action.onSelect}>
            {Icon && <Icon />}
          </Button>
        );
      })}
    </div>
  );
}

/**
 * Reveals the next batch when it scrolls into view.
 *
 * The observer is created in a **ref callback** rather than an effect — React
 * 19 runs the returned cleanup when the node detaches, which gives the same
 * lifecycle without an effect, and without tripping the codebase's
 * set-state-in-effect rule. `rootMargin` starts the next batch before the
 * reader reaches the bottom, so the list feels continuous rather than paged.
 */
function LoadMoreSentinel({
  remaining,
  onReach,
}: {
  remaining: number;
  onReach: () => void;
}) {
  const attach = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) onReach();
        },
        { rootMargin: "240px" }
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [onReach]
  );

  return (
    <div ref={attach} className="flex justify-center py-4">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-3.5 animate-spin rounded-full border-2 border-transparent border-t-stat-accent" />
        {remaining} more
      </span>
    </div>
  );
}

/**
 * The filter sheet's body. Its own component so the draft can be seeded from
 * props at mount and re-seeded by a `key` remount — the pattern this codebase
 * uses for every dialog form, in place of an effect that syncs state to props.
 *
 * Draft rather than live: on a sheet that covers the list, applying each choice
 * immediately means changing three facets against results nobody can see.
 *
 * **Chips, not the `Select` the desktop toolbar uses.** A select popup is an
 * anchored overlay, and this sheet is already pinned to the bottom of the
 * viewport — so the popup had nowhere to open. It rendered over the sheet,
 * overflowed the screen edge with its last options unreachable, and covered
 * Reset and Apply. Its portal also carries `z-50`, the same as the sheet, so
 * which of the two painted on top during the open/close transition came down
 * to DOM order, which is what made the transition look wrong.
 *
 * Laying the options out inline removes the nested overlay entirely rather than
 * fighting it, halves the taps, and matches the pills the properties page
 * already uses for exactly this job.
 */
function FilterSheetBody({
  facetFilters,
  current,
  onApply,
  onReset,
}: {
  facetFilters: FacetFilter[];
  current: Record<string, string>;
  onApply: (draft: Record<string, string>) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      facetFilters.map((filter) => [
        filter.columnId,
        current[filter.columnId] ?? "all",
      ])
    )
  );

  const activeCount = Object.values(draft).filter(
    (value) => value !== "all"
  ).length;

  return (
    <>
      <SheetHeader>
        <SheetTitle>Filters</SheetTitle>
        <SheetDescription>
          {activeCount === 0
            ? "Narrow the list down."
            : `${activeCount} filter${activeCount === 1 ? "" : "s"} selected.`}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-2">
        {facetFilters.map((filter) => {
          const fieldName = filter.label ?? filter.placeholder;
          const selected = draft[filter.columnId] ?? "all";

          return (
            <div key={filter.columnId} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {fieldName}
              </p>
              {/* Single choice per facet, so radio semantics rather than a set
                  of independent toggles. The placeholder leads as the "no
                  filter" option, the same role it plays in the select. */}
              <div
                role="radiogroup"
                aria-label={fieldName}
                className="flex flex-wrap gap-2"
              >
                {[{ label: filter.placeholder, value: "all" }, ...filter.options].map(
                  (option) => {
                    const isSelected = selected === option.value;
                    return (
                      <Button
                        key={option.value}
                        role="radio"
                        aria-checked={isSelected}
                        variant={isSelected ? "default" : "outline"}
                        // h-10 for a comfortable touch target; `bg-card`
                        // because `outline`'s own fill is the sheet's colour
                        // and would leave only the border showing.
                        className={cn("h-10 rounded-full", !isSelected && "bg-card")}
                        onClick={() =>
                          setDraft((previous) => ({
                            ...previous,
                            [filter.columnId]: option.value,
                          }))
                        }
                      >
                        {option.label}
                      </Button>
                    );
                  }
                )}
              </div>
            </div>
          );
        })}
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

/** Sortable header button, so column defs stay declarative. */
export function DataTableColumnHeader({
  title,
  sorted,
  onToggle,
  className,
}: {
  title: string;
  sorted: false | "asc" | "desc";
  onToggle: () => void;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={className}
      aria-label={`Sort by ${title}`}
    >
      {title}
      <span aria-hidden className="ml-1 text-muted-foreground">
        {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}
      </span>
    </Button>
  );
}
