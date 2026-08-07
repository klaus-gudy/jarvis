"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { PencilIcon, Trash2Icon } from "lucide-react";

import { DataTableColumnHeader } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrencyFull } from "@/lib/format";

export type UnitRow = {
  id: string;
  label: string;
  rentAmount: number;
  minTenureMonths: number | null;
  unitType: string | null;
  floor: string | null;
  block: string | null;
  sizeSqm: number | null;
  amenities: string[];
  status: "Occupied" | "Vacant";
  tenantName: string | null;
  leaseStart: string | null;
};

/** Secondary lines keep six extra attributes readable without six extra columns. */
export function buildUnitColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (unit: UnitRow) => void;
  onDelete: (unit: UnitRow) => void;
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
      cell: ({ row }) => {
        const { label, block, floor } = row.original;
        const place = [block ? `Block ${block}` : null, floor ? `Floor ${floor}` : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <div className="leading-tight">
            <div className="font-medium">{label}</div>
            {place && <div className="text-xs text-muted-foreground">{place}</div>}
          </div>
        );
      },
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
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
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
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
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
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(row.original)}
            aria-label={`Edit unit ${row.original.label}`}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(row.original)}
            aria-label={`Delete unit ${row.original.label}`}
          >
            <Trash2Icon />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
