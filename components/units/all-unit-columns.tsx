"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { PropertyHoverCard } from "@/components/hover-cards/property-hover-card";
import { UnitHoverCard } from "@/components/hover-cards/unit-hover-card";
import { UnitOccupancy } from "@/components/units/unit-occupancy";
import { UnitStatusBadge } from "@/components/units/unit-status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTableColumnHeader,
  RowActionButtons,
  facetFilterFn,
  type RowAction,
} from "@/components/ui/data-table";
import { formatCurrencyFull } from "@/lib/format";
import type { UnitListRow } from "@/lib/units";

/**
 * The org-wide Units page: the property page's unit columns plus the property
 * itself, and one Occupancy column in place of the bare tenant name.
 */
export function buildAllUnitColumns({
  rowActions,
  canReadTenants,
  canReadLeases,
}: {
  rowActions: (unit: UnitListRow) => RowAction[];
  canReadTenants: boolean;
  canReadLeases: boolean;
}): ColumnDef<UnitListRow>[] {
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
        <UnitHoverCard
          unit={row.original.unit}
          href={`/properties/${row.original.propertyId}/units/${row.original.id}`}
          className="font-medium hover:underline"
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
          href={`/properties/${row.original.propertyId}`}
          className="hover:underline"
        />
      ),
      filterFn: facetFilterFn,
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
        <UnitStatusBadge status={row.original.status} active={row.original.active} />
      ),
      filterFn: facetFilterFn,
    },
    {
      // Names as text, so the table's search finds a tenant — current, past or
      // next — like any other column.
      id: "occupancy",
      accessorFn: (unit) =>
        [unit.occupant?.tenantName, unit.next?.tenantName].filter(Boolean).join(" "),
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Occupancy"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      // Sorted by the date that matters: when the running lease ends, or when
      // the last one did. Never-let units sort first.
      sortingFn: (a, b) =>
        (a.original.occupant?.endDate ?? "").localeCompare(
          b.original.occupant?.endDate ?? ""
        ),
      cell: ({ row }) => (
        <UnitOccupancy
          unit={row.original}
          canReadTenants={canReadTenants}
          canReadLeases={canReadLeases}
        />
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
