"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { LockIcon, PlusIcon, ShieldCheckIcon } from "lucide-react";

import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import type { RoleRow } from "@/lib/roles";

export function RolesView({ roles }: { roles: RoleRow[] }) {
  const [formOpen, setFormOpen] = React.useState(false);

  const columns = React.useMemo<ColumnDef<RoleRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Role",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {row.original.isSystem ? (
                <LockIcon className="size-4" aria-hidden />
              ) : (
                <ShieldCheckIcon className="size-4" aria-hidden />
              )}
            </span>
            <span className="font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "isSystem",
        header: "Type",
        cell: ({ row }) => (
          <Badge
            variant={row.original.isSystem ? "secondary" : "outline"}
            className="rounded-full font-normal"
          >
            {row.original.isSystem ? "Built-in" : "Custom"}
          </Badge>
        ),
        filterFn: (row, columnId, filterValue) =>
          String(row.getValue(columnId)) === filterValue,
      },
      {
        accessorKey: "memberCount",
        header: "Members",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.memberCount}</span>
        ),
      },
      {
        accessorKey: "pendingInviteCount",
        header: "Pending invites",
        cell: ({ row }) =>
          row.original.pendingInviteCount > 0 ? (
            <span className="tabular-nums text-stat-accent">
              {row.original.pendingInviteCount}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "permissions",
        header: "Permissions",
        // Deliberately inert until permissions exist. Showing the column now
        // says where they will live without implying any are in force.
        cell: () => (
          <span className="text-sm text-muted-foreground">Not configured</span>
        ),
        enableSorting: false,
      },
    ],
    []
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <PlusIcon />
          New role
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={roles}
        searchColumnId="name"
        searchPlaceholder="Search roles…"
        facetFilters={[
          {
            columnId: "isSystem",
            placeholder: "All types",
            options: [
              { label: "Built-in", value: "true" },
              { label: "Custom", value: "false" },
            ],
          },
        ]}
        emptyMessage="No roles yet."
      />

      <RoleFormDialog
        key={String(formOpen)}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}
