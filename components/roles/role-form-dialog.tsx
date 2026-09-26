"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { usePermissions } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  PERMISSION_GROUPS,
  ROLE_TEMPLATES,
  type Permission,
} from "@/lib/permissions";
import type { RoleRow } from "@/lib/roles";

/**
 * Creating or editing a role: a name, and — for custom roles — which
 * permissions it grants, laid out by `PERMISSION_GROUPS`.
 *
 * Owner and Tenant are built in: they can be renamed here, but their
 * permission sets are fixed, so the checklist is shown read-only for them.
 *
 * A permission the editor doesn't hold themselves is disabled: the server
 * refuses to let anyone grant (or strip) what they don't have, and a checkbox
 * that can only fail is worse than one that says why it can't be changed.
 */
export function RoleFormDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing when set, creating otherwise. */
  role?: RoleRow;
}) {
  const router = useRouter();
  const viewer = usePermissions();
  const editing = Boolean(role);
  const fixed = role?.isSystem ?? false;

  const [name, setName] = React.useState(role?.name ?? "");
  const [selected, setSelected] = React.useState<Set<Permission>>(
    () => new Set(role?.permissions ?? [])
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const mayChange = (p: Permission) =>
    !fixed && (viewer.kind === "OWNER" || viewer.permissions.has(p));

  function toggle(p: Permission, on: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(p);
      else next.delete(p);
      return next;
    });
  }

  function applyTemplate(permissions: Permission[]) {
    // Only what the editor may grant — a template never smuggles in more.
    setSelected(new Set(permissions.filter(mayChange)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const body = fixed ? { name } : { name, permissions: [...selected] };
    const response = await fetch(editing ? `/api/roles/${role!.id}` : "/api/roles", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      toast.success(editing ? `Role "${name}" saved` : `Role "${name}" created`);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message =
      data?.issues?.name?.[0] ??
      data?.error ??
      (editing ? "Could not save this role" : "Could not create this role");
    setError(message);
    toast.error(message);
    setPending(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${role!.name}` : "New role"}</DialogTitle>
            <DialogDescription>
              {fixed
                ? role!.kind === "OWNER"
                  ? "Owners can do everything, including deleting the organization. Only the name can change."
                  : "Tenants use the tenant portal and have no access to the staff app. Only the name can change."
                : "Choose what people in this role can see and do."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <Field>
              <FieldLabel htmlFor="role-name" required>
                Role name
              </FieldLabel>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Manager"
                required
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>

            {!fixed && (
              <>
                {!editing && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">Start from:</span>
                    {ROLE_TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyTemplate(template.permissions)}
                      >
                        {template.name}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelected(new Set())}
                    >
                      Clear
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  {PERMISSION_GROUPS.map((group) => (
                    <fieldset key={group.label} className="space-y-2">
                      <legend className="mb-1 text-sm font-medium">{group.label}</legend>
                      {group.permissions.map((permission) => {
                        const id = `perm-${permission.key}`;
                        const disabled = !mayChange(permission.key);
                        return (
                          <label
                            key={permission.key}
                            htmlFor={id}
                            className="flex items-start gap-3 rounded-md px-1 py-1 has-disabled:opacity-60"
                            title={disabled ? "You don't hold this permission yourself" : undefined}
                          >
                            <Checkbox
                              id={id}
                              className="mt-0.5"
                              checked={selected.has(permission.key)}
                              disabled={disabled}
                              onCheckedChange={(checked) => toggle(permission.key, checked)}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm">{permission.label}</span>
                              <span className="block text-xs text-muted-foreground">
                                {permission.description}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  ))}
                </div>
                <FieldDescription>
                  Changes apply to everyone in this role on their next page load.
                </FieldDescription>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending
                ? editing
                  ? "Saving…"
                  : "Creating…"
                : editing
                  ? "Save role"
                  : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
