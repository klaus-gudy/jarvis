"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { PersonCell } from "@/components/person-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataTableColumnHeader,
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
      cell: ({ row }) => <PersonCell name={row.original.name} />,
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
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {rowActions(row.original).map((action) => {
            const Icon = action.icon;
            // The label carries the row's name ("Remove Amani Mwakalinga"), so
            // it doubles as the accessible name for an icon-only button.
            const shared = {
              variant: "ghost" as const,
              size: "icon-sm" as const,
              "aria-label": action.label,
            };

            return action.href ? (
              <Button
                key={action.label}
                {...shared}
                nativeButton={false}
                render={<Link href={action.href} />}
              >
                {Icon && <Icon />}
              </Button>
            ) : (
              <Button key={action.label} {...shared} onClick={action.onSelect}>
                {Icon && <Icon />}
              </Button>
            );
          })}
        </div>
      ),
      enableSorting: false,
    },
  ];
}
