"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { usePermissions } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { ROLE_TEMPLATES, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const BLANK = { id: "blank", name: "Blank", permissions: [] as Permission[] };

/**
 * Creating a role, or editing its name and description. Choosing permissions happens on the role's
 * own page (`RolePermissionsEditor`) — creating only picks a name and a
 * starting point, then opens that page so it can be fine-tuned.
 */
export function RoleFormDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing when set, creating otherwise. */
  role?: { id: string; name: string; description: string | null };
}) {
  const router = useRouter();
  const viewer = usePermissions();
  const renaming = Boolean(role);

  const [name, setName] = React.useState(role?.name ?? "");
  const [description, setDescription] = React.useState(role?.description ?? "");
  const [templateId, setTemplateId] = React.useState(BLANK.id);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const templates = [BLANK, ...ROLE_TEMPLATES];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const template = templates.find((t) => t.id === templateId) ?? BLANK;
    // A template never smuggles in more than the creator holds.
    const permissions = template.permissions.filter(
      (p) => viewer.kind === "OWNER" || viewer.permissions.has(p)
    );

    const response = await fetch(renaming ? `/api/roles/${role!.id}` : "/api/roles", {
      method: renaming ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        renaming ? { name, description } : { name, description, permissions }
      ),
    });
    const data = await response.json().catch(() => null);

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      if (renaming) {
        toast.success(`"${name}" saved`);
        router.refresh();
      } else {
        toast.success(`Role "${name}" created`, {
          description: "Review its permissions, then save.",
        });
        router.push(`/roles/${data.role.id}`);
      }
      return;
    }

    const message =
      data?.issues?.name?.[0] ??
      data?.error ??
      (renaming ? "Could not rename this role" : "Could not create this role");
    setError(message);
    toast.error(message);
    setPending(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{renaming ? "Edit role details" : "New role"}</DialogTitle>
            <DialogDescription>
              {renaming
                ? "Permissions and members stay as they are."
                : "Name the role and pick a starting point. You'll choose its exact permissions next."}
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
                placeholder="Caretaker"
                required
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="role-description">Description</FieldLabel>
              <Textarea
                id="role-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Handles maintenance requests, with limited visibility elsewhere."
                maxLength={200}
                rows={2}
              />
              <FieldDescription>Shown on the role&apos;s card. Optional.</FieldDescription>
            </Field>

            {!renaming && (
              <Field>
                <FieldLabel>Start from</FieldLabel>
                <div role="radiogroup" aria-label="Start from" className="grid gap-2 sm:grid-cols-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      role="radio"
                      aria-checked={templateId === template.id}
                      onClick={() => setTemplateId(template.id)}
                      className={cn(
                        "rounded-lg border p-3 text-left text-sm transition-colors",
                        templateId === template.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <span className="block font-medium">{template.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {template.permissions.length === 0
                          ? "No permissions"
                          : `${template.permissions.length} permissions`}
                      </span>
                    </button>
                  ))}
                </div>
                <FieldDescription>You can change every permission afterwards.</FieldDescription>
              </Field>
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
                ? renaming
                  ? "Saving…"
                  : "Creating…"
                : renaming
                  ? "Save"
                  : "Create and choose permissions"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
