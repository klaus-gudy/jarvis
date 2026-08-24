"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function DeleteOrganizationDialog({
  open,
  onOpenChange,
  organizationId,
  organizationName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = React.useState("");
  const [pending, setPending] = React.useState(false);

  // Exact match, trimmed only for stray whitespace — a case-insensitive or
  // fuzzy check would defeat the point of asking someone to type it out.
  const confirmed = confirmation.trim() === organizationName;

  async function handleDelete() {
    if (!confirmed) return;
    setPending(true);

    const response = await fetch(`/api/organizations/${organizationId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      toast.error(data?.error ?? "Could not delete the organization");
      setPending(false);
      return;
    }

    toast.success(`${organizationName} deleted — you've been signed out`);
    onOpenChange(false);
    // The DELETE call already cleared the session cookie server-side, in the
    // same request as the delete, so by the time this runs there is no valid
    // session left to fall back into. `/`, not `/dashboard`: everything under
    // `(app)` requires a session and would just bounce to `/login`, and `/` is
    // the public landing page proxy.ts serves once it sees none. Same
    // push-then-refresh pairing `handleSignOut` uses in nav-user.tsx, so the
    // freshly rendered `/` reflects the cleared session rather than a cached
    // payload from before the delete.
    router.push("/");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={pending ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlertIcon className="size-4 text-destructive" aria-hidden />
            Delete {organizationName}?
          </DialogTitle>
          <DialogDescription>
            This permanently deletes the organization and everything in it. It
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Field>
            <FieldLabel htmlFor="delete-org-confirm">
              Type the organization name to confirm
            </FieldLabel>
            <Input
              id="delete-org-confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={organizationName}
              autoComplete="off"
              disabled={pending}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!confirmed || pending}
          >
            {pending ? "Deleting…" : "Delete organization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
