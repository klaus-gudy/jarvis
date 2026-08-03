"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { CURRENCY } from "@/lib/format";
import {
  MIN_TENURE_OPTIONS,
  UNIT_AMENITY_OPTIONS,
  UNIT_TYPE_OPTIONS,
} from "@/lib/unit-options";

export type UnitFormValues = {
  label: string;
  rentAmount: string;
  minTenureMonths: string;
  unitType: string;
  floor: string;
  block: string;
  sizeSqm: string;
  amenities: string[];
};

const NONE = "__none__";

const EMPTY: UnitFormValues = {
  label: "",
  rentAmount: "",
  minTenureMonths: NONE,
  unitType: NONE,
  floor: "",
  block: "",
  sizeSqm: "",
  amenities: [],
};

type FieldErrors = Partial<Record<keyof UnitFormValues, string[]>>;

export function UnitFormDialog({
  open,
  onOpenChange,
  propertyId,
  unitId,
  initialValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  unitId?: string;
  initialValues?: UnitFormValues;
}) {
  const router = useRouter();
  const mode = unitId ? "edit" : "create";
  const [values, setValues] = React.useState<UnitFormValues>(
    initialValues ?? EMPTY
  );
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function set<K extends keyof UnitFormValues>(key: K, value: UnitFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleAmenity(amenity: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      amenities: checked
        ? [...current.amenities, amenity]
        : current.amenities.filter((item) => item !== amenity),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      label: values.label,
      rentAmount: Number(values.rentAmount),
      minTenureMonths:
        values.minTenureMonths === NONE ? null : Number(values.minTenureMonths),
      unitType: values.unitType === NONE ? null : values.unitType,
      floor: values.floor || undefined,
      block: values.block || undefined,
      sizeSqm: values.sizeSqm ? Number(values.sizeSqm) : null,
      amenities: values.amenities,
    };

    const response = await fetch(
      mode === "create"
        ? `/api/properties/${propertyId}/units`
        : `/api/properties/${propertyId}/units/${unitId}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      onOpenChange(false);
      router.refresh();
      setPending(false);
      return;
    }

    const data = await response.json().catch(() => null);
    setFieldErrors(data?.issues ?? {});
    setFormError(data?.issues ? null : (data?.error ?? "Something went wrong"));
    setPending(false);
  }

  const extrasSummary = [
    values.unitType !== NONE ? values.unitType : null,
    values.block ? `Block ${values.block}` : null,
    values.floor ? `Floor ${values.floor}` : null,
    values.sizeSqm ? `${values.sizeSqm} m²` : null,
    values.amenities.length > 0 ? `${values.amenities.length} amenities` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const extrasHaveError = Boolean(
    fieldErrors.unitType ||
      fieldErrors.floor ||
      fieldErrors.block ||
      fieldErrors.sizeSqm ||
      fieldErrors.amenities
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add unit" : "Edit unit"}</DialogTitle>
            <DialogDescription>
              Name, monthly rate and minimum tenure are the essentials. Everything
              else is optional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="unit-label">Unit name</FieldLabel>
                <Input
                  id="unit-label"
                  value={values.label}
                  onChange={(event) => set("label", event.target.value)}
                  placeholder="A1"
                  required
                />
                <FieldError errors={fieldErrors.label?.map((m) => ({ message: m }))} />
              </Field>

              <Field>
                <FieldLabel htmlFor="unit-rent">Monthly rate</FieldLabel>
                <Input
                  id="unit-rent"
                  type="number"
                  min={0}
                  step={1000}
                  inputMode="numeric"
                  value={values.rentAmount}
                  onChange={(event) => set("rentAmount", event.target.value)}
                  placeholder="500000"
                  required
                />
                <FieldDescription>In {CURRENCY} per month.</FieldDescription>
                <FieldError
                  errors={fieldErrors.rentAmount?.map((m) => ({ message: m }))}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="unit-tenure">Minimum tenure</FieldLabel>
              <Select
                value={values.minTenureMonths}
                onValueChange={(next) => next && set("minTenureMonths", next)}
              >
                <SelectTrigger id="unit-tenure" className="w-full">
                  <SelectValue>
                    {(selected: string) =>
                      selected === NONE
                        ? "Not set"
                        : (MIN_TENURE_OPTIONS.find(
                            (o) => String(o.value) === selected
                          )?.label ?? selected)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {MIN_TENURE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                errors={fieldErrors.minTenureMonths?.map((m) => ({ message: m }))}
              />
            </Field>

            <Accordion
              className="rounded-lg border px-4"
              defaultValue={extrasHaveError ? ["extras"] : []}
            >
              <AccordionItem value="extras">
                <AccordionTrigger>
                  <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                    Unit details &amp; amenities
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {extrasSummary || "Optional"}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pb-2">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="unit-type">Type</FieldLabel>
                        <Select
                          value={values.unitType}
                          onValueChange={(next) => next && set("unitType", next)}
                        >
                          <SelectTrigger id="unit-type" className="w-full">
                            <SelectValue>
                              {(selected: string) =>
                                selected === NONE ? "Not set" : selected
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>Not set</SelectItem>
                            {UNIT_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError
                          errors={fieldErrors.unitType?.map((m) => ({ message: m }))}
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="unit-size">Size (m²)</FieldLabel>
                        <Input
                          id="unit-size"
                          type="number"
                          min={0}
                          step="0.5"
                          inputMode="decimal"
                          value={values.sizeSqm}
                          onChange={(event) => set("sizeSqm", event.target.value)}
                          placeholder="45"
                        />
                        <FieldError
                          errors={fieldErrors.sizeSqm?.map((m) => ({ message: m }))}
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="unit-block">Block</FieldLabel>
                        <Input
                          id="unit-block"
                          value={values.block}
                          onChange={(event) => set("block", event.target.value)}
                          placeholder="A"
                        />
                        <FieldError
                          errors={fieldErrors.block?.map((m) => ({ message: m }))}
                        />
                      </Field>

                      <Field>
                        <FieldLabel htmlFor="unit-floor">Floor</FieldLabel>
                        <Input
                          id="unit-floor"
                          value={values.floor}
                          onChange={(event) => set("floor", event.target.value)}
                          placeholder="Ground"
                        />
                        <FieldError
                          errors={fieldErrors.floor?.map((m) => ({ message: m }))}
                        />
                      </Field>
                    </div>

                    <Field>
                      <FieldLabel>Unit amenities</FieldLabel>
                      <FieldDescription>
                        Specific to this unit — the building&apos;s shared facilities
                        live on the property.
                      </FieldDescription>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {UNIT_AMENITY_OPTIONS.map((amenity) => (
                          <label
                            key={amenity}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={values.amenities.includes(amenity)}
                              onCheckedChange={(checked) =>
                                toggleAmenity(amenity, checked)
                              }
                            />
                            {amenity}
                          </label>
                        ))}
                      </div>
                      <FieldError
                        errors={fieldErrors.amenities?.map((m) => ({ message: m }))}
                      />
                    </Field>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

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
              {pending ? "Saving…" : mode === "create" ? "Add unit" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
