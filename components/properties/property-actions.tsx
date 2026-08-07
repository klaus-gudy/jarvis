"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

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

export function PropertyActions({
  propertyId,
  propertyName,
  unitCount,
}: {
  propertyId: string;
  propertyName: string;
  unitCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  async function handleDelete() {
    setPending(true);
    setError(null);

    const response = await fetch(`/api/properties/${propertyId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setOpen(false);
      toast.success(`${propertyName} deleted`);
      router.push("/properties");
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
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link href={`/properties/${propertyId}/edit`} />}
      >
        <PencilIcon />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm">
              <Trash2Icon />
              Delete
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {propertyName}?</DialogTitle>
            <DialogDescription>
              {unitCount > 0
                ? `This also deletes its ${unitCount} unit${unitCount === 1 ? "" : "s"} and any leases on them. This cannot be undone.`
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
