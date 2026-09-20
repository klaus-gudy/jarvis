"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { CURRENCY, formatMoneyFull } from "@/lib/format";
import { UNIT_AMENITY_OPTIONS, UNIT_TYPE_OPTIONS } from "@/lib/unit-options";

export type UnitFormValues = {
  label: string;
  rentAmount: string;
  minTenureMonths: string;
  autoRenew: boolean;
  unitType: string;
  floor: string;
  block: string;
  sizeSqm: string;
  amenities: string[];
};

const NONE = "__none__";

/**
 * A new unit starts where the column defaults are — six months, renewing —
 * rather than blank and off. Renewal is the rule now, and a form that opens on
 * the exception makes every unit an explicit decision nobody meant to take.
 */
const EMPTY: UnitFormValues = {
  label: "",
  rentAmount: "",
  minTenureMonths: "6",
  autoRenew: true,
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
  const [amenityDraft, setAmenityDraft] = React.useState("");

  function set<K extends keyof UnitFormValues>(key: K, value: UnitFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  /**
   * Clearing the tenure has to clear auto-renew with it: the renewal job takes
   * its term from `minTenureMonths`, so a unit saved with auto-renew on and no
   * tenure would silently never renew.
   */
  function setMinTenure(value: string) {
    setValues((current) => ({
      ...current,
      minTenureMonths: value,
      autoRenew: value.trim() ? current.autoRenew : false,
    }));
  }

  const hasMinTenure = values.minTenureMonths.trim() !== "";

  function toggleAmenity(amenity: string, checked: boolean) {
    setValues((current) => ({
      ...current,
      amenities: checked
        ? [...current.amenities, amenity]
        : current.amenities.filter((item) => item !== amenity),
    }));
  }

  /** Anything on this unit that isn't one of the standard checkboxes. */
  const customAmenities = values.amenities.filter(
    (amenity) =>
      !UNIT_AMENITY_OPTIONS.some(
        (option) => option.toLowerCase() === amenity.toLowerCase()
      )
  );

  function addAmenity() {
    const value = amenityDraft.trim();
    if (!value) return;

    // Typing the name of a standard amenity should tick its box rather than
    // add a second, near-identical chip beside it.
    const standard = UNIT_AMENITY_OPTIONS.find(
      (option) => option.toLowerCase() === value.toLowerCase()
    );
    const already = values.amenities.some(
      (item) => item.toLowerCase() === value.toLowerCase()
    );

    if (!already) toggleAmenity(standard ?? value, true);
    setAmenityDraft("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const payload = {
      label: values.label,
      rentAmount: Number(values.rentAmount),
      minTenureMonths: values.minTenureMonths.trim()
        ? Number(values.minTenureMonths)
        : null,
      autoRenew: values.autoRenew,
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
      toast.success(mode === "create" ? "Unit added" : "Unit updated");
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

  const extrasSummary = [
    values.unitType !== NONE ? values.unitType : null,
    values.block ? `Block ${values.block}` : null,
    values.floor ? `Floor ${values.floor}` : null,
    values.sizeSqm ? `${values.sizeSqm} m²` : null,
    values.minTenureMonths ? `min ${values.minTenureMonths} mo` : null,
    values.autoRenew ? "Auto-renews" : null,
    values.amenities.length > 0
      ? `${values.amenities.length} ${values.amenities.length === 1 ? "amenity" : "amenities"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const extrasHaveError = Boolean(
    fieldErrors.unitType ||
      fieldErrors.floor ||
      fieldErrors.block ||
      fieldErrors.sizeSqm ||
      fieldErrors.minTenureMonths ||
      fieldErrors.amenities
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add unit" : "Edit unit"}</DialogTitle>
            <DialogDescription>
              Name and monthly rate are the essentials. Everything else is
              optional.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="unit-label" required>Unit name</FieldLabel>
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
                <FieldLabel htmlFor="unit-rent" required>Monthly rate ({CURRENCY})</FieldLabel>
                <Input
                  id="unit-rent"
                  type="text"
                  inputMode="numeric"
                  value={
                    values.rentAmount
                      ? formatMoneyFull(Number(values.rentAmount))
                      : ""
                  }
                  onChange={(event) =>
                    set("rentAmount", event.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="500,000"
                  required
                />
                <FieldError
                  errors={fieldErrors.rentAmount?.map((m) => ({ message: m }))}
                />
              </Field>
            </div>

            {/* Type sits with the essentials rather than under "Other details" —
                it's the field people reach for straight after name and rate. */}
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

            <Accordion
              className="rounded-lg border px-4"
              defaultValue={extrasHaveError ? ["extras"] : []}
            >
              <AccordionItem value="extras">
                <AccordionTrigger>
                  <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                    Other unit details
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {extrasSummary || "Optional"}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 px-1 pt-1 pb-2">
                    <div className="grid gap-4 sm:grid-cols-2">
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
                        <FieldLabel htmlFor="unit-tenure">
                          Minimum tenure
                          <span className="font-normal text-muted-foreground">
                            In months.
                          </span>
                        </FieldLabel>
                        <Input
                          id="unit-tenure"
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={values.minTenureMonths}
                          onChange={(event) =>
                            setMinTenure(event.target.value)
                          }
                          placeholder="6"
                        />
                        <FieldError
                          errors={fieldErrors.minTenureMonths?.map((m) => ({
                            message: m,
                          }))}
                        />
                      </Field>

                      {/* Renewal length comes from the minimum tenure, so there
                          is nothing to renew for without one. */}
                      <Field orientation="horizontal" className="sm:col-span-2">
                        <Switch
                          id="unit-auto-renew"
                          checked={values.autoRenew}
                          onCheckedChange={(checked) => set("autoRenew", checked)}
                          disabled={!hasMinTenure}
                        />
                        <FieldLabel
                          htmlFor="unit-auto-renew"
                          className="font-normal"
                        >
                          Auto-renew leases on this unit
                        </FieldLabel>
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
                              checked={values.amenities.some(
                                (item) =>
                                  item.toLowerCase() === amenity.toLowerCase()
                              )}
                              onCheckedChange={(checked) =>
                                toggleAmenity(amenity, checked)
                              }
                            />
                            {amenity}
                          </label>
                        ))}
                      </div>

                      {customAmenities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {customAmenities.map((amenity) => (
                            <span
                              key={amenity}
                              className="inline-flex items-center gap-1 rounded-full border bg-muted/60 py-0.5 pr-1 pl-2.5 text-xs"
                            >
                              {amenity}
                              <button
                                type="button"
                                onClick={() => toggleAmenity(amenity, false)}
                                aria-label={`Remove ${amenity}`}
                                className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                              >
                                <XIcon className="size-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <Input
                          value={amenityDraft}
                          onChange={(event) => setAmenityDraft(event.target.value)}
                          // Enter inside a form submits it — here it should only
                          // ever commit the chip being typed.
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              addAmenity();
                            }
                          }}
                          placeholder="Add another amenity"
                          maxLength={40}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addAmenity}
                          disabled={!amenityDraft.trim()}
                        >
                          <PlusIcon />
                          Add
                        </Button>
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
