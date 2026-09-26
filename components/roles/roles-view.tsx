"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { LockIcon, PencilIcon, PlusIcon, ShieldCheckIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PermissionAreas, RoleCard } from "@/components/roles/role-card";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  RowActionButtons,
  type RowAction,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RoleRow } from "@/lib/roles";

export function RolesView({ roles }: { roles: RoleRow[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<RoleRow | null>(null);
  const [pending, setPending] = React.useState(false);

  const actionsFor = React.useCallback(
    (role: RoleRow): RowAction[] => [
      {
        label: `Open ${role.name}`,
        icon: PencilIcon,
        href: `/roles/${role.id}`,
      },
      {
        label: `Delete ${role.name}`,
        icon: Trash2Icon,
        tone: "destructive",
        onSelect: () => setDeleting(role),
        disabled: role.isSystem || role.memberCount > 0 || role.pendingInviteCount > 0,
        disabledReason: role.isSystem
          ? "Built-in roles can't be deleted"
          : "Move this role's members and invitations first",
      },
    ],
    []
  );

  async function confirmDelete() {
    if (!deleting) return;
    setPending(true);
    const response = await fetch(`/api/roles/${deleting.id}`, { method: "DELETE" });
    setPending(false);
    if (response.ok) {
      toast.success(`Role "${deleting.name}" deleted`);
      setDeleting(null);
      router.refresh();
      return;
    }
    const data = await response.json().catch(() => null);
    toast.error(data?.error ?? "Could not delete this role");
  }

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
        cell: ({ row }) => <PermissionAreas role={row.original} />,
        enableSorting: false,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => <RowActionButtons actions={actionsFor(row.original)} />,
      },
    ],
    [actionsFor]
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
        stateKey="roles"
        columns={columns}
        data={roles}
        searchPlaceholder="Search roles…"
        facetFilters={[
          {
            columnId: "isSystem",
            placeholder: "All types",
            label: "Type",
            options: [
              { label: "Built-in", value: "true" },
              { label: "Custom", value: "false" },
            ],
          },
        ]}
        emptyMessage="No roles yet."
        renderCard={(role) => <RoleCard role={role} />}
        getRowHref={(role) => `/roles/${role.id}`}
        rowActions={actionsFor}
      />

      <RoleFormDialog
        key={String(formOpen)}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Nobody holds this role, so nothing else changes. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
