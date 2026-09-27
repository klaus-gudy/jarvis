"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LockIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { usePermissions } from "@/components/permissions-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  PERMISSION_GROUPS,
  PERMISSIONS,
  type Permission,
  type RoleKind,
} from "@/lib/permissions";
import { cn } from "@/lib/utils";

const NOT_HELD = "You can only grant or remove permissions you hold yourself";

/**
 * What one role may do, and the place to change it — the same for every role,
 * Owner and Tenant included. The boxes show exactly what is stored on the
 * role; nothing is implied by its kind.
 *
 * Checkboxes edit a local draft; nothing is sent until Save, so a role is never
 * left half-edited and a slip can be discarded. Changed rows are marked so the
 * reviewer sees exactly what Save will do. A box for a permission the
 * viewer doesn't hold is disabled (Owners may grant anything) — the server
 * refuses those changes anyway (`updateRole`).
 *
 * Removing "Manage roles" is allowed but confirmed first: taken off the Owner
 * role, or off your own, it can leave nobody able to put it back.
 */
export function RolePermissionsEditor({
  roleId,
  roleName,
  kind,
  granted,
  memberCount,
  editable,
}: {
  roleId: string;
  roleName: string;
  kind: RoleKind;
  granted: Permission[];
  memberCount: number;
  /** False when the viewer may not edit this role at all (a non-Owner on Owner). */
  editable: boolean;
}) {
  const router = useRouter();
  const viewer = usePermissions();

  const [draft, setDraft] = React.useState<Set<Permission>>(() => new Set(granted));
  const [saving, setSaving] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

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
    editable && (viewer.kind === "OWNER" || viewer.permissions.has(p));

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
        if (on) next.add(p);
        else next.delete(p);
      }
      return next;
    });
  }

  async function save() {
    setConfirming(false);
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

  // Removing the permission that governs this page is the one change that can
  // lock an organization out of fixing it again.
  const removesRoleManage = removed.includes("role:manage");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Grants{" "}
        <span className="font-medium text-foreground tabular-nums">
          {draft.size} of {PERMISSIONS.length}
        </span>{" "}
        permissions
        {kind === "TENANT" && " — tenants also always see their own leases, payments and documents in the portal"}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => {
          const keys = group.permissions.map((p) => p.key);
          const onCount = keys.filter((p) => draft.has(p)).length;
          const changeable = keys.filter(mayChange);

          return (
            <Card key={group.label} className="gap-0 py-0">
              {/* Fixed height, so a group without the Grant/Remove all button
                  lines up with its neighbour. CardHeader pads its bottom when
                  it has a border, which would push the title up — zeroed. */}
              <CardHeader className="flex h-11 flex-row items-center justify-between gap-2 border-b px-4 py-0 [.border-b]:pb-0">
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
              <CardContent className="divide-y p-0">
                {group.permissions.map((permission) => {
                  const id = `perm-${permission.key}`;
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
                      // The description moved to hover to keep rows to one line.
                      title={editable && locked ? NOT_HELD : permission.description}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5",
                        !locked && "cursor-pointer hover:bg-muted/40",
                        change === "added" && "bg-primary/5",
                        change === "removed" && "bg-destructive/5"
                      )}
                    >
                      <Checkbox
                        id={id}
                        // Base UI puts `id` on its hidden input, so the <label>
                        // alone leaves the visible box unnamed.
                        aria-labelledby={`${id}-label`}
                        checked={draft.has(permission.key)}
                        disabled={locked}
                        onCheckedChange={(checked) => set(permission.key, checked)}
                      />
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
                          {editable && locked && (
                            <LockIcon className="size-3 text-muted-foreground" aria-label={NOT_HELD} />
                          )}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editable && (
        <div
          className={cn(
            "sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-lg transition-opacity",
            dirty ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          aria-hidden={!dirty}
        >
          <p className="text-sm">
            {added.length > 0 && <span className="text-primary">+{added.length} adding</span>}
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
            <Button
              type="button"
              size="sm"
              disabled={saving || !dirty}
              onClick={() => (removesRoleManage ? setConfirming(true) : save())}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TriangleAlertIcon className="size-5 text-destructive" aria-hidden />
              Remove “Manage roles” from {roleName}?
            </DialogTitle>
            <DialogDescription>
              Everyone in this role will lose access to Roles &amp; permissions.
              {kind === "OWNER"
                ? " If no other role can manage roles, nobody in the organization will be able to turn it back on."
                : " If this is your own role, you won't be able to undo this yourself."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={save}>
              Remove and save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
