import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import type { RoleRow } from "@/lib/roles";

/** The same badge the property cards use, for one look across the app. */
export function RolePill({ role }: { role: Pick<RoleRow, "name"> }) {
  return (
    <Badge variant="secondary" className="max-w-full truncate rounded-full font-normal">
      {role.name}
    </Badge>
  );
}

type Level = "full" | "partial" | "none";

/** One entry per permission area: all of it, some of it, or none. */
export function permissionLevels(role: Pick<RoleRow, "permissions">) {
  const held = new Set(role.permissions);
  return PERMISSION_GROUPS.map((group) => {
    const on = group.permissions.filter((p) => held.has(p.key)).length;
    const level: Level = on === 0 ? "none" : on === group.permissions.length ? "full" : "partial";
    return { label: group.label, on, total: group.permissions.length, level };
  });
}

const DOT: Record<Level, string> = {
  full: "bg-[var(--kind-lease)]",
  partial: "bg-stat-accent",
  none: "bg-muted-foreground/20",
};

const LEVEL_WORD: Record<Level, string> = {
  full: "full access",
  partial: "partial access",
  none: "no access",
};

/**
 * The strip of dots: one per area, in catalogue order, so the same position
 * means the same area on every card and two roles compare at a glance.
 */
export function PermissionDots({ role }: { role: Pick<RoleRow, "permissions"> }) {
  const levels = permissionLevels(role);
  return (
    <ul
      className="flex flex-wrap gap-1.5"
      aria-label={levels.map((l) => `${l.label}: ${LEVEL_WORD[l.level]}`).join(", ")}
    >
      {levels.map((l) => (
        <li
          key={l.label}
          title={`${l.label}: ${l.on} of ${l.total}`}
          aria-hidden
          // Same size as the legend's dots, so the key and the strip match.
          className={`size-2 rounded-full ${DOT[l.level]}`}
        />
      ))}
    </ul>
  );
}

export function PermissionLegend() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(["full", "partial", "none"] as const).map((level) => (
        <span key={level} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={`size-2 rounded-full ${DOT[level]}`} />
          {level === "full" ? "Full access" : level === "partial" ? "Partial" : "No access"}
        </span>
      ))}
      <span>One dot per area — hover a dot to see which.</span>
    </p>
  );
}

/** A role on the Roles page: who it is, what it's for, how far it reaches. */
export function RoleCard({ role }: { role: RoleRow }) {
  const users = role.memberCount === 1 ? "1 user" : `${role.memberCount} users`;
  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <RolePill role={role} />
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {users}
          {role.pendingInviteCount > 0 && ` · ${role.pendingInviteCount} invited`}
        </span>
      </div>

      <p className={role.description ? "text-sm leading-relaxed" : "text-sm italic text-muted-foreground"}>
        {role.description ?? "No description yet."}
      </p>

      <div className="mt-auto space-y-3">
        <PermissionDots role={role} />
        <Link
          href={`/roles/${role.id}`}
          className="group inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
        >
          Configure permissions
          <span className="sr-only"> for {role.name}</span>
          <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
