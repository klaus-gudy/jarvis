"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  BriefcaseIcon,
  Building2Icon,
  ContactIcon,
  FlagIcon,
  IdCardIcon,
  MailIcon,
  PencilIcon,
  PhoneCallIcon,
  PhoneIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

import { ProfileCardHeader } from "@/components/profile/profile-card-header"
import { ProfileField } from "@/components/profile/profile-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { usePhoneError } from "@/hooks/use-phone-error"

type Editable = {
  name: string | null
  occupation: string | null
  employer: string | null
  nationality: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
}

type Values = Record<keyof Editable, string>
type FieldErrors = Partial<Record<keyof Editable, string[]>>

const FIELDS: { key: keyof Editable; label: string; placeholder: string; type?: string }[] = [
  { key: "occupation", label: "Occupation", placeholder: "Teacher" },
  { key: "employer", label: "Employer", placeholder: "Shule ya Msingi" },
  { key: "nationality", label: "Nationality", placeholder: "Tanzanian" },
  { key: "emergencyContactName", label: "Emergency contact", placeholder: "Juma Mwinyi" },
  {
    key: "emergencyContactPhone",
    label: "Emergency contact phone",
    placeholder: "+255712345678",
    type: "tel",
  },
  { key: "emergencyContactRelation", label: "Relation", placeholder: "Brother" },
]

/**
 * The tenant's own details. Name and the descriptive profile fields are theirs
 * to edit (`PATCH /api/portal/profile`); phone, email and NIDA are shown but
 * changed by the landlord — the first two are how they sign in.
 */
export function TenantProfileCard({
  details,
  phone,
  email,
  nidaNumber,
}: {
  details: Editable
  phone: string | null
  email: string | null
  nidaNumber: string | null
}) {
  const [editing, setEditing] = React.useState(false)

  return (
    <>
      <Card>
        <ProfileCardHeader
          title="Personal information"
          action={
            <Button size="sm" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit details
            </Button>
          }
        />
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <ProfileField label="Full name" value={details.name} icon={UserRoundIcon} />
            <ProfileField label="Phone number" value={phone} icon={PhoneIcon} />
            <ProfileField label="Email address" value={email} icon={MailIcon} />
            <ProfileField label="NIDA number" value={nidaNumber} icon={IdCardIcon} />
            <ProfileField label="Occupation" value={details.occupation} icon={BriefcaseIcon} />
            <ProfileField label="Employer" value={details.employer} icon={Building2Icon} />
            <ProfileField label="Nationality" value={details.nationality} icon={FlagIcon} />
            <ProfileField
              label="Emergency contact"
              value={details.emergencyContactName}
              icon={ContactIcon}
            />
            <ProfileField
              label="Emergency contact phone"
              value={details.emergencyContactPhone}
              icon={PhoneCallIcon}
            />
            <ProfileField
              label="Relation"
              value={details.emergencyContactRelation}
              icon={UsersIcon}
            />
          </dl>
          <p className="text-sm text-muted-foreground">
            To change your phone number, email or NIDA number, ask your landlord.
          </p>
        </CardContent>
      </Card>

      {/* Mounted per open so the form re-seeds from the saved values. */}
      {editing && <EditDialog details={details} onOpenChange={setEditing} />}
    </>
  )
}

function EditDialog({
  details,
  onOpenChange,
}: {
  details: Editable
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [values, setValues] = React.useState<Values>(() => ({
    name: details.name ?? "",
    occupation: details.occupation ?? "",
    employer: details.employer ?? "",
    nationality: details.nationality ?? "",
    emergencyContactName: details.emergencyContactName ?? "",
    emergencyContactPhone: details.emergencyContactPhone ?? "",
    emergencyContactRelation: details.emergencyContactRelation ?? "",
  }))
  const [pending, setPending] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})
  const phoneError = usePhoneError(values.emergencyContactPhone)

  function set(key: keyof Editable, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setFormError(null)
    setFieldErrors({})

    // Every field is sent: a missing one would be stored as cleared.
    const response = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (response.ok) {
      onOpenChange(false)
      toast.success("Details updated")
      router.refresh()
      return
    }

    const data = await response.json().catch(() => null)
    setFieldErrors(data?.issues ?? {})
    const message = data?.issues ? null : (data?.error ?? "Something went wrong")
    setFormError(message)
    if (message) toast.error(message)
    setPending(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit your details</DialogTitle>
            <DialogDescription>
              Your landlord sees these. Only your name is required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="portal-profile-name" required>
                Full name
              </FieldLabel>
              <Input
                id="portal-profile-name"
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
                autoFocus
                required
              />
              <FieldError errors={fieldErrors.name?.map((m) => ({ message: m }))} />
            </Field>

            {FIELDS.map((field) => (
              <Field key={field.key}>
                <FieldLabel htmlFor={`portal-profile-${field.key}`}>{field.label}</FieldLabel>
                <Input
                  id={`portal-profile-${field.key}`}
                  type={field.type}
                  value={values[field.key]}
                  onChange={(event) => set(field.key, event.target.value)}
                  placeholder={field.placeholder}
                />
                <FieldError
                  errors={(
                    fieldErrors[field.key] ??
                    (field.key === "emergencyContactPhone" && phoneError ? [phoneError] : [])
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
              onClick={() => onOpenChange(false)}
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
  )
}
