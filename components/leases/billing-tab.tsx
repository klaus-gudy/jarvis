"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { BillingPaymentCard } from "@/components/leases/billing-payment-card";
import {
  buildBillingPaymentColumns,
  type BillingPaymentRow,
} from "@/components/leases/billing-payment-columns";
import { RecordPaymentDialog } from "@/components/leases/record-payment-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { InvoiceStatus } from "@/lib/invoice-types";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";

export type BillingPayment = {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  notes: string | null;
};

export type BillingInvoice = {
  id: string;
  reference: string;
  amount: number;
  dueDate: string;
  paid: number;
  balance: number;
  status: InvoiceStatus;
  payments: BillingPayment[];
};

/**
 * The payment ledger for one lease. The invoice's own figures live on the
 * Overview tab beside the lease terms — this tab is only what has been paid
 * against it.
 */
export function BillingTab({ invoice }: { invoice: BillingInvoice | null }) {
  const router = useRouter();
  const [recording, setRecording] = React.useState(false);
  const [deleting, setDeleting] = React.useState<BillingPaymentRow | null>(null);
  const [pending, setPending] = React.useState(false);

  const rowActions = React.useCallback(
    (payment: BillingPaymentRow): RowAction[] => [
      {
        label: `Remove payment of ${payment.amount}`,
        icon: Trash2Icon,
        tone: "destructive",
        onSelect: () => setDeleting(payment),
      },
    ],
    []
  );

  const columns = React.useMemo(
    () => buildBillingPaymentColumns({ rowActions }),
    [rowActions]
  );

  const rows: BillingPaymentRow[] = React.useMemo(
    () =>
      (invoice?.payments ?? []).map((payment) => ({
        ...payment,
        invoiceReference: invoice?.reference ?? "",
      })),
    [invoice]
  );

  async function handleDeletePayment() {
    if (!invoice || !deleting) return;
    setPending(true);

    const response = await fetch(
      `/api/invoices/${invoice.id}/payments/${deleting.id}`,
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
    toast.error(data?.error ?? "Could not remove this payment");
  }

  if (!invoice) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No invoice exists for this lease yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Outside the table's card, matching the payments page and the leases
          page — the action belongs to the page, not to a card. */}
      <div className="flex justify-end">
        <Button onClick={() => setRecording(true)} disabled={invoice.balance <= 0}>
          Record payment
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search payments…"
        facetFilters={[
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
        emptyMessage="No payments recorded yet."
        renderCard={(payment) => <BillingPaymentCard payment={payment} />}
        rowActions={rowActions}
      />

      <RecordPaymentDialog
        key={String(recording)}
        open={recording}
        onOpenChange={setRecording}
        invoice={invoice}
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
              {deleting ? formatDate(new Date(deleting.paidAt)) : ""} will be removed.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeletePayment} disabled={pending}>
              {pending ? "Removing…" : "Remove payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
