"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { LeaseHoverCard } from "@/components/hover-cards/lease-hover-card";
import {
  PropertyHoverCard,
  type PropertyPreview,
} from "@/components/hover-cards/property-hover-card";
import {
  UnitHoverCard,
  type UnitPreview,
} from "@/components/hover-cards/unit-hover-card";
import { ExpiryTag } from "@/components/leases/expiry-tag";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader, facetFilterFn } from "@/components/ui/data-table";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import type { LeaseExpiry, LeaseStatus } from "@/lib/leases";
import { lastDayOf } from "@/lib/dates";

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
  /** For the property, unit and lease hover cards. */
  propertyId: string;
  unitId: string;
  property: PropertyPreview;
  unit: UnitPreview;
  monthlyRent: number;
  startDate: string;
  endDate: string;
  durationMonths: number;
  leaseAmount: number;
  status: LeaseStatus;
  expiry: LeaseExpiry | null;
  autoRenew: boolean;
  minTenureMonths: number | null;
};

/**
 * The org-wide leases table minus its Tenant column — every row here already
 * belongs to the member whose page this is.
 */
export function buildMemberLeaseColumns({
  canReadProperties,
  canReadLeases,
}: {
  /** Each reference previews and links only when its page would open. */
  canReadProperties: boolean;
  canReadLeases: boolean;
}): ColumnDef<MemberLeaseRow>[] {
  return [
    {
      accessorKey: "reference",
      header: "Lease",
      cell: ({ row }) => (
        <LeaseHoverCard
          lease={{
            reference: row.original.reference,
            status: row.original.status,
            startDate: row.original.startDate,
            endDate: row.original.endDate,
            durationMonths: row.original.durationMonths,
            monthlyRent: row.original.monthlyRent,
            expiry: row.original.expiry,
            subtitle: `${row.original.propertyName} · ${row.original.unitLabel}`,
          }}
          href={canReadLeases ? `/leases/${row.original.id}` : null}
          className="font-mono text-xs font-medium hover:underline"
          align="start"
        />
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
      cell: ({ row }) => (
        <PropertyHoverCard
          property={row.original.property}
          href={canReadProperties ? `/properties/${row.original.propertyId}` : null}
          className="hover:underline"
        />
      ),
    },
    {
      accessorKey: "unitLabel",
      header: "Unit",
      cell: ({ row }) => (
        <UnitHoverCard
          unit={row.original.unit}
          href={
            canReadProperties
              ? `/properties/${row.original.propertyId}/units/${row.original.unitId}`
              : null
          }
          className="font-medium hover:underline"
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
          {formatDate(lastDayOf(row.original.endDate))}
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
