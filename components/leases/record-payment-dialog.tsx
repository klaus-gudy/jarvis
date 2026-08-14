"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmountInput } from "@/components/payments/amount-input";
import { InvoiceSummaryCard } from "@/components/payments/invoice-summary-card";
import { evaluateAmount } from "@/lib/amount-expression";
import { formatMoneyFull } from "@/lib/format";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";

type FieldErrors = Partial<Record<"amount" | "paidAt" | "method" | "notes", string[]>>;

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Structural rather than importing `BillingInvoice` from `billing-tab`,
   * which imports this dialog — a type-only cycle TypeScript would tolerate,
   * but not one worth creating.
   *
   * The invoice is **fixed**: a lease has exactly one, so there is nothing to
   * choose between and no picker. The card below is a read-out, not a control.
   */
  invoice: { id: string; amount: number; paid: number; balance: number };
}) {
  const { id: invoiceId, balance } = invoice;
  const router = useRouter();
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(todayInputValue());
  const [method, setMethod] = React.useState<string>(PAYMENT_METHOD_OPTIONS[0]);
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  // The field takes arithmetic ("250000*5" for five months' rent), so what is
  // typed and what is sent are no longer the same thing.
  const amountResult = React.useMemo(() => evaluateAmount(amount), [amount]);
  const amountValue = amountResult.status === "ok" ? amountResult.value : null;


  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (amountValue === null) {
      setFieldErrors({
        amount: [
          amountResult.status === "invalid"
            ? amountResult.message
            : "Enter an amount",
        ],
      });
      return;
    }

    setPending(true);

    const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountValue,
        paidAt,
        method: method || undefined,
        notes: notes || undefined,
      }),
    });

    if (response.ok) {
      onOpenChange(false);
      toast.success("Payment recorded");
      router.refresh();
      setPending(false);
      return;
    }

    const data = await response.json().catch(() => null);
    setFieldErrors(data?.issues ?? {});
    const message = data?.issues ? null : (data?.error ?? "Something went wrong");
    setFormError(message);
    if (message) toast.error(message);
    setPending(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form key={String(open)} onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            {/* The balance used to be stated here; the card below now carries
                it along with the total and what has been paid, so repeating it
                would be two places to read the same number from. */}
            <DialogDescription>
              Recorded against this lease&apos;s invoice.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Read-only: this lease has one invoice, so it is stated, not
                chosen. Same breakdown the payments page shows above its
                picker. */}
            <InvoiceSummaryCard
              amount={invoice.amount}
              paid={invoice.paid}
              balance={invoice.balance}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="payment-amount" required>
                  Amount
                </FieldLabel>
                <AmountInput
                  id="payment-amount"
                  value={amount}
                  onValueChange={setAmount}
                  placeholder={formatMoneyFull(balance)}
                  required
                />
                <FieldError
                  errors={
                    amountResult.status === "invalid"
                      ? [{ message: amountResult.message }]
                      : fieldErrors.amount?.map((m) => ({ message: m }))
                  }
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="payment-date" required>
                  Date
                </FieldLabel>
                <Input
                  id="payment-date"
                  type="date"
                  value={paidAt}
                  onChange={(event) => setPaidAt(event.target.value)}
                  required
                />
                <FieldError errors={fieldErrors.paidAt?.map((m) => ({ message: m }))} />
              </Field>
            </div>

            {/* Same closed list the payments page uses — free text here would
                produce methods its facet filter could never match. */}
            <Field>
              <FieldLabel htmlFor="payment-method" required>
                Method of payment
              </FieldLabel>
              <Select
                value={method}
                onValueChange={(next) => next && setMethod(next)}
              >
                <SelectTrigger id="payment-method" className="w-full">
                  <SelectValue>{(selected: string) => selected}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={fieldErrors.method?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="payment-notes">Notes</FieldLabel>
              <Input
                id="payment-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional"
              />
              <FieldError errors={fieldErrors.notes?.map((m) => ({ message: m }))} />
            </Field>

            {formError && <FieldError>{formError}</FieldError>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
