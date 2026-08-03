"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";

import { PersonCell } from "@/components/person-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import type { LeaseRow } from "@/lib/leases";

const STATUS_VARIANT: Record<
  LeaseRow["status"],
  "secondary" | "outline" | "destructive"
> = {
  Active: "secondary",
  Upcoming: "outline",
  Ended: "outline",
};

export function buildLeaseColumns({
  onDelete,
}: {
  onDelete: (lease: LeaseRow) => void;
}): ColumnDef<LeaseRow>[] {
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
          aria-label={`Select lease for ${row.original.tenantName}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "tenantName",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Tenant"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => <PersonCell name={row.original.tenantName} />,
    },
    {
      id: "unit",
      header: "Unit",
      cell: ({ row }) => {
        const { unitLabel, propertyName } = row.original;
        return (
          <div className="leading-tight">
            <div className="font-medium">{unitLabel}</div>
            <div className="text-xs text-muted-foreground">{propertyName}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Start date"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => formatDate(new Date(row.original.startDate)),
    },
    {
      accessorKey: "endDate",
      header: "End date",
      cell: ({ row }) => {
        const { endDate } = row.original;
        return endDate ? (
          formatDate(new Date(endDate))
        ) : (
          <span className="text-muted-foreground">Ongoing</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={STATUS_VARIANT[row.original.status]}
          className="rounded-full font-normal"
        >
          {row.original.status}
        </Badge>
      ),
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
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
          {formatCurrencyFull(row.original.rentAmount)}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(row.original)}
            aria-label={`Delete lease for ${row.original.tenantName}`}
          >
            <Trash2Icon />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
