"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { PropertyFormDialog } from "@/components/properties/property-form-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PropertySummary } from "@/lib/properties";

/**
 * View / Edit / Delete for one property card.
 *
 * Rendered *beside* the card's link rather than inside it — a `<button>` within
 * an `<a>` is invalid markup, and the whole-card link is what makes the rest of
 * the card clickable. The same icon strip and destructive tone as the tables'
 * `RowActionButtons`, so an action means the same thing wherever it appears.
 */
export function PropertyCardActions({ property }: { property: PropertySummary }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);

    const response = await fetch(`/api/properties/${property.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setDeleteOpen(false);
      setPending(false);
      toast.success(`${property.name} deleted`);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Could not delete this property";
    setError(message);
    toast.error(message);
    setPending(false);
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={`View ${property.name}`}
        nativeButton={false}
        render={<Link href={`/properties/${property.id}`} />}
      >
        <EyeIcon />
      </Button>

      <Button
        variant="outline"
        size="icon-sm"
        aria-label={`Edit ${property.name}`}
        onClick={() => setEditOpen(true)}
      >
        <PencilIcon />
      </Button>

      <Button
        variant="outline"
        size="icon-sm"
        className="text-destructive"
        aria-label={`Delete ${property.name}`}
        onClick={() => {
          setError(null);
          setDeleteOpen(true);
        }}
      >
        <Trash2Icon />
      </Button>

      {/* Mounted only while open so it re-seeds from the row's current values
          on every open, matching the edit dialogs elsewhere. */}
      {editOpen && (
        <PropertyFormDialog
          key={property.id}
          open
          onOpenChange={(open) => !open && setEditOpen(false)}
          ownerName={property.ownerName}
          property={{
            id: property.id,
            name: property.name,
            type: property.type,
            category: property.category,
            address: property.address,
            status: property.status,
            description: property.description ?? "",
            amenities: property.amenities,
          }}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {property.name}?</DialogTitle>
            <DialogDescription>
              {property.totalUnits > 0
                ? `This also deletes its ${property.totalUnits} unit${property.totalUnits === 1 ? "" : "s"} and any leases on them. This cannot be undone.`
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
