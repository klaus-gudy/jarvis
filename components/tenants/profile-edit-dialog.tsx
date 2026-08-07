"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { usePhoneError } from "@/hooks/use-phone-error";
import type { MemberProfileFields } from "@/lib/tenants";

type Values = Record<keyof MemberProfileFields, string>;
type FieldErrors = Partial<Record<keyof MemberProfileFields, string[]>>;

const FIELDS: {
  key: keyof MemberProfileFields;
  label: string;
  placeholder: string;
  type?: string;
}[] = [
  { key: "occupation", label: "Occupation", placeholder: "Teacher" },
  { key: "employer", label: "Employer", placeholder: "Shule ya Msingi" },
  { key: "nidaNumber", label: "NIDA number", placeholder: "19900101-12345-00001-01" },
  {
    key: "emergencyContactName",
    label: "Emergency contact",
    placeholder: "Juma Mwinyi",
  },
  {
    key: "emergencyContactPhone",
    label: "Emergency contact phone",
    placeholder: "+255712345678",
    type: "tel",
  },
  { key: "emergencyContactRelation", label: "Relation", placeholder: "Brother" },
];

export function ProfileEditDialog({
  membershipId,
  profile,
}: {
  membershipId: string;
  profile: MemberProfileFields;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<Values>({
    occupation: profile.occupation ?? "",
    nidaNumber: profile.nidaNumber ?? "",
    employer: profile.employer ?? "",
    emergencyContactName: profile.emergencyContactName ?? "",
    emergencyContactPhone: profile.emergencyContactPhone ?? "",
    emergencyContactRelation: profile.emergencyContactRelation ?? "",
  });
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const phoneError = usePhoneError(values.emergencyContactPhone);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch(`/api/tenants/${membershipId}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (response.ok) {
      setOpen(false);
      setPending(false);
      toast.success("Details updated");
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
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PencilIcon />
        Edit details
      </Button>

      {/* Remounted per open so the form re-seeds from the saved values rather
          than resetting state inside an effect. */}
      <Dialog key={String(open)} open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit member details</DialogTitle>
              <DialogDescription>
                Every field is optional — fill in only what you have.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 sm:grid-cols-2">
              {FIELDS.map((field) => (
                <Field key={field.key}>
                  <FieldLabel htmlFor={`profile-${field.key}`}>
                    {field.label}
                  </FieldLabel>
                  <Input
                    id={`profile-${field.key}`}
                    type={field.type}
                    value={values[field.key]}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                  />
                  <FieldError
                    errors={(
                      fieldErrors[field.key] ??
                      (field.key === "emergencyContactPhone" && phoneError
                        ? [phoneError]
                        : [])
                    ).map((m) => ({ message: m }))}
                  />
                </Field>
              ))}
            </div>

            {formError && <FieldError>{formError}</FieldError>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save details"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
