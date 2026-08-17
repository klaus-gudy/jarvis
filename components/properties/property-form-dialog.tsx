"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import {
  AMENITY_OPTIONS,
  CATEGORY_OPTIONS,
  PROPERTY_STATUS_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from "@/lib/property-options";

export type PropertyFormValues = {
  name: string;
  type: string;
  category: string;
  address: string;
  status: string;
  description: string;
  amenities: string[];
};

type FieldErrors = Partial<Record<keyof PropertyFormValues, string[]>>;

const EMPTY: PropertyFormValues = {
  name: "",
  type: "RESIDENTIAL",
  category: CATEGORY_OPTIONS[0],
  address: "",
  status: "ACTIVE",
  description: "",
  amenities: [],
};

export function PropertyFormDialog({
  open,
  onOpenChange,
  ownerName,
  property,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerName: string;
  /** Supplied to correct an existing property instead of creating a new one. */
  property?: { id: string } & PropertyFormValues;
}) {
  const router = useRouter();
  const editing = property !== undefined;
  const [values, setValues] = React.useState<PropertyFormValues>(
    property ?? EMPTY
  );
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function set<K extends keyof PropertyFormValues>(
    key: K,
    value: PropertyFormValues[K]
  ) {
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

    const response = await fetch(
      editing ? `/api/properties/${property.id}` : "/api/properties",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          description: values.description.trim() || undefined,
        }),
      }
    );

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      toast.success(editing ? "Property updated" : "Property created");
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
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        {/* Keyed by the caller on the property id, so reopening on a different
            row re-seeds `values` from that row's own data instead of the
            previous one — the pattern every other form dialog here uses. */}
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit property" : "New property"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this property's details."
                : "Add a building to start tracking its units and leases."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="property-name" required>
                  Name
                </FieldLabel>
                <Input
                  id="property-name"
                  value={values.name}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="Mwenge Apartments"
                  required
                  autoFocus
                />
                <FieldError errors={fieldErrors.name?.map((m) => ({ message: m }))} />
              </Field>

              <Field>
                <FieldLabel htmlFor="property-address" required>
                  Location
                </FieldLabel>
                <Input
                  id="property-address"
                  value={values.address}
                  onChange={(event) => set("address", event.target.value)}
                  placeholder="Kinondoni, Dar es Salaam"
                  required
                />
                <FieldError
                  errors={fieldErrors.address?.map((m) => ({ message: m }))}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="property-category">Property type</FieldLabel>
                <Select
                  value={values.category}
                  onValueChange={(next) => next && set("category", next)}
                >
                  <SelectTrigger id="property-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError
                  errors={fieldErrors.category?.map((m) => ({ message: m }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="property-type">Category</FieldLabel>
                <Select
                  value={values.type}
                  onValueChange={(next) => next && set("type", next)}
                >
                  <SelectTrigger id="property-type" className="w-full">
                    <SelectValue>
                      {(selected: string) =>
                        PROPERTY_TYPE_OPTIONS.find((o) => o.value === selected)
                          ?.label ?? selected
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={fieldErrors.type?.map((m) => ({ message: m }))} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="property-status">Status</FieldLabel>
                <Select
                  value={values.status}
                  onValueChange={(next) => next && set("status", next)}
                >
                  <SelectTrigger id="property-status" className="w-full">
                    <SelectValue>
                      {(selected: string) =>
                        PROPERTY_STATUS_OPTIONS.find((o) => o.value === selected)
                          ?.label ?? selected
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError
                  errors={fieldErrors.status?.map((m) => ({ message: m }))}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="property-owner">Ownership</FieldLabel>
                <Input id="property-owner" value={ownerName} readOnly disabled />
                <FieldDescription>
                  Taken from your organization&apos;s owner.
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="property-description">Description</FieldLabel>
              <Textarea
                id="property-description"
                value={values.description}
                onChange={(event) => set("description", event.target.value)}
                rows={3}
                placeholder="Secure, serviced units with reliable water and backup power."
              />
              <FieldError
                errors={fieldErrors.description?.map((m) => ({ message: m }))}
              />
            </Field>

            <Field>
              <FieldLabel>General facility amenities</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-2">
                {AMENITY_OPTIONS.map((amenity) => (
                  <label
                    key={amenity}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={values.amenities.includes(amenity)}
                      onCheckedChange={(checked) => toggleAmenity(amenity, checked)}
                    />
                    {amenity}
                  </label>
                ))}
              </div>
              <FieldError
                errors={fieldErrors.amenities?.map((m) => ({ message: m }))}
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
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
