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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrganizationDeletionSummary } from "@/lib/organizations";

/** Rows are hidden when zero, so the list never pads the danger with "0 leases". */
function SummaryList({ summary }: { summary: OrganizationDeletionSummary }) {
  const rows = [
    { label: "members", value: summary.members },
    { label: "properties", value: summary.properties },
    { label: "units", value: summary.units },
    { label: "leases", value: summary.leases },
    { label: "recorded payments", value: summary.payments },
  ].filter((row) => row.value > 0);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This organization has no data in it yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1 text-sm">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-medium tabular-nums">
            {row.value.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

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
  const [summary, setSummary] =
    React.useState<OrganizationDeletionSummary | null>(null);
  const [confirmation, setConfirmation] = React.useState("");
  const [pending, setPending] = React.useState(false);

  // The component is mounted only while open (the parent keys it), so this
  // fetch runs once per opening and the counts can't be stale from last time.
  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/organizations/${organizationId}/deletion-summary`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setSummary(data?.summary ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

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

    toast.success(`${organizationName} deleted`);
    onOpenChange(false);
    // Not router.refresh() alone: every page under this layout is scoped to an
    // organization that no longer exists. /dashboard is the one route that
    // handles having no organization, by showing the create prompt.
    router.push("/dashboard");
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

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            {summary ? (
              <SummaryList summary={summary} />
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            )}
          </div>

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
            <FieldDescription>
              Other members lose access immediately. Their accounts are not
              deleted.
            </FieldDescription>
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
