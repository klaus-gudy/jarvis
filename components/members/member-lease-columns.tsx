"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import type { LeaseStatus } from "@/lib/leases";

const STATUS_VARIANT: Record<LeaseStatus, "secondary" | "outline" | "destructive"> = {
  Active: "secondary",
  Upcoming: "outline",
  Ended: "outline",
};

export type MemberLeaseRow = {
  id: string;
  reference: string;
  propertyName: string;
  unitLabel: string;
  startDate: string;
  endDate: string;
  durationMonths: number;
  leaseAmount: number;
  status: LeaseStatus;
};

/**
 * The org-wide leases table minus its Tenant column — every row here already
 * belongs to the member whose page this is.
 */
export function buildMemberLeaseColumns(): ColumnDef<MemberLeaseRow>[] {
  return [
    {
      accessorKey: "reference",
      header: "Lease",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">
          {row.original.reference}
        </span>
      ),
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
      cell: ({ row }) => (
        <span className="font-medium">{row.original.unitLabel}</span>
      ),
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
      header: "Duration",
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
  ];
}
