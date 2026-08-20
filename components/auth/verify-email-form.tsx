"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const OTP_LENGTH = 6;

export function VerifyEmailForm() {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [resending, setResending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (response.ok) {
      // `refresh()` before navigating: the gate lives in the server layout, so
      // the cached RSC payload still believes this account is unverified and
      // would bounce straight back here.
      router.refresh();
      router.push("/dashboard");
      return;
    }

    const data = await response.json().catch(() => null);
    setError(data?.error ?? "That code isn't right.");
    // A dead code needs a new one, not another guess at this one.
    if (data?.reason && data.reason !== "invalid") setCode("");
    setPending(false);
  }

  async function handleResend() {
    setResending(true);
    setError(null);

    const response = await fetch("/api/auth/verify-email/resend", {
      method: "POST",
    });
    const data = await response.json().catch(() => null);

    if (response.ok) {
      setCode("");
      toast.success("We've sent a new code.");
    } else {
      toast.error(data?.error ?? "Couldn't send a new code");
    }
    setResending(false);
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="otp">Verification code</FieldLabel>
            <InputOTP
              id="otp"
              maxLength={OTP_LENGTH}
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
              }}
              containerClassName="justify-between"
            >
              <InputOTPGroup className="w-full justify-between gap-2">
                {Array.from({ length: OTP_LENGTH }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="size-11 rounded-lg border bg-card text-base"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </Field>

          {error && <FieldError>{error}</FieldError>}

          <Button
            type="submit"
            className="w-full"
            disabled={pending || code.length < OTP_LENGTH}
          >
            {pending ? "Confirming…" : "Confirm email"}
          </Button>
        </FieldGroup>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Didn&apos;t get it?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-primary hover:underline disabled:opacity-60"
        >
          {resending ? "Sending…" : "Send a new code"}
        </button>
      </p>

      {/* The gate blocks every other page, so without this the only way out of
          a wrong-address signup is clearing cookies by hand. */}
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Wrong address?{" "}
        <button
          type="button"
          onClick={handleSignOut}
          className="font-medium text-primary hover:underline"
        >
          Sign out
        </button>
      </p>
    </>
  );
}
