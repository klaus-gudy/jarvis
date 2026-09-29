"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  UnitFormDialog,
  unitFormValues,
} from "@/components/properties/unit-form-dialog";
import { useCan } from "@/components/permissions-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * The unit page's header buttons — the property page's `PropertyActions`,
 * pointed at one unit. Deleting leaves for the property's Units tab, since the
 * page being looked at no longer exists.
 */
export function UnitActions({
  propertyId,
  unit,
  isOccupied,
  leaseCount,
}: {
  propertyId: string;
  unit: Parameters<typeof unitFormValues>[0] & { id: string };
  isOccupied: boolean;
  /** Every lease the unit has held — they cascade with it. */
  leaseCount: number;
}) {
  const canWrite = useCan("property:write");
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  async function handleDelete() {
    setPending(true);
    setError(null);

    const response = await fetch(
      `/api/properties/${propertyId}/units/${unit.id}`,
      { method: "DELETE" }
    );

    if (response.ok) {
      setOpen(false);
      toast.success(`Unit ${unit.label} deleted`);
      router.push(`/properties/${propertyId}?tab=units`);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Could not delete this unit";
    setError(message);
    toast.error(message);
    setPending(false);
  }

  return (
    // Same stacking as `PropertyActions`: full width on a phone, a row from `sm`.
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
      <Button
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        onClick={() => setEditOpen(true)}
        disabled={!canWrite}
        title={canWrite ? undefined : "Your role doesn't allow this"}
      >
        <PencilIcon />
        Edit
      </Button>

      {/* Mounted per open so the form re-seeds from the latest values. */}
      {editOpen && (
        <UnitFormDialog
          key={unit.id}
          open
          onOpenChange={(open) => !open && setEditOpen(false)}
          propertyId={propertyId}
          unitId={unit.id}
          initialValues={unitFormValues(unit)}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={!canWrite}
              title={canWrite ? undefined : "Your role doesn't allow this"}
            >
              <Trash2Icon />
              Delete
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete unit {unit.label}?</DialogTitle>
            <DialogDescription>
              {isOccupied
                ? "This unit is currently occupied — deleting it also removes its lease. This cannot be undone."
                : leaseCount > 0
                  ? `This also deletes its ${leaseCount} past lease${leaseCount === 1 ? "" : "s"}. This cannot be undone.`
                  : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
