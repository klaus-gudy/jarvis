"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, CheckIcon, XIcon } from "lucide-react"

import { AuthHeader } from "@/components/auth/auth-header"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "password" | "organizationName", string[]>
>

/** Long enough to swallow a typing burst, short enough to feel immediate — same value the global search box uses. */
const DEBOUNCE_MS = 300

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = React.useState<1 | 2>(1)

  const [organizationName, setOrganizationName] = React.useState("")
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [password, setPassword] = React.useState("")

  const [pending, setPending] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})

  /**
   * Availability is stored with the name it answers, not as a bare boolean —
   * the same "answered vs. live query" shape `GlobalSearch` uses. It keeps
   * setState out of the effect body (only the debounced callback sets it) and
   * makes it impossible for an in-flight check for "Acm" to resolve after the
   * user has typed "Acme" and paint a stale result under the new text.
   */
  const [checked, setChecked] = React.useState<{
    name: string
    available: boolean
  } | null>(null)

  const trimmedOrgName = organizationName.trim()
  const hasName = trimmedOrgName.length > 0
  const checking = hasName && checked?.name !== trimmedOrgName
  const isAvailable = checked?.name === trimmedOrgName && checked.available
  const isTaken = checked?.name === trimmedOrgName && !checked.available

  // Debounced availability check. The AbortController matters as much as the
  // timer: without it, a slow early request could resolve after a later one
  // and paint a stale answer over a fresh one.
  React.useEffect(() => {
    if (!hasName) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/organizations/check-name?name=${encodeURIComponent(trimmedOrgName)}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error("check failed")
        const data = await response.json()
        setChecked({ name: trimmedOrgName, available: Boolean(data.available) })
      } catch (error) {
        // An abort means a newer name superseded this one — leave `checked`
        // alone so the "checking…" state stays up for that newer request.
        if ((error as Error).name !== "AbortError") {
          // A network hiccup shouldn't trap someone on step one — the register
          // endpoint re-checks for real before anything is created, so this
          // failure mode is a courtesy lost, not a guarantee lost.
          setChecked({ name: trimmedOrgName, available: true })
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [hasName, trimmedOrgName])

  function handleContinue(event: React.FormEvent) {
    event.preventDefault()
    // Belt-and-suspenders: the button is already disabled until this is true,
    // but Enter inside the field also targets this handler.
    if (!isAvailable) return
    setStep(2)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setFormError(null)
    setFieldErrors({})

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, organizationName, email, phone, password }),
    })

    if (response.ok) {
      router.push("/")
      router.refresh()
      return
    }

    const data = await response.json().catch(() => null)
    setFieldErrors(data?.issues ?? {})
    setFormError(data?.issues ? null : (data?.error ?? "Something went wrong"))
    setPending(false)

    // The org name field only lives on step one — if the server rejected it
    // (someone else took the name in the few seconds since the live check),
    // the error has to send the user back to where that field actually is.
    if (data?.issues?.organizationName) {
      setChecked({ name: trimmedOrgName, available: false })
      setStep(1)
    }
  }

  return (
    <>
      <AuthHeader
        title="Create your account"
        subtitle="This also creates your organization — you'll be its owner."
      />

      {step === 1 ? (
        <form onSubmit={handleContinue}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="organizationName">Organization name</FieldLabel>
              <Input
                id="organizationName"
                name="organizationName"
                placeholder="Acme Property Group"
                className="bg-card"
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                autoFocus
                required
                maxLength={100}
              />
              {/* Resolves well before Continue is ever pressable — the button
                  stays disabled until it does, so there's nothing left to
                  check by the time it's clicked. */}
              {hasName && (
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    checking && "text-muted-foreground",
                    isAvailable && "text-emerald-600 dark:text-emerald-400",
                    isTaken && "text-destructive"
                  )}
                >
                  {checking && "Checking availability…"}
                  {isAvailable && (
                    <>
                      <CheckIcon className="size-3.5" aria-hidden /> Available
                    </>
                  )}
                  {isTaken && (
                    <>
                      <XIcon className="size-3.5" aria-hidden /> Already taken
                      — try another name
                    </>
                  )}
                </p>
              )}
              <FieldError
                errors={fieldErrors.organizationName?.map((m) => ({ message: m }))}
              />
            </Field>

            {formError && <FieldError>{formError}</FieldError>}

            <Button type="submit" className="w-full" disabled={!isAvailable}>
              Continue
            </Button>
          </FieldGroup>
        </form>
      ) : (
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="-mt-1 flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden />
              {organizationName}
            </button>

            <Field>
              <FieldLabel htmlFor="name">Your name</FieldLabel>
              <Input
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Neema Kimaro"
                className="bg-card"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
                required
              />
              <FieldError errors={fieldErrors.name?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.co.tz"
                className="bg-card"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <FieldError errors={fieldErrors.email?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="phone">Phone</FieldLabel>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+255700000000"
                className="bg-card"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
              <FieldDescription>
                You can sign in with this instead of your email.
              </FieldDescription>
              <FieldError errors={fieldErrors.phone?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                className="bg-card"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
              <FieldDescription>At least 8 characters.</FieldDescription>
              <FieldError
                errors={fieldErrors.password?.map((m) => ({ message: m }))}
              />
            </Field>

            {formError && <FieldError>{formError}</FieldError>}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>
          </FieldGroup>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
