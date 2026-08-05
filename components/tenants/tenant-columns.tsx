"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { EyeIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { PersonCell } from "@/components/person-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableColumnHeader } from "@/components/ui/data-table";
import { formatDate } from "@/lib/format";
import type { TenantRow } from "@/lib/tenants";

const STATUS_VARIANT: Record<
  TenantRow["status"],
  "secondary" | "outline" | "destructive"
> = {
  Active: "secondary",
  Upcoming: "outline",
  Prospect: "outline",
  Vacated: "outline",
};

export function buildTenantColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (tenant: TenantRow) => void;
  onDelete: (tenant: TenantRow) => void;
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
          variant={STATUS_VARIANT[row.original.status]}
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
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href={`/members/${row.original.membershipId}`} />}
            aria-label={`View ${row.original.name}`}
          >
            <EyeIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(row.original)}
            aria-label={`Edit ${row.original.name}`}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(row.original)}
            aria-label={`Remove ${row.original.name}`}
          >
            <Trash2Icon />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ];
}
