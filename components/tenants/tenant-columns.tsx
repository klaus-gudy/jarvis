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
      id: "contact",
      header: "Contact info",
      // Phone leads: it's the identifier assisted onboarding requires.
      cell: ({ row }) => {
        const { phone, email } = row.original;
        if (!phone && !email) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="leading-tight">
            {phone && <div>{phone}</div>}
            {email && (
              <div className="text-xs text-muted-foreground">{email}</div>
            )}
          </div>
        );
      },
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
      id: "unit",
      header: "Unit",
      cell: ({ row }) => {
        const { unitLabel, propertyName, status } = row.original;
        if (!unitLabel) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="leading-tight">
            <div className={status === "Vacated" ? "text-muted-foreground" : ""}>
              {unitLabel}
              {status === "Vacated" && " (past)"}
            </div>
            {propertyName && (
              <div className="text-xs text-muted-foreground">{propertyName}</div>
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
            render={<Link href={`/tenants/${row.original.membershipId}`} />}
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
