"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { PermissionLegend, RoleCard } from "@/components/roles/role-card";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { Button } from "@/components/ui/button";
import type { RoleRow } from "@/lib/roles";

/** Owner first, custom roles by name, Tenant last — widest reach to narrowest. */
const KIND_ORDER = { OWNER: 0, STAFF: 1, TENANT: 2 } as const;

/**
 * Roles as a grid of cards rather than a table: an organization has a handful
 * of roles, and what matters about each — what it's for and how far it
 * reaches — reads better as a description and a strip of dots than as columns.
 * Renaming, deleting and permissions all live on the role's own page.
 */
export function RolesView({ roles }: { roles: RoleRow[] }) {
  const [formOpen, setFormOpen] = React.useState(false);

  const sorted = React.useMemo(
    () =>
      [...roles].sort(
        (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name)
      ),
    [roles]
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <PlusIcon />
          New role
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((role) => (
          <RoleCard key={role.id} role={role} />
        ))}
      </div>

      <PermissionLegend />

      <RoleFormDialog key={String(formOpen)} open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
