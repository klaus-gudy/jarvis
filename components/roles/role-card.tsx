import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { PERMISSION_GROUPS } from "@/lib/permissions";
import type { RoleRow } from "@/lib/roles";

/**
 * Custom roles are coloured by a stable hash of their id over the `--kind-*`
 * inks (never by name — renaming a role shouldn't repaint it). Owner is always
 * green and Tenant neutral, so the two built-ins read the same everywhere.
 */
const CUSTOM_INKS = [
  "var(--kind-unit)",
  "var(--kind-property)",
  "var(--kind-user)",
  "var(--kind-payment)",
  "var(--kind-tenant)",
];

function roleInk(role: Pick<RoleRow, "id" | "kind">) {
  if (role.kind === "OWNER") return "var(--kind-lease)";
  if (role.kind === "TENANT") return null;
  let hash = 0;
  for (const char of role.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CUSTOM_INKS[hash % CUSTOM_INKS.length];
}

export function RolePill({ role }: { role: Pick<RoleRow, "id" | "kind" | "name"> }) {
  const ink = roleInk(role);
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded-full bg-muted px-3 py-1 text-sm font-medium"
      style={
        ink
          ? {
              color: ink,
              // The ink tints its own background, so one token serves both themes.
              backgroundColor: `color-mix(in oklch, ${ink}, transparent 88%)`,
            }
          : undefined
      }
    >
      {role.name}
    </span>
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
      className="flex flex-wrap gap-2"
      aria-label={levels.map((l) => `${l.label}: ${LEVEL_WORD[l.level]}`).join(", ")}
    >
      {levels.map((l) => (
        <li
          key={l.label}
          title={`${l.label}: ${l.on} of ${l.total}`}
          aria-hidden
          className={`size-3 rounded-full ${DOT[l.level]}`}
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
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <RolePill role={role} />
        <span className="shrink-0 pt-1 text-sm text-muted-foreground tabular-nums">
          {users}
          {role.pendingInviteCount > 0 && ` · ${role.pendingInviteCount} invited`}
        </span>
      </div>

      <p className={role.description ? "text-sm leading-relaxed" : "text-sm italic text-muted-foreground"}>
        {role.description ?? "No description yet."}
      </p>

      <div className="mt-auto space-y-4">
        <PermissionDots role={role} />
        <Link
          href={`/roles/${role.id}`}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Configure permissions
          <span className="sr-only"> for {role.name}</span>
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>
    </article>
  );
}
