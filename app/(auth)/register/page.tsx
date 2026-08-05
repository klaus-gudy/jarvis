"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "password" | "organizationName", string[]>
>

export default function RegisterPage() {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({})

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setFormError(null)
    setFieldErrors({})

    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        organizationName: form.get("organizationName"),
        email: form.get("email"),
        phone: form.get("phone"),
        password: form.get("password"),
      }),
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
  }

  return (
    <>
      <AuthHeader
        title="Create your account"
        subtitle="This also creates your organization — you'll be its owner."
      />

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">Your name</FieldLabel>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Neema Kimaro"
              required
            />
            <FieldError errors={fieldErrors.name?.map((m) => ({ message: m }))} />
          </Field>

          <Field>
            <FieldLabel htmlFor="organizationName">Organization name</FieldLabel>
            <Input
              id="organizationName"
              name="organizationName"
              placeholder="Acme Property Group"
              required
            />
            <FieldError
              errors={fieldErrors.organizationName?.map((m) => ({ message: m }))}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="email">Email address</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.co.tz"
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
