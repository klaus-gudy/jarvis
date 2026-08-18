"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { usePhoneError } from "@/hooks/use-phone-error";

type Values = { name: string; phone: string; email: string };
type FieldErrors = Partial<Record<keyof Values, string[]>>;

/**
 * Edits your own name, phone and email.
 *
 * Posts to `PATCH /api/members/[membershipId]` rather than a new self-service
 * endpoint: it already updates exactly these three fields on the underlying
 * User, with the same validation and the same org scope, and a second endpoint
 * would be a copy that could drift. Phone stays mandatory there, so an edit
 * can't strip it.
 */
export function EditProfileDialog({
  open,
  onOpenChange,
  membershipId,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: string;
  initial: { name: string | null; phone: string | null; email: string | null };
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Values>({
    name: initial.name ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
  });
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const phoneError = usePhoneError(values.phone);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch(`/api/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      toast.success("Profile updated");
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              These details are how you appear across the organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="profile-name" required>
                Full name
              </FieldLabel>
              <Input
                id="profile-name"
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
                autoFocus
                required
              />
              <FieldError
                errors={fieldErrors.name?.map((m) => ({ message: m }))}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-phone" required>
                Phone
              </FieldLabel>
              <Input
                id="profile-phone"
                type="tel"
                value={values.phone}
                onChange={(event) => set("phone", event.target.value)}
                placeholder="+255712345678"
                required
              />
              <FieldError
                errors={(fieldErrors.phone ?? (phoneError ? [phoneError] : [])).map(
                  (m) => ({ message: m })
                )}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="profile-email">Email</FieldLabel>
              <Input
                id="profile-email"
                type="email"
                value={values.email}
                onChange={(event) => set("email", event.target.value)}
                placeholder="you@example.com"
              />
              <FieldDescription>Leave blank to remove it.</FieldDescription>
              <FieldError
                errors={fieldErrors.email?.map((m) => ({ message: m }))}
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
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
