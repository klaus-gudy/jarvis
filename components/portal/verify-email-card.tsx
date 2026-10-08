"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { MailCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FieldError } from "@/components/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

const OTP_LENGTH = 6

/**
 * Opt-in proof of the tenant's email. Nothing is gated on it — it is what turns
 * on lease and payment emails (`getTenantRecipient` only mails a verified
 * address, since landlords type these in and may get them wrong).
 *
 * Same two endpoints as the registration gate; `issueEmailVerification` accepts
 * any unverified address.
 */
export function VerifyEmailCard({ email }: { email: string }) {
  const router = useRouter()
  const [sent, setSent] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  async function sendCode() {
    setPending(true)
    setError(null)
    const response = await fetch("/api/auth/verify-email/resend", { method: "POST" })
    const data = await response.json().catch(() => null)
    setPending(false)
    if (!response.ok) {
      toast.error(data?.error ?? "Couldn't send a code")
      return
    }
    setCode("")
    setSent(true)
    toast.success(`We've sent a code to ${email}.`)
  }

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    const data = await response.json().catch(() => null)
    setPending(false)
    if (!response.ok) {
      setError(data?.error ?? "That code isn't right.")
      // A dead code needs a new one, not another guess at this one.
      if (data?.reason && data.reason !== "invalid") setCode("")
      return
    }
    toast.success("Email verified — lease and payment updates will come here.")
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MailCheckIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium">Get updates by email</p>
            <p className="text-sm text-muted-foreground">
              Confirm <span className="font-medium text-foreground">{email}</span> to
              receive emails about your lease, payments and contract.
            </p>
          </div>
          {!sent && (
            <Button size="sm" variant="outline" onClick={sendCode} disabled={pending}>
              {pending ? "Sending…" : "Send code"}
            </Button>
          )}
        </div>

        {sent && (
          <form onSubmit={confirm} className="flex flex-wrap items-center gap-3">
            <InputOTP
              maxLength={OTP_LENGTH}
              value={code}
              onChange={(value) => {
                setCode(value)
                setError(null)
              }}
              aria-label="Verification code"
            >
              <InputOTPGroup className="gap-1.5">
                {Array.from({ length: OTP_LENGTH }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="size-9 rounded-md border bg-card"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <Button type="submit" size="sm" disabled={pending || code.length < OTP_LENGTH}>
              {pending ? "Confirming…" : "Confirm"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={sendCode} disabled={pending}>
              Send a new code
            </Button>
            {error && <FieldError className="w-full">{error}</FieldError>}
          </form>
        )}
      </CardContent>
    </Card>
  )
}
