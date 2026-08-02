"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDate, formatMoneyFull } from "@/lib/format";

export type UnitRow = {
  id: string;
  label: string;
  rentAmount: number;
  status: "Occupied" | "Vacant";
  tenantName: string | null;
  leaseStart: string | null;
};

export const unitColumns: ColumnDef<UnitRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        // base-ui takes indeterminate as its own prop rather than a checked value.
        indeterminate={table.getIsSomePageRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked)}
        aria-label="Select all rows"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked)}
        aria-label={`Select unit ${row.original.label}`}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "label",
    header: ({ column }) => (
      <DataTableColumnHeader
        title="Unit"
        sorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-2"
      />
    ),
    cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "Occupied" ? "secondary" : "outline"}
        className="rounded-full font-normal"
      >
        {row.original.status}
      </Badge>
    ),
    // Exact match so the Occupied/Vacant dropdown filters cleanly.
    filterFn: (row, columnId, filterValue) =>
      row.getValue(columnId) === filterValue,
  },
  {
    accessorKey: "tenantName",
    header: "Tenant",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.tenantName ?? "—"}</span>
    ),
  },
  {
    accessorKey: "leaseStart",
    header: ({ column }) => (
      <DataTableColumnHeader
        title="Lease start"
        sorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-ml-2"
      />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.leaseStart ? formatDate(new Date(row.original.leaseStart)) : "—"}
      </span>
    ),
  },
  {
    accessorKey: "rentAmount",
    header: ({ column }) => (
      <DataTableColumnHeader
        title="Rent / month"
        sorted={column.getIsSorted()}
        onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="-mr-2 ml-auto flex"
      />
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono tabular-nums">
        TSh {formatMoneyFull(row.original.rentAmount)}
      </div>
    ),
  },
];
