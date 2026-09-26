"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Rename and delete, for the header of `/roles/[id]`. */
export function RoleActions({
  role,
}: {
  role: {
    id: string;
    name: string;
    isSystem: boolean;
    memberCount: number;
    pendingInviteCount: number;
  };
}) {
  const router = useRouter();
  const [renaming, setRenaming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const inUse = role.memberCount > 0 || role.pendingInviteCount > 0;
  const deleteBlocked = role.isSystem
    ? "Built-in roles can't be deleted"
    : inUse
      ? "Move this role's members and invitations to another role first"
      : undefined;

  async function confirmDelete() {
    setPending(true);
    const response = await fetch(`/api/roles/${role.id}`, { method: "DELETE" });
    setPending(false);
    if (response.ok) {
      toast.success(`Role "${role.name}" deleted`);
      router.push("/roles");
      router.refresh();
      return;
    }
    const data = await response.json().catch(() => null);
    toast.error(data?.error ?? "Could not delete this role");
  }

  return (
    <div className="flex w-full gap-2 sm:w-auto">
      <Button
        variant="outline"
        size="sm"
        className="flex-1 sm:flex-none"
        onClick={() => setRenaming(true)}
      >
        <PencilIcon />
        Rename
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="flex-1 text-destructive sm:flex-none"
        disabled={Boolean(deleteBlocked)}
        title={deleteBlocked}
        onClick={() => setDeleting(true)}
      >
        <Trash2Icon />
        Delete
      </Button>

      <RoleFormDialog
        key={String(renaming)}
        open={renaming}
        onOpenChange={setRenaming}
        role={{ id: role.id, name: role.name }}
      />

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {role.name}?</DialogTitle>
            <DialogDescription>
              Nobody holds this role, so nothing else changes. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)} disabled={pending}>
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
