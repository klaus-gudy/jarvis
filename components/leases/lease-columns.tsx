"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon, Trash2Icon } from "lucide-react";

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
      accessorKey: "propertyName",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Property"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => row.original.propertyName,
    },
    {
      accessorKey: "unitLabel",
      header: "Unit",
      cell: ({ row }) => <span className="font-medium">{row.original.unitLabel}</span>,
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
      cell: ({ row }) => formatDate(new Date(row.original.endDate)),
    },
    {
      accessorKey: "durationMonths",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Duration"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => `${row.original.durationMonths} months`,
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
      accessorKey: "leaseAmount",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Lease amount"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-mr-2 ml-auto flex"
        />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono tabular-nums">
          {formatCurrencyFull(row.original.leaseAmount)}
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
            nativeButton={false}
            render={<Link href={`/leases/${row.original.id}`} />}
            aria-label={`View lease for ${row.original.tenantName}`}
          >
            <EyeIcon />
          </Button>
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
