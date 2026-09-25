"use client";

import type { ColumnDef } from "@tanstack/react-table";

import {
  DataTableColumnHeader,
  facetFilterFn,
  RowActionButtons,
  type RowAction,
} from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrencyFull } from "@/lib/format";

export type UnitRow = {
  id: string;
  label: string;
  rentAmount: number;
  minTenureMonths: number | null;
  autoRenew: boolean;
  unitType: string | null;
  floor: string | null;
  block: string | null;
  sizeSqm: number | null;
  amenities: string[];
  status: "Occupied" | "Vacant";
  tenantName: string | null;
  leaseStart: string | null;
  /** Just enough to draw the strip in the View dialog: id is the URL, name is the alt text. */
  photos: { id: string; fileName: string }[];
};

/**
 * Floor, block, size, minimum tenure and amenities don't get columns — they
 * only ever show up in the View dialog, opened from the row actions.
 */
export function buildUnitColumns({
  rowActions,
}: {
  rowActions: (unit: UnitRow) => RowAction[];
}): ColumnDef<UnitRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
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
      cell: ({ row }) => (
        <div className="font-medium">{row.original.label}</div>
      ),
    },
    {
      accessorKey: "unitType",
      header: "Type",
      cell: ({ row }) => {
        const { unitType, sizeSqm } = row.original;
        return (
          <div className="leading-tight">
            <div>{unitType ?? "—"}</div>
            {sizeSqm != null && (
              <div className="text-xs text-muted-foreground">{sizeSqm} m²</div>
            )}
          </div>
        );
      },
      filterFn: facetFilterFn,
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
      filterFn: facetFilterFn,
    },
    {
      accessorKey: "tenantName",
      header: "Tenant",
      cell: ({ row }) => {
        const { tenantName } = row.original;
        return (
          <div className="leading-tight">
            <div className="text-muted-foreground">{tenantName ?? "—"}</div>
          </div>
        );
      },
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
        // minTenureMonths stays background data — kept on the row for the edit
        // dialog, but not surfaced in this table.
        <div className="text-right font-mono tabular-nums">
          {formatCurrencyFull(row.original.rentAmount)}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <RowActionButtons actions={rowActions(row.original)} />,
      enableSorting: false,
    },
  ];
}
