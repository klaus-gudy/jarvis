"use client";

import { Badge } from "@/components/ui/badge";
import {
  OWNER_ONLY_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSIONS,
} from "@/lib/permissions";
import type { RoleRow } from "@/lib/roles";

/** One line for the Permissions column and the mobile card. */
export function permissionSummary(role: RoleRow) {
  if (role.kind === "OWNER") return "Everything";
  if (role.kind === "TENANT") return "Tenant portal only";
  if (role.permissions.length === 0) return "None";
  return `${role.permissions.length} of ${PERMISSIONS.length - OWNER_ONLY_PERMISSIONS.size}`;
}

/**
 * Which areas a role reaches, as small chips — "Leases 2/5" says more at a
 * glance than "11 of 23". Owner and Tenant get one phrase instead.
 */
export function PermissionAreas({ role }: { role: RoleRow }) {
  if (role.kind !== "STAFF" || role.permissions.length === 0) {
    return <span className="text-sm text-muted-foreground">{permissionSummary(role)}</span>;
  }
  const held = new Set(role.permissions);
  return (
    <span className="flex flex-wrap gap-1">
      {PERMISSION_GROUPS.map((group) => {
        const on = group.permissions.filter((p) => held.has(p.key)).length;
        if (on === 0) return null;
        return (
          <Badge key={group.label} variant="outline" className="rounded-full font-normal">
            {group.label}
            <span className="text-muted-foreground tabular-nums">
              {on}/{group.permissions.length}
            </span>
          </Badge>
        );
      })}
    </span>
  );
}

/** A role as one card, for the mobile list on the Roles & permissions page. */
export function RoleCard({ role }: { role: RoleRow }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{role.name}</p>
        <Badge
          variant={role.isSystem ? "secondary" : "outline"}
          className="shrink-0 rounded-full font-normal"
        >
          {role.isSystem ? "Built-in" : "Custom"}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="tabular-nums">{role.memberCount}</span>{" "}
        {role.memberCount === 1 ? "member" : "members"}
        {role.pendingInviteCount > 0 && (
          <>
            {" · "}
            <span className="tabular-nums text-stat-accent">
              {role.pendingInviteCount}
            </span>{" "}
            pending
          </>
        )}
      </p>

      <PermissionAreas role={role} />
    </div>
  );
}
