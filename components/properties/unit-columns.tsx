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
import type { LeasePreview } from "@/components/hover-cards/lease-hover-card";
import { TenantHoverCard } from "@/components/hover-cards/tenant-hover-card";
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
  /** The current lease's tenant and the lease itself, for links; null when vacant. */
  tenantMembershipId: string | null;
  leaseId: string | null;
  leaseStart: string | null;
  /** For the tenant and lease hover cards; null when vacant. */
  tenantPhone: string | null;
  tenantEmail: string | null;
  tenantPhotoId: string | null;
  lease: LeasePreview | null;
  /** Just enough to draw the strip in the View dialog: id is the URL, name is the alt text. */
  photos: { id: string; fileName: string }[];
};

/** Amenities shown inline before the rest fold into a "+N". */
const AMENITIES_SHOWN = 2;

/**
 * Floor, block and minimum tenure don't get columns — they only ever show up
 * in the View dialog, opened from the row actions.
 */
export function buildUnitColumns({
  rowActions,
  canReadTenants,
}: {
  rowActions: (unit: UnitRow) => RowAction[];
  /** The tenant's name previews and links only when the member page would open. */
  canReadTenants: boolean;
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
      // Joined into text so the table's search finds "parking" like any column.
      id: "amenities",
      accessorFn: (unit) => unit.amenities.join(", "),
      header: "Amenities",
      enableSorting: false,
      cell: ({ row }) => {
        const { amenities } = row.original;
        if (amenities.length === 0) return <span className="text-muted-foreground">—</span>;
        const hidden = amenities.length - AMENITIES_SHOWN;
        return (
          <div className="flex flex-wrap items-center gap-1" title={amenities.join(", ")}>
            {amenities.slice(0, AMENITIES_SHOWN).map((amenity) => (
              <Badge key={amenity} variant="outline" className="font-normal">
                {amenity}
              </Badge>
            ))}
            {hidden > 0 && (
              <span className="text-xs text-muted-foreground">+{hidden}</span>
            )}
          </div>
        );
      },
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
        const unit = row.original;
        return (
          <div className="leading-tight">
            <div className="text-muted-foreground">
              {unit.tenantName && unit.tenantMembershipId ? (
                <TenantHoverCard
                  tenant={{
                    name: unit.tenantName,
                    phone: unit.tenantPhone,
                    email: unit.tenantEmail,
                    photoId: unit.tenantPhotoId,
                    context: `Unit ${unit.label}`,
                  }}
                  href={canReadTenants ? `/members/${unit.tenantMembershipId}` : null}
                  className="hover:text-foreground hover:underline"
                  align="start"
                />
              ) : (
                "—"
              )}
            </div>
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
