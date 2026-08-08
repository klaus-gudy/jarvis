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

export type EditableMember = {
  membershipId: string;
  rawName: string | null;
  phone: string | null;
  email: string | null;
};

type Values = { name: string; phone: string; email: string };
type FieldErrors = Partial<Record<keyof Values, string[]>>;

/** Shared by the Users and Tenants pages — both edit the same underlying user. */
export function MemberEditDialog({
  member,
  onOpenChange,
}: {
  member: EditableMember | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<Values>({
    // rawName, not the display fallback, so saving can't overwrite a blank
    // name with the email that was being shown in its place.
    name: member?.rawName ?? "",
    phone: member?.phone ?? "",
    email: member?.email ?? "",
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
    if (!member) return;

    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch(`/api/members/${member.membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      toast.success(`${values.name || "Member"} updated`);
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
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
            <DialogDescription>
              Updates their details across the organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="member-name" required>Name</FieldLabel>
              <Input
                id="member-name"
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
                required
              />
              <FieldError errors={fieldErrors.name?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="member-phone" required>Phone</FieldLabel>
              <Input
                id="member-phone"
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
              <FieldLabel htmlFor="member-email">Email</FieldLabel>
              <Input
                id="member-email"
                type="email"
                value={values.email}
                onChange={(event) => set("email", event.target.value)}
                placeholder="neema@example.com"
              />
              <FieldDescription>Leave blank to remove it.</FieldDescription>
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
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
