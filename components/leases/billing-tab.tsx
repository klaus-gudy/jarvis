"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { DetailRow } from "@/components/detail-row";
import { RecordPaymentDialog } from "@/components/leases/record-payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/invoices";

const STATUS_VARIANT: Record<InvoiceStatus, "secondary" | "outline" | "destructive"> = {
  Paid: "secondary",
  Partial: "outline",
  Unpaid: "destructive",
};

export type BillingPayment = {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  notes: string | null;
};

export type BillingInvoice = {
  id: string;
  amount: number;
  dueDate: string;
  paid: number;
  balance: number;
  status: InvoiceStatus;
  payments: BillingPayment[];
};

export function BillingTab({ invoice }: { invoice: BillingInvoice | null }) {
  const router = useRouter();
  const [recording, setRecording] = React.useState(false);
  const [deleting, setDeleting] = React.useState<BillingPayment | null>(null);
  const [pending, setPending] = React.useState(false);

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
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between border-b">
          <CardTitle className="text-base">Invoice</CardTitle>
          <Badge variant={STATUS_VARIANT[invoice.status]} className="rounded-full font-normal">
            {invoice.status}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <dl>
            <DetailRow
              label="Total amount"
              value={
                <span className="font-mono tabular-nums">
                  {formatCurrencyFull(invoice.amount)}
                </span>
              }
            />
            <DetailRow label="Due date" value={formatDate(new Date(invoice.dueDate))} />
            <DetailRow
              label="Paid so far"
              value={
                <span className="font-mono tabular-nums">
                  {formatCurrencyFull(invoice.paid)}
                </span>
              }
            />
            <DetailRow
              label="Balance remaining"
              value={
                <span className="font-mono tabular-nums">
                  {formatCurrencyFull(invoice.balance)}
                </span>
              }
            />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between border-b">
          <CardTitle className="text-base">Payments</CardTitle>
          <Button
            size="sm"
            onClick={() => setRecording(true)}
            disabled={invoice.balance <= 0}
          >
            Record payment
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {invoice.payments.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No payments recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-9" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(new Date(payment.paidAt))}</TableCell>
                    <TableCell>{payment.method ?? "—"}</TableCell>
                    <TableCell className="max-w-48 truncate">
                      {payment.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrencyFull(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(payment)}
                        aria-label="Remove payment"
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog
        key={String(recording)}
        open={recording}
        onOpenChange={setRecording}
        invoiceId={invoice.id}
        balance={invoice.balance}
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
