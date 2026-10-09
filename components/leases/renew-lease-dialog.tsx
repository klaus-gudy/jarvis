"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AmountInput } from "@/components/payments/amount-input";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { evaluateAmount } from "@/lib/amount-expression";
import { lastDayOf } from "@/lib/dates";
import { CURRENCY, formatCurrencyFull, formatDate, formatMoneyFull } from "@/lib/format";
import { addMonths, DURATION_OPTIONS } from "@/lib/leases-schemas";

/** The lease being renewed, and what its successor is prefilled from. */
export type RenewableLease = {
  id: string;
  reference: string;
  propertyName: string;
  unitLabel: string;
  /** ISO; the stored, exclusive end — the renewal's default start. */
  endDate: string;
  durationMonths: number;
  monthlyRent: number;
  autoRenew: boolean;
  unitRentAmount: number;
  minTenureMonths: number | null;
};

type FieldErrors = Partial<
  Record<"startDate" | "durationMonths" | "monthlyRent", string[]>
>;

/** yyyy-mm-dd is parsed as UTC midnight, matching how the server coerces it. */
function parseIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The form's starting values for one lease: everything carried forward. */
function prefill(lease: RenewableLease) {
  const minTenure = lease.minTenureMonths ?? 0;
  return {
    // The stored end is exclusive, so the successor starts on it with no gap —
    // the same start the automatic renewal picks.
    startDate: lease.endDate.slice(0, 10),
    duration: String(Math.max(lease.durationMonths, minTenure)),
    rent: formatMoneyFull(lease.monthlyRent),
    autoRenew: lease.autoRenew,
  };
}

/**
 * Renews a lease by hand: same unit, same tenant, a new term that starts where
 * the old one ends. Every field is prefilled from the lease being renewed, so
 * the common case is a single confirm; the term, rent and auto-renew can be
 * changed first. With several renewable leases, the first field picks which.
 */
export function RenewLeaseDialog({
  open,
  onOpenChange,
  leases,
  initialLeaseId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leases: RenewableLease[];
  initialLeaseId?: string;
}) {
  const router = useRouter();
  const [leaseId, setLeaseId] = React.useState(initialLeaseId ?? leases[0]?.id ?? "");
  const lease = leases.find((item) => item.id === leaseId) ?? null;

  const initial = lease ? prefill(lease) : null;
  const [startDate, setStartDate] = React.useState(initial?.startDate ?? "");
  const [duration, setDuration] = React.useState(initial?.duration ?? "");
  const [rent, setRent] = React.useState(initial?.rent ?? "");
  const [autoRenew, setAutoRenew] = React.useState(initial?.autoRenew ?? true);
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  // Reset in the handler rather than an effect (set-state-in-effect rule).
  function handleLeaseChange(next: string) {
    const picked = leases.find((item) => item.id === next);
    if (!picked) return;
    const values = prefill(picked);
    setLeaseId(next);
    setStartDate(values.startDate);
    setDuration(values.duration);
    setRent(values.rent);
    setAutoRenew(values.autoRenew);
    setFieldErrors({});
    setFormError(null);
  }

  const minTenure = lease?.minTenureMonths ?? 0;

  const rentResult = evaluateAmount(rent);
  const monthlyRent = rentResult.status === "ok" ? rentResult.value : null;

  const durationMonths = Number(duration);
  const durationValid =
    duration.trim() !== "" &&
    Number.isInteger(durationMonths) &&
    durationMonths >= 1 &&
    durationMonths <= 120;
  const tooShort = durationValid && durationMonths < minTenure;

  const start = parseIsoDate(startDate);
  const endDate =
    start && durationValid && !tooShort ? addMonths(start, durationMonths) : null;

  const canSubmit =
    lease !== null && start !== null && durationValid && !tooShort && monthlyRent !== null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lease) return;
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch(`/api/leases/${lease.id}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, durationMonths, monthlyRent, autoRenew }),
    });

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      toast.success("Lease renewed");
      router.refresh();
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
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Renew lease</DialogTitle>
            <DialogDescription>
              A new term on the same unit, starting the day after the previous
              one ended. Confirm, or change the terms first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {leases.length > 1 ? (
              <Field>
                <FieldLabel htmlFor="renew-lease">Lease to renew</FieldLabel>
                <Select
                  value={leaseId}
                  onValueChange={(next) => next && handleLeaseChange(next)}
                >
                  <SelectTrigger id="renew-lease" className="w-full">
                    <SelectValue>
                      {(selected: string) => {
                        const item = leases.find((l) => l.id === selected);
                        return item
                          ? `${item.propertyName} · ${item.unitLabel}`
                          : "Pick a lease";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {leases.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.propertyName} · {item.unitLabel} ({item.reference})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {lease && (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">
                  {lease.propertyName} · {lease.unitLabel}
                </p>
                <p className="text-muted-foreground">
                  {lease.reference} ended on{" "}
                  {formatDate(lastDayOf(new Date(lease.endDate)))} ·{" "}
                  {lease.durationMonths} months at{" "}
                  {formatCurrencyFull(lease.monthlyRent)}/mo
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="renew-start" required>Start date</FieldLabel>
                <Input
                  id="renew-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
                <FieldError
                  errors={fieldErrors.startDate?.map((m) => ({ message: m }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="renew-duration">Duration (In months)</FieldLabel>
                <Input
                  id="renew-duration"
                  type="number"
                  min={Math.max(1, minTenure)}
                  max={120}
                  step={1}
                  inputMode="numeric"
                  list="renew-duration-presets"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  placeholder="12"
                />
                <datalist id="renew-duration-presets">
                  {DURATION_OPTIONS.filter((months) => months >= minTenure).map(
                    (months) => (
                      <option key={months} value={months} />
                    )
                  )}
                </datalist>
                {tooShort && (
                  <FieldDescription>
                    Minimum tenure for this unit is {minTenure} months.
                  </FieldDescription>
                )}
                <FieldError
                  errors={fieldErrors.durationMonths?.map((m) => ({ message: m }))}
                />
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="renew-rent" required>
                  Monthly rent ({CURRENCY})
                </FieldLabel>
                <AmountInput
                  id="renew-rent"
                  value={rent}
                  onValueChange={setRent}
                  placeholder={lease ? formatMoneyFull(lease.monthlyRent) : ""}
                />
                {lease && lease.unitRentAmount !== lease.monthlyRent && (
                  <FieldDescription>
                    Carried over from the previous lease. The unit&apos;s asking
                    rent is now {formatCurrencyFull(lease.unitRentAmount)}.
                  </FieldDescription>
                )}
                <FieldError
                  errors={
                    rentResult.status === "invalid"
                      ? [{ message: rentResult.message }]
                      : fieldErrors.monthlyRent?.map((m) => ({ message: m }))
                  }
                />
              </Field>
            </div>

            <Field orientation="horizontal">
              <Switch
                id="renew-auto-renew"
                checked={autoRenew}
                onCheckedChange={setAutoRenew}
              />
              <FieldLabel htmlFor="renew-auto-renew" className="font-normal">
                Renew automatically when the new term ends
              </FieldLabel>
            </Field>

            {endDate && monthlyRent !== null && (
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Ends on </span>
                  <span className="font-medium">{formatDate(lastDayOf(endDate))}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {formatCurrencyFull(monthlyRent)} × {durationMonths} ={" "}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatCurrencyFull(monthlyRent * durationMonths)}
                  </span>
                </p>
              </div>
            )}

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
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? "Renewing…" : "Renew lease"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
