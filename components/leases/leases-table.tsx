"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, PencilIcon, PlusIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { LeaseCard } from "@/components/leases/lease-card";
import { buildLeaseColumns } from "@/components/leases/lease-columns";
import { LeaseFormDialog } from "@/components/leases/lease-form-dialog";
import { RecordPaymentDialog } from "@/components/leases/record-payment-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, type RowAction } from "@/components/ui/data-table";
import { INVOICE_STATUSES } from "@/lib/invoice-types";
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
  const [paying, setPaying] = React.useState<LeaseRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rowActions = React.useCallback(
    (lease: LeaseRow): RowAction[] => {
      const balance = lease.invoice
        ? lease.invoice.amount - lease.invoice.paid
        : 0;

      return [
        /*
         * Payment leads: it is the routine job on this page, and the actions
         * stay in one order on every row — a lease with nothing to pay shows
         * the control greyed rather than dropping it, because omitting it
         * would shift View, Edit and Delete one place left and turn a familiar
         * position into a misclick.
         */
        {
          label: `Make payment for ${lease.tenantName}`,
          icon: WalletIcon,
          onSelect: () => setPaying(lease),
          disabled: balance <= 0,
          disabledReason: !lease.invoice
            ? "No invoice yet"
            : "Fully paid",
        },
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
      ];
    },
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
        <Button data-tour="add-lease" onClick={() => setFormOpen(true)}>
          <PlusIcon />
          Create lease
        </Button>
      </div>

      <DataTable
        stateKey="leases"
        columns={columns}
        data={leases}
        searchPlaceholder="Search leases…"
        facetFilters={[
          {
            columnId: "propertyName",
            placeholder: "All properties",
            label: "Property",
            // From the rows themselves, not `options.properties`: that list
            // includes properties with no lease yet, which would filter to an
            // empty table.
            options: [...new Set(leases.map((lease) => lease.propertyName))]
              .sort()
              .map((name) => ({ label: name, value: name })),
          },
          {
            columnId: "invoiceStatus",
            placeholder: "All invoice statuses",
            label: "Invoice status",
            options: INVOICE_STATUSES.map((status) => ({
              label: status,
              value: status,
            })),
          },
          {
            columnId: "status",
            placeholder: "All statuses",
            label: "Lease status",
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

      {/* The invoice is fixed by the row that opened this, so it uses the
          lease's own dialog — the picker version would ask which invoice when
          the answer is already known. Keyed on the lease so opening a
          different row re-seeds the form rather than syncing in an effect. */}
      {paying?.invoice && (
        <RecordPaymentDialog
          key={paying.id}
          open
          onOpenChange={(open) => !open && setPaying(null)}
          invoice={{
            id: paying.invoice.id,
            amount: paying.invoice.amount,
            paid: paying.invoice.paid,
            balance: paying.invoice.amount - paying.invoice.paid,
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
