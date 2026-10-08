"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { AuthHeader } from "@/components/auth/auth-header"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = React.useState("")
  const [pending, setPending] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    })

    if (response.ok) {
      // The endpoint answers the same way whether or not the account exists,
      // so this step always advances — anything else would tell a stranger
      // which addresses are registered here.
      router.push(`/verify-otp?identifier=${encodeURIComponent(identifier)}`)
      return
    }

    const data = await response.json().catch(() => null)
    toast.error(data?.error ?? "Something went wrong")
    setPending(false)
  }

  return (
    <>
      <AuthHeader
        title="Forgot your password?"
        subtitle="Enter the email or phone you sign in with. We'll email a verification code to the address on your account."
      />

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="identifier" required>Email or phone</FieldLabel>
            <Input
              id="identifier"
              autoComplete="username"
              placeholder="you@company.co.tz"
              className="bg-card"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
          </Field>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending code…" : "Send verification code"}
          </Button>

          {/* Codes only ever go by email, and the response never says whether
              an account exists — so a phone-only tenant is told up front. */}
          <p className="text-sm text-muted-foreground">
            No email on your account? Ask your landlord to add one, then come back here.
          </p>
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
