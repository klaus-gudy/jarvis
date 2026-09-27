"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  BriefcaseIcon,
  Building2Icon,
  ContactIcon,
  FlagIcon,
  HeartHandshakeIcon,
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

/** Everything `PATCH /api/portal/profile` takes — and it takes all of it. */
export type TenantEditable = {
  name: string | null
  occupation: string | null
  employer: string | null
  nationality: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
}

type Key = keyof TenantEditable
type FieldSpec = {
  key: Key
  label: string
  placeholder: string
  type?: string
  required?: boolean
  /** Spans both columns of the dialog grid. */
  wide?: boolean
}

const PERSONAL_FIELDS: FieldSpec[] = [
  { key: "name", label: "Full name", placeholder: "Amina Juma", required: true, wide: true },
  { key: "occupation", label: "Occupation", placeholder: "Teacher" },
  { key: "employer", label: "Employer", placeholder: "Shule ya Msingi" },
  { key: "nationality", label: "Nationality", placeholder: "Tanzanian", wide: true },
]

const EMERGENCY_FIELDS: FieldSpec[] = [
  { key: "emergencyContactName", label: "Name", placeholder: "Juma Mwinyi", wide: true },
  {
    key: "emergencyContactPhone",
    label: "Phone",
    placeholder: "+255712345678",
    type: "tel",
  },
  { key: "emergencyContactRelation", label: "Relation", placeholder: "Brother" },
]

/**
 * The tenant's own details. Name and the descriptive fields are theirs to edit
 * (`PATCH /api/portal/profile`); phone, email and NIDA are shown but changed by
 * the landlord — the first two are how they sign in.
 */
export function TenantProfileCard({
  details,
  phone,
  email,
  nidaNumber,
}: {
  details: TenantEditable
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
          </dl>
          <p className="text-sm text-muted-foreground">
            To change your phone number, email or NIDA number, ask your landlord.
          </p>
        </CardContent>
      </Card>

      {/* Mounted per open so the form re-seeds from the saved values. */}
      {editing && (
        <EditDialog
          title="Edit your details"
          description="Your landlord sees these. Only your name is required."
          fields={PERSONAL_FIELDS}
          details={details}
          onOpenChange={setEditing}
        />
      )}
    </>
  )
}

/**
 * Who to call if something happens to the tenant. Its own card because it is
 * the one thing a landlord reaches for in a hurry — and the one a tenant is
 * most often missing, which the empty state says plainly.
 */
export function EmergencyContactCard({ details }: { details: TenantEditable }) {
  const [editing, setEditing] = React.useState(false)
  const missing = !details.emergencyContactName && !details.emergencyContactPhone

  return (
    <>
      <Card>
        <ProfileCardHeader
          title="Emergency contact"
          icon={HeartHandshakeIcon}
          action={
            <Button size="sm" variant={missing ? "default" : "outline"} onClick={() => setEditing(true)}>
              <PencilIcon />
              {missing ? "Add contact" : "Edit contact"}
            </Button>
          }
        />
        <CardContent className="space-y-4">
          {missing ? (
            <p className="text-sm text-muted-foreground">
              No emergency contact yet. Add someone your landlord can reach if something
              happens to you.
            </p>
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <ProfileField
                label="Name"
                value={details.emergencyContactName}
                icon={ContactIcon}
                className="sm:col-span-2"
              />
              <ProfileField
                label="Phone"
                value={details.emergencyContactPhone}
                icon={PhoneCallIcon}
              />
              <ProfileField
                label="Relation"
                value={details.emergencyContactRelation}
                icon={UsersIcon}
              />
            </dl>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditDialog
          title={missing ? "Add emergency contact" : "Edit emergency contact"}
          description="Someone your landlord can call if they can't reach you."
          fields={EMERGENCY_FIELDS}
          details={details}
          onOpenChange={setEditing}
        />
      )}
    </>
  )
}

/**
 * Edits a subset of the tenant's fields. The endpoint replaces the whole set
 * (a missing field is stored as cleared), so the fields not on this form are
 * sent back unchanged from `details`.
 */
function EditDialog({
  title,
  description,
  fields,
  details,
  onOpenChange,
}: {
  title: string
  description: string
  fields: FieldSpec[]
  details: TenantEditable
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [values, setValues] = React.useState<Record<Key, string>>(() => ({
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
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<Key, string[]>>>({})
  const phoneError = usePhoneError(values.emergencyContactPhone)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setFormError(null)
    setFieldErrors({})

    const response = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (response.ok) {
      onOpenChange(false)
      toast.success("Saved")
      router.refresh()
      return
    }

    const data = await response.json().catch(() => null)
    const issues: Partial<Record<Key, string[]>> = data?.issues ?? {}
    setFieldErrors(issues)
    // An error on a field this form doesn't show would otherwise vanish.
    const hidden = Object.keys(issues).some((key) => !fields.some((f) => f.key === key))
    const message =
      data?.issues && !hidden ? null : (data?.error ?? "Something went wrong")
    setFormError(message)
    if (message) toast.error(message)
    setPending(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {fields.map((field, index) => (
              <Field key={field.key} className={field.wide ? "sm:col-span-2" : undefined}>
                <FieldLabel htmlFor={`portal-profile-${field.key}`} required={field.required}>
                  {field.label}
                </FieldLabel>
                <Input
                  id={`portal-profile-${field.key}`}
                  type={field.type}
                  value={values[field.key]}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  placeholder={field.placeholder}
                  required={field.required}
                  autoFocus={index === 0}
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
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
