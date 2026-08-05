"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const OTP_LENGTH = 6;

export function VerifyOtpForm({ identifier }: { identifier: string | null }) {
  const router = useRouter();
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    // TODO: POST /api/auth/verify-otp once codes are actually issued. The code
    // is carried forward so the reset step can submit it with the new password.
    const params = new URLSearchParams();
    if (identifier) params.set("identifier", identifier);
    params.set("code", code);
    router.push(`/reset-password?${params.toString()}`);
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
              onChange={setCode}
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
