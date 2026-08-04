"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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
import { formatCurrencyFull, formatDate } from "@/lib/format";
import {
  addMonths,
  DURATION_OPTIONS,
  durationLabel,
} from "@/lib/leases-schemas";
import type { LeaseOptions } from "@/lib/leases";

type Option = { value: string; label: string };

type FieldErrors = Partial<
  Record<
    "propertyId" | "unitId" | "membershipId" | "startDate" | "durationMonths",
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

export function LeaseFormDialog({
  open,
  onOpenChange,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: LeaseOptions;
}) {
  const router = useRouter();
  const [propertyId, setPropertyId] = React.useState("");
  const [unitId, setUnitId] = React.useState("");
  const [membershipId, setMembershipId] = React.useState("");
  const [startDate, setStartDate] = React.useState(todayIso());
  const [duration, setDuration] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  const property = options.properties.find((item) => item.id === propertyId) ?? null;
  const unit = property?.units.find((item) => item.id === unitId) ?? null;
  const minTenure = unit?.minTenureMonths ?? 0;

  const propertyItems: Option[] = options.properties.map((item) => ({
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

  // The unit's minimum tenure is itself offered, so a unit set to e.g. 7 months
  // isn't forced up to the next preset.
  const durationItems: Option[] = Array.from(
    new Set<number>([...DURATION_OPTIONS, ...(minTenure ? [minTenure] : [])])
  )
    .filter((months) => months >= minTenure)
    .sort((a, b) => a - b)
    .map((months) => ({ value: String(months), label: durationLabel(months) }));

  const start = parseIsoDate(startDate);
  const endDate =
    start && duration ? addMonths(start, Number(duration)) : null;

  // Dependent choices are cleared in the handlers rather than an effect, which
  // the codebase's set-state-in-effect rule disallows.
  function handlePropertyChange(next: string) {
    setPropertyId(next);
    setUnitId("");
    setDuration("");
  }

  function handleUnitChange(next: string) {
    setUnitId(next);
    const nextUnit = property?.units.find((item) => item.id === next);
    const nextMin = nextUnit?.minTenureMonths ?? 0;
    if (duration && Number(duration) < nextMin) setDuration("");
  }

  const canSubmit =
    propertyId !== "" &&
    unitId !== "" &&
    membershipId !== "" &&
    startDate !== "" &&
    duration !== "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch("/api/leases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId,
        unitId,
        membershipId,
        startDate,
        durationMonths: Number(duration),
      }),
    });

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    setFieldErrors(data?.issues ?? {});
    setFormError(data?.issues ? null : (data?.error ?? "Something went wrong"));
    setPending(false);
  }

  const noProperties = options.properties.length === 0;
  const noTenants = options.tenants.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create lease</DialogTitle>
            <DialogDescription>
              Pick a property, then one of its free units, then the tenant.
              Leases run for a fixed term.
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
              <FieldDescription>
                Only units with no current or upcoming lease are listed.
              </FieldDescription>
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
                />
              )}
              <FieldError
                errors={fieldErrors.membershipId?.map((m) => ({ message: m }))}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="lease-start">Start date</FieldLabel>
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
                <FieldLabel htmlFor="lease-duration">Duration</FieldLabel>
                <SearchSelect
                  id="lease-duration"
                  options={durationItems}
                  value={duration}
                  onChange={setDuration}
                  placeholder={unitId ? "Select term…" : "Pick a unit first"}
                  disabled={!unitId}
                />
                {minTenure > 0 && (
                  <FieldDescription>
                    This unit&apos;s minimum tenure is {minTenure} months.
                  </FieldDescription>
                )}
                <FieldError
                  errors={fieldErrors.durationMonths?.map((m) => ({ message: m }))}
                />
              </Field>
            </div>

            {endDate && (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Ends on </span>
                <span className="font-medium">{formatDate(endDate)}</span>
              </p>
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
              {pending ? "Creating…" : "Create lease"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
