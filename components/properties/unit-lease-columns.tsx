"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { TenantHoverCard } from "@/components/hover-cards/tenant-hover-card";
import { ExpiryTag } from "@/components/leases/expiry-tag";
import { LEASE_STATUS_VARIANT } from "@/components/members/member-lease-columns";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader, facetFilterFn } from "@/components/ui/data-table";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import type { LeaseExpiry, LeaseStatus } from "@/lib/leases";

export type UnitLeaseRow = {
  id: string;
  reference: string;
  tenantName: string;
  membershipId: string;
  tenantPhone: string | null;
  tenantEmail: string | null;
  tenantPhotoId: string | null;
  startDate: string;
  endDate: string;
  durationMonths: number;
  monthlyRent: number;
  leaseAmount: number;
  status: LeaseStatus;
  expiry: LeaseExpiry | null;
};

/**
 * A member's lease table turned the other way round: every row is already on
 * this unit, so Property and Unit give way to the tenant, and the agreed rent
 * is shown because it is what changes from one term to the next here.
 */
export function buildUnitLeaseColumns({
  canReadTenants,
}: {
  /** The tenant's name previews and links only when the member page would open. */
  canReadTenants: boolean;
}): ColumnDef<UnitLeaseRow>[] {
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
      accessorKey: "tenantName",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Tenant"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => (
        <TenantHoverCard
          tenant={{
            name: row.original.tenantName,
            phone: row.original.tenantPhone,
            email: row.original.tenantEmail,
            photoId: row.original.tenantPhotoId,
          }}
          href={canReadTenants ? `/members/${row.original.membershipId}` : null}
          className="font-medium hover:underline"
          align="start"
        />
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
      accessorKey: "monthlyRent",
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
          {formatCurrencyFull(row.original.monthlyRent)}
        </div>
      ),
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
