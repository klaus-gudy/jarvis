"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSet,
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

export function PropertyForm({
  mode,
  propertyId,
  initialValues,
  ownerName,
}: {
  mode: "create" | "edit";
  propertyId?: string;
  initialValues?: PropertyFormValues;
  ownerName: string;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<PropertyFormValues>(
    initialValues ?? EMPTY
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
      mode === "create" ? "/api/properties" : `/api/properties/${propertyId}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          description: values.description.trim() || undefined,
        }),
      }
    );

    if (response.ok) {
      const data = await response.json().catch(() => null);
      const id = data?.property?.id ?? propertyId;
      toast.success(mode === "create" ? "Property created" : "Property updated");
      router.push(id ? `/properties/${id}` : "/properties");
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

  const statusLabel =
    PROPERTY_STATUS_OPTIONS.find((option) => option.value === values.status)?.label ??
    values.status;

  // Surfaced on the collapsed triggers so hidden fields still show what's set.
  const contentSummary = [
    values.description.trim() ? "Description added" : null,
    values.amenities.length > 0
      ? `${values.amenities.length} ${values.amenities.length === 1 ? "amenity" : "amenities"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Errors on collapsed fields would otherwise be invisible.
  const optionalHasError = Boolean(
    fieldErrors.status || fieldErrors.description || fieldErrors.amenities
  );

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            {mode === "create" ? "New property" : "Edit property"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-8 pt-6">
          <FieldSet>
            {/* <FieldLegend variant="label">Basics</FieldLegend> */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="name" required>Name</FieldLabel>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(event) => set("name", event.target.value)}
                  placeholder="Mwenge Apartments"
                  required
                />
                <FieldError errors={fieldErrors.name?.map((m) => ({ message: m }))} />
              </Field>

              <Field>
                <FieldLabel htmlFor="address" required>Location</FieldLabel>
                <Input
                  id="address"
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
          </FieldSet>

          <FieldSet>
            {/* <FieldLegend variant="label">Classification</FieldLegend> */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="category">Property type</FieldLabel>
                <Select
                  value={values.category}
                  onValueChange={(next) => next && set("category", next)}
                >
                  <SelectTrigger id="category" className="w-full">
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
                <FieldLabel htmlFor="type">Category</FieldLabel>
                <Select
                  value={values.type}
                  onValueChange={(next) => next && set("type", next)}
                >
                  <SelectTrigger id="type" className="w-full">
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
          </FieldSet>

          <Accordion
            className="rounded-lg border px-4"
            // Expand automatically when a hidden field is wrong, so a validation
            // error can never be reported behind a closed panel.
            defaultValue={optionalHasError ? ["status", "content"] : []}
          >
            <AccordionItem value="status">
              <AccordionTrigger>
                <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                  Status &amp; ownership
                  <span className="text-xs font-normal text-muted-foreground">
                    {statusLabel} · {ownerName}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 pb-2 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <Select
                      value={values.status}
                      onValueChange={(next) => next && set("status", next)}
                    >
                      <SelectTrigger id="status" className="w-full">
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
                    <FieldLabel htmlFor="ownership">Ownership</FieldLabel>
                    <Input id="ownership" value={ownerName} readOnly disabled />
                    <FieldDescription>
                      Taken from your organization&apos;s owner.
                    </FieldDescription>
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="content">
              <AccordionTrigger>
                <span className="flex flex-1 items-center justify-between gap-3 pr-2">
                  Description &amp; amenities
                  <span className="text-xs font-normal text-muted-foreground">
                    {contentSummary || "Optional"}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pb-2">
                  <Field>
                    <FieldLabel htmlFor="description">Description</FieldLabel>
                    <Textarea
                      id="description"
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

          <div className="flex gap-2 border-t pt-6">
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : mode === "create"
                  ? "Create property"
                  : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  href={
                    mode === "edit" && propertyId
                      ? `/properties/${propertyId}`
                      : "/properties"
                  }
                />
              }
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
