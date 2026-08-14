"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
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
import { CURRENCY, formatCurrencyFull, formatMoneyFull } from "@/lib/format";
import { PAYMENT_METHOD_OPTIONS } from "@/lib/payment-options";
import type { PayableInvoice } from "@/lib/payments";

type Option = { value: string; label: string };

type FieldErrors = Partial<
  Record<"invoiceId" | "amount" | "paidAt" | "method" | "notes", string[]>
>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function MakePaymentDialog({
  open,
  onOpenChange,
  invoices,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: PayableInvoice[];
}) {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(todayIso());
  const [method, setMethod] = React.useState<string>(PAYMENT_METHOD_OPTIONS[0]);
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  const selectedInvoice = invoices.find((invoice) => invoice.id === invoiceId) ?? null;

  const options: Option[] = invoices.map((invoice) => ({
    value: invoice.id,
    label: `${invoice.reference} · ${invoice.tenantName} · ${invoice.propertyName}/${invoice.unitLabel} · ${formatCurrencyFull(invoice.balance)} due`,
  }));
  const selectedOption = options.find((option) => option.value === invoiceId) ?? null;

  // The field takes arithmetic ("250000*5" for five months' rent), so what is
  // typed and what is sent are no longer the same thing.
  const amountResult = React.useMemo(() => evaluateAmount(amount), [amount]);
  const amountValue = amountResult.status === "ok" ? amountResult.value : null;

  // Mirrors the server's overpayment guard so the form can say so before a
  // round trip; the server still re-checks, since this list can go stale.
  // Compares the *evaluated* total — checking the raw text would wave through
  // "250000*5" against a 300,000 balance.
  const overBalance =
    selectedInvoice !== null &&
    amountValue !== null &&
    amountValue > selectedInvoice.balance;


  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!selectedInvoice) {
      setFieldErrors({ invoiceId: ["Select an invoice"] });
      return;
    }
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
    if (overBalance) {
      setFieldErrors({
        amount: [
          `That's more than the remaining balance of ${formatCurrencyFull(selectedInvoice.balance)}`,
        ],
      });
      return;
    }

    setPending(true);

    const response = await fetch(`/api/invoices/${selectedInvoice.id}/payments`, {
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
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Make payment</DialogTitle>
            <DialogDescription>
              Record a payment against an invoice that still has a balance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="payment-invoice" required>
                Invoice
              </FieldLabel>
              {invoices.length === 0 ? (
                <FieldDescription>
                  Every invoice is fully paid — there is nothing outstanding to
                  pay right now.
                </FieldDescription>
              ) : (
                <Combobox
                  items={options}
                  value={selectedOption}
                  onValueChange={(next: Option | null) => {
                    setInvoiceId(next?.value ?? "");
                    setFieldErrors({});
                  }}
                  isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
                >
                  <ComboboxInput
                    id="payment-invoice"
                    placeholder="Search unpaid invoices…"
                    className="w-full"
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No matches.</ComboboxEmpty>
                    <ComboboxList>
                      <ComboboxCollection>
                        {(item: Option) => (
                          <ComboboxItem key={item.value} value={item}>
                            {item.label}
                          </ComboboxItem>
                        )}
                      </ComboboxCollection>
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              )}
              <FieldError
                errors={fieldErrors.invoiceId?.map((m) => ({ message: m }))}
              />
            </Field>

            {selectedInvoice && (
              <InvoiceSummaryCard
                amount={selectedInvoice.amount}
                paid={selectedInvoice.paid}
                balance={selectedInvoice.balance}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="payment-amount" required>
                  Amount ({CURRENCY})
                </FieldLabel>
                <AmountInput
                  id="payment-amount"
                  value={amount}
                  onValueChange={setAmount}
                  placeholder={
                    selectedInvoice
                      ? formatMoneyFull(selectedInvoice.balance)
                      : "100,000"
                  }
                  required
                />
                {/* No caption under the field: the sum folds into the input
                    itself on blur, and the card above already states the
                    balance this has to stay within. */}
                <FieldError
                  errors={
                    amountResult.status === "invalid"
                      ? [{ message: amountResult.message }]
                      : overBalance && selectedInvoice
                        ? [
                            {
                              message: `That's more than the remaining balance of ${formatCurrencyFull(selectedInvoice.balance)}`,
                            },
                          ]
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
                <FieldError
                  errors={fieldErrors.paidAt?.map((m) => ({ message: m }))}
                />
              </Field>
            </div>

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
              <FieldError
                errors={fieldErrors.method?.map((m) => ({ message: m }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="payment-notes">Notes</FieldLabel>
              <Input
                id="payment-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Reference number, who paid, anything worth recording"
                maxLength={200}
              />
              <FieldError
                errors={fieldErrors.notes?.map((m) => ({ message: m }))}
              />
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
            <Button
              type="submit"
              disabled={pending || invoices.length === 0 || overBalance}
            >
              {pending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
