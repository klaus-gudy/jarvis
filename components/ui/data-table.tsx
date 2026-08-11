"use client";

import * as React from "react";
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
} from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type FacetFilter = {
  columnId: string;
  placeholder: string;
  options: { label: string; value: string }[];
};

type StickyTableState = {
  sorting: SortingState;
  columnFilters: ColumnFiltersState;
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
  searchColumnId,
  searchPlaceholder = "Search…",
  facetFilters = [],
  pageSize = 10,
  emptyMessage = "No results.",
  getRowHref,
  stateKey,
}: {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchColumnId?: string;
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
}) {
  const router = useRouter();
  const remembered = stateKey ? stickyTableState.get(stateKey) : undefined;
  const [sorting, setSorting] = React.useState<SortingState>(
    remembered?.sorting ?? []
  );
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    remembered?.columnFilters ?? []
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
    stickyTableState.set(stateKey, { sorting, columnFilters, ...next });
  }

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    setSorting(next);
    remember({ sorting: next });
  };

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    const next = typeof updater === "function" ? updater(columnFilters) : updater;
    setColumnFilters(next);
    remember({ columnFilters: next });
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
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    initialState: { pagination: { pageSize } },
    state: { sorting, columnFilters, columnVisibility, rowSelection },
  });

  const searchColumn = searchColumnId ? table.getColumn(searchColumnId) : undefined;
  const selectedCount = table.getFilteredSelectedRowModel().rows.length;
  const filteredCount = table.getFilteredRowModel().rows.length;

  return (
    <Card className="gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {searchColumn && (
          <Input
            value={(searchColumn.getFilterValue() as string) ?? ""}
            onChange={(event) => searchColumn.setFilterValue(event.target.value)}
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
                table.getRowModel().rows.map((row) => {
                  const href = getRowHref?.(row.original);
                  return (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={href ? "cursor-pointer" : undefined}
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
