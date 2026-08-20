"use client";

import * as React from "react";
import Link from "next/link";
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

export function VerifyOtpForm({ identifier }: { identifier: string | null }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier) {
      toast.error("Start again from the forgot-password page.");
      return;
    }

    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, code }),
    });

    if (response.ok) {
      // Nothing is carried in the URL: the endpoint set an httpOnly ticket
      // cookie, and that is what authorises the next step.
      router.push("/reset-password");
      return;
    }

    const data = await response.json().catch(() => null);
    setError(data?.error ?? "That code isn't right.");
    // A dead code needs a new one, not another guess at this one.
    if (data?.reason === "expired" || data?.reason === "too-many-attempts") {
      setCode("");
    }
    setPending(false);
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
            {pending ? "Verifying…" : "Verify code"}
          </Button>
        </FieldGroup>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Didn&apos;t get a code?{" "}
        <Link
          href="/forgot-password"
          className="font-medium text-primary hover:underline"
        >
          Send it again
        </Link>
      </p>
    </>
  );
}
