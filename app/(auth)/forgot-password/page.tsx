"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { AuthHeader } from "@/components/auth/auth-header"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = React.useState("")
  const [pending, setPending] = React.useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    // TODO: POST /api/auth/forgot-password once a delivery channel (SMS or
    // email) exists to actually send the code. For now the flow moves straight
    // to the verification step so the whole journey can be exercised.
    router.push(`/verify-otp?identifier=${encodeURIComponent(identifier)}`)
  }

  return (
    <>
      <AuthHeader
        title="Forgot your password?"
        subtitle="Enter the email or phone you sign in with and we'll send you a verification code."
      />

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="identifier">Email or phone</FieldLabel>
            <Input
              id="identifier"
              autoComplete="username"
              placeholder="you@company.co.tz"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
          </Field>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending code…" : "Send verification code"}
          </Button>
        </FieldGroup>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  )
}
