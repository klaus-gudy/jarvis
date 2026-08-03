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

type Values = { name: string; phone: string; email: string };
type FieldErrors = Partial<Record<keyof Values, string[]>>;

export function TenantFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Values>({
    name: "",
    phone: "",
    email: "",
  });
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
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
            <DialogTitle>Add tenant</DialogTitle>
            <DialogDescription>
              Assisted onboarding — no password is set here, so this tenant
              can&apos;t sign in yet. Invite them from Users if they need access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="tenant-name">Name</FieldLabel>
              <Input
                id="tenant-name"
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="Neema Kimaro"
                required
              />
              <FieldError errors={fieldErrors.name?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="tenant-phone">Phone</FieldLabel>
              <Input
                id="tenant-phone"
                type="tel"
                value={values.phone}
                onChange={(event) => set("phone", event.target.value)}
                placeholder="+255712345678"
                required
              />
              <FieldError errors={fieldErrors.phone?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="tenant-email">Email (optional)</FieldLabel>
              <Input
                id="tenant-email"
                type="email"
                value={values.email}
                onChange={(event) => set("email", event.target.value)}
                placeholder="neema@example.com"
              />
              <FieldDescription>
                Leave blank if the tenant doesn&apos;t have one.
              </FieldDescription>
              <FieldError errors={fieldErrors.email?.map((m) => ({ message: m }))} />
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
              {pending ? "Adding…" : "Add tenant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
