"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

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
import type { LeaseOptions } from "@/lib/leases";

type Values = {
  unitId: string;
  membershipId: string;
  startDate: string;
  endDate: string;
};
type FieldErrors = Partial<Record<keyof Values, string[]>>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
  const [values, setValues] = React.useState<Values>({
    unitId: options.units[0]?.id ?? "",
    membershipId: options.tenants[0]?.membershipId ?? "",
    startDate: todayIso(),
    endDate: "",
  });
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const canSubmit = values.unitId !== "" && values.membershipId !== "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch("/api/leases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId: values.unitId,
        membershipId: values.membershipId,
        startDate: values.startDate,
        endDate: values.endDate || undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create lease</DialogTitle>
            <DialogDescription>
              Connects a vacant unit to a tenant for a period of time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="lease-unit">Unit</FieldLabel>
              {options.units.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No vacant units available. Add a property/unit, or wait for one
                  to free up.
                </p>
              ) : (
                <Select
                  value={values.unitId}
                  onValueChange={(next) => next && set("unitId", next)}
                >
                  <SelectTrigger id="lease-unit" className="w-full">
                    <SelectValue>
                      {(selected: string) => {
                        const unit = options.units.find((u) => u.id === selected);
                        return unit ? `${unit.label} — ${unit.propertyName}` : "Select a unit";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {options.units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.label} — {unit.propertyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FieldError errors={fieldErrors.unitId?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="lease-tenant">Tenant</FieldLabel>
              {options.tenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tenants yet. Add one from the Tenants page first.
                </p>
              ) : (
                <Select
                  value={values.membershipId}
                  onValueChange={(next) => next && set("membershipId", next)}
                >
                  <SelectTrigger id="lease-tenant" className="w-full">
                    <SelectValue>
                      {(selected: string) =>
                        options.tenants.find((t) => t.membershipId === selected)?.name ??
                        "Select a tenant"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {options.tenants.map((tenant) => (
                      <SelectItem key={tenant.membershipId} value={tenant.membershipId}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  value={values.startDate}
                  onChange={(event) => set("startDate", event.target.value)}
                  required
                />
                <FieldError
                  errors={fieldErrors.startDate?.map((m) => ({ message: m }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="lease-end">End date</FieldLabel>
                <Input
                  id="lease-end"
                  type="date"
                  value={values.endDate}
                  onChange={(event) => set("endDate", event.target.value)}
                />
                <FieldDescription>Leave blank for open-ended.</FieldDescription>
                <FieldError
                  errors={fieldErrors.endDate?.map((m) => ({ message: m }))}
                />
              </Field>
            </div>

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
