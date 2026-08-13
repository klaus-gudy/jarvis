"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { LeaseCard } from "@/components/leases/lease-card";
import { buildLeaseColumns } from "@/components/leases/lease-columns";
import { LeaseFormDialog } from "@/components/leases/lease-form-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, type RowAction } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeaseOptions, LeaseRow } from "@/lib/leases";

export function LeasesTable({
  leases,
  options,
}: {
  leases: LeaseRow[];
  options: LeaseOptions;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LeaseRow | null>(null);
  const [deleting, setDeleting] = React.useState<LeaseRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rowActions = React.useCallback(
    (lease: LeaseRow): RowAction[] => [
      {
        label: `View lease for ${lease.tenantName}`,
        icon: EyeIcon,
        href: `/leases/${lease.id}`,
      },
      {
        label: `Edit lease for ${lease.tenantName}`,
        icon: PencilIcon,
        onSelect: () => setEditing(lease),
      },
      {
        label: `Delete lease for ${lease.tenantName}`,
        icon: Trash2Icon,
        tone: "destructive",
        onSelect: () => {
          setError(null);
          setDeleting(lease);
        },
      },
    ],
    []
  );

  const columns = React.useMemo(
    () => buildLeaseColumns({ rowActions }),
    [rowActions]
  );

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);
    setError(null);

    const response = await fetch(`/api/leases/${deleting.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setDeleting(null);
      setPending(false);
      toast.success("Lease deleted");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Could not delete this lease";
    setError(message);
    toast.error(message);
    setPending(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <PlusIcon />
          Create lease
        </Button>
      </div>

      <DataTable
        stateKey="leases"
        columns={columns}
        data={leases}
        searchColumnId="tenantName"
        searchPlaceholder="Search leases…"
        facetFilters={[
          {
            columnId: "status",
            placeholder: "All statuses",
            label: "Status",
            options: [
              { label: "Active", value: "Active" },
              { label: "Upcoming", value: "Upcoming" },
              { label: "Ended", value: "Ended" },
            ],
          },
        ]}
        emptyMessage="No leases yet. Use “Create lease” to connect a tenant to a unit."
        getRowHref={(lease) => `/leases/${lease.id}`}
        renderCard={(lease) => <LeaseCard lease={lease} />}
        rowActions={rowActions}
      />

      <LeaseFormDialog
        key={String(formOpen)}
        open={formOpen}
        onOpenChange={setFormOpen}
        options={options}
      />

      {/* Keyed on the lease so opening a different row re-seeds the form,
          matching how the unit dialog remounts rather than syncing in an
          effect. */}
      {editing && (
        <LeaseFormDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          options={options}
          lease={{
            id: editing.id,
            propertyId: editing.propertyId,
            propertyName: editing.propertyName,
            unitId: editing.unitId,
            unitLabel: editing.unitLabel,
            unitRentAmount: editing.unitRentAmount,
            unitMinTenureMonths: editing.unitMinTenureMonths,
            membershipId: editing.membershipId,
            startDate: editing.startDate,
            durationMonths: editing.durationMonths,
            monthlyRent: editing.monthlyRent,
          }}
        />
      )}

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this lease?</DialogTitle>
            <DialogDescription>
              {deleting?.tenantName} will be disconnected from {deleting?.unitLabel}.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Deleting…" : "Delete lease"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
