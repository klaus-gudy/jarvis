"use client";

import { Badge } from "@/components/ui/badge";
import type { RoleRow } from "@/lib/roles";

/**
 * A role as one card, for the mobile list on the Roles & permissions page.
 *
 * The Permissions column carries over as plain text rather than being dropped:
 * it ships inert on purpose, marking where permissions will live without
 * implying any are enforced, and that is as true on a phone as on a desk.
 */
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

      <p className="text-xs text-muted-foreground">Permissions: not configured</p>
    </div>
  );
}
