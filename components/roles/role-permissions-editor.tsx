"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { InfoIcon, LockIcon } from "lucide-react";
import { toast } from "sonner";

import { usePermissions } from "@/components/permissions-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  OWNER_ONLY_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSIONS,
  type Permission,
  type RoleKind,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Filter = "all" | "granted" | "not-granted";

const GRANTABLE_COUNT = PERMISSIONS.length - OWNER_ONLY_PERMISSIONS.size;
const NOT_HELD = "You can only grant or remove permissions you hold yourself";

/**
 * What one role may do, and the place to change it.
 *
 * Every permission is listed, grouped as on the catalogue, with a switch. The
 * switches edit a local draft; nothing is sent until Save, so a role is never
 * left half-edited on the server and a slip can be discarded. Changed rows are
 * marked so the reviewer sees exactly what Save will do.
 *
 * Owner and Tenant are shown read-only (everything / nothing). A switch for a
 * permission the viewer doesn't hold is disabled — the server refuses those
 * changes anyway (`updateRole`), and a switch that can only fail says nothing
 * useful.
 */
export function RolePermissionsEditor({
  roleId,
  roleName,
  kind,
  granted,
  memberCount,
}: {
  roleId: string;
  roleName: string;
  kind: RoleKind;
  granted: Permission[];
  memberCount: number;
}) {
  const router = useRouter();
  const viewer = usePermissions();
  const fixed = kind !== "STAFF";

  const [draft, setDraft] = React.useState<Set<Permission>>(() => new Set(granted));
  const [filter, setFilter] = React.useState<Filter>("all");
  const [saving, setSaving] = React.useState(false);

  const saved = React.useMemo(() => new Set(granted), [granted]);
  const added = [...draft].filter((p) => !saved.has(p));
  const removed = [...saved].filter((p) => !draft.has(p));
  const dirty = added.length + removed.length > 0;

  // A half-edited role is easy to walk away from; the browser asks first.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const mayChange = (p: Permission) =>
    !fixed && (viewer.kind === "OWNER" || viewer.permissions.has(p));

  function set(p: Permission, on: boolean) {
    setDraft((current) => {
      const next = new Set(current);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });
  }

  function setGroup(keys: Permission[], on: boolean) {
    setDraft((current) => {
      const next = new Set(current);
      for (const p of keys) {
        if (!mayChange(p)) continue;
        if (on) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const response = await fetch(`/api/roles/${roleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: [...draft] }),
    });
    setSaving(false);
    if (response.ok) {
      toast.success(`${roleName} updated`, {
        description:
          memberCount > 0
            ? `Applies to ${memberCount} ${memberCount === 1 ? "person" : "people"} on their next page load.`
            : undefined,
      });
      router.refresh();
      return;
    }
    const data = await response.json().catch(() => null);
    toast.error(data?.error ?? "Could not save these permissions");
  }

  const isGranted = (p: Permission) =>
    kind === "OWNER" ? true : kind === "TENANT" ? false : draft.has(p);
  const total = kind === "OWNER" ? GRANTABLE_COUNT : kind === "TENANT" ? 0 : draft.size;

  return (
    <div className="space-y-4">
      {fixed && (
        <div className="flex gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            {kind === "OWNER"
              ? "Owners can do everything, including restoring and deleting the organization. This can't be changed."
              : "Tenants use the tenant portal to see their own leases, payments and documents. They have no access to the staff app, so none of these apply."}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Grants{" "}
          <span className="font-medium text-foreground tabular-nums">
            {total} of {GRANTABLE_COUNT}
          </span>{" "}
          permissions
        </p>
        <div role="radiogroup" aria-label="Show" className="flex gap-1 rounded-lg border p-0.5">
          {(
            [
              ["all", "All"],
              ["granted", "Granted"],
              ["not-granted", "Not granted"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              size="sm"
              variant={filter === value ? "secondary" : "ghost"}
              className="h-7"
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => {
          const keys = group.permissions.map((p) => p.key);
          const rows = group.permissions.filter((p) =>
            filter === "all" ? true : filter === "granted" ? isGranted(p.key) : !isGranted(p.key)
          );
          if (rows.length === 0) return null;
          const onCount = keys.filter(isGranted).length;
          const changeable = keys.filter(mayChange);

          return (
            <Card key={group.label} className="gap-0 py-0">
              <CardHeader className="flex flex-row items-center justify-between gap-2 border-b px-4 py-3">
                <CardTitle className="text-sm">
                  {group.label}{" "}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {onCount}/{keys.length}
                  </span>
                </CardTitle>
                {changeable.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() =>
                      setGroup(changeable, !changeable.every((p) => draft.has(p)))
                    }
                  >
                    {changeable.every((p) => draft.has(p)) ? "Remove all" : "Grant all"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="divide-y px-0">
                {rows.map((permission) => {
                  const id = `perm-${permission.key}`;
                  const on = isGranted(permission.key);
                  const locked = !mayChange(permission.key);
                  const change = added.includes(permission.key)
                    ? "added"
                    : removed.includes(permission.key)
                      ? "removed"
                      : null;
                  return (
                    <label
                      key={permission.key}
                      htmlFor={id}
                      title={!fixed && locked ? NOT_HELD : undefined}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3",
                        !locked && "cursor-pointer hover:bg-muted/40",
                        change === "added" && "bg-primary/5",
                        change === "removed" && "bg-destructive/5"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 text-sm">
                          <span id={`${id}-label`}>{permission.label}</span>
                          {change && (
                            <Badge
                              variant={change === "added" ? "secondary" : "destructive"}
                              className="rounded-full px-1.5 py-0 text-[10px] font-normal"
                            >
                              {change === "added" ? "Adding" : "Removing"}
                            </Badge>
                          )}
                          {!fixed && locked && (
                            <LockIcon className="size-3 text-muted-foreground" aria-label={NOT_HELD} />
                          )}
                        </span>
                        <span id={`${id}-desc`} className="block text-xs text-muted-foreground">
                          {permission.description}
                        </span>
                      </span>
                      <Switch
                        id={id}
                        // Base UI puts `id` on its hidden input, so the <label>
                        // alone leaves the visible switch unnamed.
                        aria-labelledby={`${id}-label`}
                        aria-describedby={`${id}-desc`}
                        // `--input` is near-white in light mode, so an off switch
                        // all but vanished on the card (same fix as checkbox.tsx).
                        className="data-unchecked:bg-muted-foreground/30"
                        checked={on}
                        disabled={locked}
                        onCheckedChange={(checked) => set(permission.key, checked)}
                      />
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!fixed && (
        <div
          className={cn(
            "sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-lg transition-opacity",
            dirty ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={!dirty}
        >
          <p className="text-sm">
            {added.length > 0 && (
              <span className="text-primary">+{added.length} adding</span>
            )}
            {added.length > 0 && removed.length > 0 && " · "}
            {removed.length > 0 && (
              <span className="text-destructive">−{removed.length} removing</span>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving || !dirty}
              onClick={() => setDraft(new Set(granted))}
            >
              Discard
            </Button>
            <Button type="button" size="sm" disabled={saving || !dirty} onClick={save}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
