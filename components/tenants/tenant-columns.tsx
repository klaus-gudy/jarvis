"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { PersonCell } from "@/components/person-cell";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTableColumnHeader,
  RowActionButtons,
  type RowAction,
} from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import type { TenantRow } from "@/lib/tenants";

export const TENANT_STATUS_VARIANT: Record<
  TenantRow["status"],
  "secondary" | "outline" | "destructive"
> = {
  Active: "secondary",
  Upcoming: "outline",
  Prospect: "outline",
  Vacated: "outline",
};

/**
 * `rowActions` is the same function the `DataTable` hands its mobile sheet, so
 * the icon strip below and the sheet can never offer different things — the
 * failure mode when the two are written separately is one of them quietly
 * missing an action after a later edit.
 */
export function buildTenantColumns({
  rowActions,
}: {
  rowActions: (tenant: TenantRow) => RowAction[];
}): ColumnDef<TenantRow>[] {
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
          aria-label={`Select ${row.original.name}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Name"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => (
        <PersonCell name={row.original.name} photoId={row.original.photoId} />
      ),
    },
    {
      accessorKey: "phone",
      // Phone comes first: it's the identifier assisted onboarding requires,
      // whereas email is optional for a tenant.
      header: "Phone",
      cell: ({ row }) =>
        row.original.phone ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) =>
        row.original.email ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: "joinedAt",
      header: ({ column }) => (
        <DataTableColumnHeader
          title="Date joined"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-2"
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(new Date(row.original.joinedAt))}
        </span>
      ),
    },
    {
      accessorKey: "propertyName",
      header: "Property",
      cell: ({ row }) =>
        row.original.propertyName ?? (
          <span className="text-muted-foreground">—</span>
        ),
      // Exact match, not the default substring: a facet offering "Likely" must
      // not also sweep in "Likely Annex". A tenant with no property is null and
      // matches nothing, which is right — they aren't in any of them.
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
    },
    {
      accessorKey: "unitLabel",
      header: "Unit",
      cell: ({ row }) => {
        const { unitLabel, status } = row.original;
        if (!unitLabel) return <span className="text-muted-foreground">—</span>;
        // Neither a Vacated nor an Upcoming tenant is in the unit right now,
        // so both are dimmed and marked rather than reading as a current
        // occupancy — "past" for one, "from" for the other.
        if (status === "Vacated") {
          return <span className="text-muted-foreground">{unitLabel} (past)</span>;
        }
        if (status === "Upcoming") {
          return <span className="text-muted-foreground">{unitLabel} (upcoming)</span>;
        }
        return unitLabel;
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={TENANT_STATUS_VARIANT[row.original.status]}
          className="rounded-full font-normal"
        >
          {row.original.status}
        </Badge>
      ),
      filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => <RowActionButtons actions={rowActions(row.original)} />,
      enableSorting: false,
    },
  ];
}
