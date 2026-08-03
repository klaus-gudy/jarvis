"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            This also creates your organization — you&apos;ll be its owner.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Your name</FieldLabel>
                <Input id="name" name="name" autoComplete="name" required />
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
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
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
                  Required. You can also use this instead of your email to sign in.
                </FieldDescription>
                <FieldError errors={fieldErrors.phone?.map((m) => ({ message: m }))} />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <FieldError
                  errors={fieldErrors.password?.map((m) => ({ message: m }))}
                />
              </Field>
              {formError && <FieldError>{formError}</FieldError>}
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creating account…" : "Create account"}
            </Button>
            <FieldDescription>
              Already have an account?{" "}
              <a href="/login" className="underline underline-offset-4">
                Sign in
              </a>
            </FieldDescription>
          </CardFooter>
        </form>
      </Card>
    </main>
  )
}
