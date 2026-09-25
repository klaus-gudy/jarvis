"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ExpiryTag } from "@/components/leases/expiry-tag";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader, facetFilterFn } from "@/components/ui/data-table";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import type { LeaseExpiry, LeaseStatus } from "@/lib/leases";

export const LEASE_STATUS_VARIANT: Record<
  LeaseStatus,
  "secondary" | "outline" | "destructive"
> = {
  Active: "secondary",
  Upcoming: "outline",
  Ended: "outline",
  Renewed: "outline",
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
  expiry: LeaseExpiry | null;
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
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {formatDate(new Date(row.original.endDate))}
          <ExpiryTag expiry={row.original.expiry} />
        </div>
      ),
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
          variant={LEASE_STATUS_VARIANT[row.original.status]}
          className="rounded-full font-normal"
        >
          {row.original.status}
        </Badge>
      ),
      filterFn: facetFilterFn,
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
