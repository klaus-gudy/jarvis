"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { MakePaymentDialog } from "@/components/payments/make-payment-dialog";
import { PaymentCard } from "@/components/payments/payment-card";
import { buildPaymentColumns } from "@/components/payments/payment-columns";
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
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { INVOICE_STATUSES } from "@/lib/invoice-types";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";
import type { PaymentRow, PayableInvoice } from "@/lib/payments";

export function PaymentsTable({
  payments,
  payableInvoices,
}: {
  payments: PaymentRow[];
  payableInvoices: PayableInvoice[];
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PaymentRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const rowActions = React.useCallback(
    (payment: PaymentRow): RowAction[] => [
      {
        label: `Remove payment of ${payment.amount}`,
        icon: Trash2Icon,
        tone: "destructive",
        onSelect: () => {
          setError(null);
          setDeleting(payment);
        },
      },
    ],
    []
  );

  const columns = React.useMemo(
    () => buildPaymentColumns({ rowActions }),
    [rowActions]
  );

  async function handleDelete() {
    if (!deleting) return;
    setPending(true);
    setError(null);

    const response = await fetch(
      `/api/invoices/${deleting.invoiceId}/payments/${deleting.id}`,
      { method: "DELETE" }
    );

    setPending(false);
    if (response.ok) {
      setDeleting(null);
      toast.success("Payment removed");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Could not remove this payment";
    setError(message);
    toast.error(message);
  }

  return (
    <div className="space-y-4">
      {/* Totals live on the dashboard's Payments card, not here — this page is
          the ledger. */}
      <div className="flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <PlusIcon />
          Make payment
        </Button>
      </div>

      <DataTable
        stateKey="payments"
        columns={columns}
        data={payments}
        searchColumnId="tenantName"
        searchPlaceholder="Search payments…"
        facetFilters={[
          {
            columnId: "propertyName",
            placeholder: "All properties",
            label: "Property",
            // Derived from the rows on screen rather than a separate query, so
            // the list can never offer a property with nothing to show.
            options: [...new Set(payments.map((p) => p.propertyName))]
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
            columnId: "method",
            placeholder: "All methods",
            label: "Method",
            options: PAYMENT_METHOD_OPTIONS.map((option) => ({
              label: option,
              value: option,
            })),
          },
        ]}
        emptyMessage="No payments recorded yet. Use “Make payment” to record one against an invoice."
        getRowHref={(payment) => `/leases/${payment.leaseId}`}
        renderCard={(payment) => <PaymentCard payment={payment} />}
        rowActions={rowActions}
      />

      <MakePaymentDialog
        key={String(formOpen)}
        open={formOpen}
        onOpenChange={setFormOpen}
        invoices={payableInvoices}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this payment?</DialogTitle>
            <DialogDescription>
              {deleting ? formatCurrencyFull(deleting.amount) : ""} recorded on{" "}
              {deleting ? formatDate(new Date(deleting.paidAt)) : ""} against{" "}
              {deleting?.invoiceReference} will be removed. This cannot be undone.
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
              {pending ? "Removing…" : "Remove payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
