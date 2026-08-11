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
import { CURRENCY, formatCurrencyFull, formatDate } from "@/lib/format";
import { addMonths, DURATION_OPTIONS } from "@/lib/leases-schemas";
import type { LeaseOptions } from "@/lib/leases";

type Option = { value: string; label: string };

type FieldErrors = Partial<
  Record<
    | "propertyId"
    | "unitId"
    | "membershipId"
    | "startDate"
    | "durationMonths"
    | "monthlyRent",
    string[]
  >
>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** yyyy-mm-dd is parsed as UTC midnight, matching how the server coerces it. */
function parseIsoDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** One searchable picker; the three cascade steps differ only in their data. */
function SearchSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={options}
      value={selected}
      onValueChange={(next: Option | null) => onChange(next?.value ?? "")}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        disabled={disabled}
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
  );
}

/** The lease being corrected, and everything the form needs to prefill it. */
export type EditableLease = {
  id: string;
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitLabel: string;
  unitRentAmount: number;
  unitMinTenureMonths: number | null;
  membershipId: string;
  startDate: string;
  durationMonths: number;
  monthlyRent: number;
};

export function LeaseFormDialog({
  open,
  onOpenChange,
  options,
  lockedTenantId,
  lease,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: LeaseOptions;
  /**
   * Opened from a tenant's own page: that tenant is the subject, so the field
   * is pre-filled and read-only rather than inviting a choice that would make
   * the lease belong to someone else's page.
   */
  lockedTenantId?: string;
  /** Supplied to correct an existing lease instead of signing a new one. */
  lease?: EditableLease;
}) {
  const router = useRouter();
  const editing = lease !== undefined;
  const [propertyId, setPropertyId] = React.useState(lease?.propertyId ?? "");
  const [unitId, setUnitId] = React.useState(lease?.unitId ?? "");
  const [membershipId, setMembershipId] = React.useState(
    lease?.membershipId ?? lockedTenantId ?? ""
  );
  const [startDate, setStartDate] = React.useState(
    lease ? lease.startDate.slice(0, 10) : todayIso()
  );
  const [duration, setDuration] = React.useState(
    lease ? String(lease.durationMonths) : ""
  );
  /**
   * Empty means "whatever the unit asks", which is what the placeholder shows
   * — so the common case needs no typing, and a negotiated rate is a
   * deliberate act rather than a prefilled number someone edits by accident.
   */
  const [rent, setRent] = React.useState(
    lease && lease.monthlyRent !== lease.unitRentAmount
      ? String(lease.monthlyRent)
      : ""
  );
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  /**
   * `options` lists only units with nothing on them, so a lease being edited
   * can't find its own unit — or its property, if that unit was the only free
   * one there. Both are folded back in so the form opens on what the lease
   * actually says.
   */
  const properties = React.useMemo(() => {
    if (!lease) return options.properties;

    const own = {
      id: lease.unitId,
      label: lease.unitLabel,
      rentAmount: lease.unitRentAmount,
      minTenureMonths: lease.unitMinTenureMonths,
    };

    const existing = options.properties.find((item) => item.id === lease.propertyId);
    if (!existing) {
      return [
        ...options.properties,
        { id: lease.propertyId, name: lease.propertyName, units: [own] },
      ];
    }

    return options.properties.map((item) =>
      item.id === lease.propertyId
        ? { ...item, units: [own, ...item.units.filter((u) => u.id !== own.id)] }
        : item
    );
  }, [lease, options.properties]);

  const property = properties.find((item) => item.id === propertyId) ?? null;
  const unit = property?.units.find((item) => item.id === unitId) ?? null;
  const minTenure = unit?.minTenureMonths ?? 0;

  const propertyItems: Option[] = properties.map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const unitItems: Option[] = (property?.units ?? []).map((item) => ({
    value: item.id,
    label: `${item.label} · ${formatCurrencyFull(item.rentAmount)}/mo`,
  }));

  const tenantItems: Option[] = options.tenants.map((item) => ({
    value: item.membershipId,
    label: item.name,
  }));

  // Blank falls back to the unit's asking rent, mirroring the server's
  // `input.monthlyRent ?? unit.rentAmount`.
  const rentOverride = rent.trim() === "" ? null : Number(rent);
  const rentValid =
    rentOverride === null ||
    (Number.isInteger(rentOverride) && rentOverride >= 0);
  const effectiveRent = rentValid && rentOverride !== null
    ? rentOverride
    : (unit?.rentAmount ?? 0);

  // Duration is typed freely, so it has to be range-checked here rather than
  // being guaranteed by the list of choices. The server re-checks both bounds.
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

  // Dependent choices are cleared in the handlers rather than an effect, which
  // the codebase's set-state-in-effect rule disallows.
  function handlePropertyChange(next: string) {
    setPropertyId(next);
    setUnitId("");
    setDuration("");
  }

  function handleUnitChange(next: string) {
    setUnitId(next);
    // A typed duration is left alone when the unit changes — silently wiping
    // what someone entered is worse than flagging it via `tooShort`.
  }

  const canSubmit =
    propertyId !== "" &&
    unitId !== "" &&
    membershipId !== "" &&
    startDate !== "" &&
    durationValid &&
    rentValid &&
    !tooShort;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch(
      editing ? `/api/leases/${lease.id}` : "/api/leases",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          unitId,
          membershipId,
          startDate,
          durationMonths,
          monthlyRent: rentOverride,
        }),
      }
    );

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      toast.success(editing ? "Lease updated" : "Lease created");
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

  const noProperties = options.properties.length === 0;
  const noTenants = options.tenants.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit lease" : "Create lease"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "The term and value are re-derived from the unit's current rent."
                : "Assign a unit and tenant for a fixed term."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="lease-property">Property</FieldLabel>
              {noProperties ? (
                <p className="text-sm text-muted-foreground">
                  No property has a free unit right now.
                </p>
              ) : (
                <SearchSelect
                  id="lease-property"
                  options={propertyItems}
                  value={propertyId}
                  onChange={handlePropertyChange}
                  placeholder="Search properties…"
                />
              )}
              <FieldError
                errors={fieldErrors.propertyId?.map((m) => ({ message: m }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="lease-unit">Unit</FieldLabel>
              <SearchSelect
                id="lease-unit"
                options={unitItems}
                value={unitId}
                onChange={handleUnitChange}
                placeholder={
                  propertyId ? "Search free units…" : "Pick a property first"
                }
                disabled={noProperties || !propertyId}
              />
              <FieldError
                errors={fieldErrors.unitId?.map((m) => ({ message: m }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="lease-tenant">Tenant</FieldLabel>
              {noTenants ? (
                <p className="text-sm text-muted-foreground">
                  No tenants yet. Add one from the Tenants page first.
                </p>
              ) : (
                <SearchSelect
                  id="lease-tenant"
                  options={tenantItems}
                  value={membershipId}
                  onChange={setMembershipId}
                  placeholder="Search tenants…"
                  disabled={lockedTenantId !== undefined}
                />
              )}
              <FieldError
                errors={fieldErrors.membershipId?.map((m) => ({ message: m }))}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="lease-start" required>Start date</FieldLabel>
                <Input
                  id="lease-start"
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
                <FieldLabel htmlFor="lease-duration">Duration (In months)</FieldLabel>
                {/* Free integer entry rather than a fixed list of terms — a
                    landlord may agree any number of months. `list` offers the
                    common terms as suggestions without restricting the field. */}
                <Input
                  id="lease-duration"
                  type="number"
                  min={Math.max(1, minTenure)}
                  max={120}
                  step={1}
                  inputMode="numeric"
                  list="lease-duration-presets"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  placeholder="12"
                  disabled={!unitId}
                />
                <datalist id="lease-duration-presets">
                  {DURATION_OPTIONS.filter((months) => months >= minTenure).map(
                    (months) => (
                      <option key={months} value={months} />
                    )
                  )}
                </datalist>
                {(tooShort || minTenure > 0) && (
                  <FieldDescription>
                    {tooShort
                      ? `Minimum tenure for this unit is ${minTenure} months.`
                      : `Minimum ${minTenure} for this unit.`}
                  </FieldDescription>
                )}
                <FieldError
                  errors={fieldErrors.durationMonths?.map((m) => ({ message: m }))}
                />
              </Field>

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="lease-rent">
                  Monthly rent ({CURRENCY})
                </FieldLabel>
                <Input
                  id="lease-rent"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={rent}
                  onChange={(event) => setRent(event.target.value)}
                  placeholder={unit ? String(unit.rentAmount) : "Pick a unit first"}
                  disabled={!unitId}
                />
                <FieldDescription>
                  {unit
                    ? `Leave blank to charge the unit's asking rent of ${formatCurrencyFull(unit.rentAmount)}.`
                    : "Defaults to the unit's asking rent."}
                </FieldDescription>
                <FieldError
                  errors={fieldErrors.monthlyRent?.map((m) => ({ message: m }))}
                />
              </Field>
            </div>

            {endDate && (
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Ends on </span>
                  <span className="font-medium">{formatDate(endDate)}</span>
                </p>
                {/* Editing re-derives the value, so it is shown before saving
                    rather than letting the total change out of sight. */}
                {unit && (
                  <p>
                    <span className="text-muted-foreground">
                      {formatCurrencyFull(effectiveRent)} × {durationMonths} ={" "}
                    </span>
                    <span className="font-mono font-medium tabular-nums">
                      {formatCurrencyFull(effectiveRent * durationMonths)}
                    </span>
                  </p>
                )}
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
              {pending
                ? editing
                  ? "Saving…"
                  : "Creating…"
                : editing
                  ? "Save changes"
                  : "Create lease"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
