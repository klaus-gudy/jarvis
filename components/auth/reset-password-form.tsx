"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2Icon } from "lucide-react";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

/**
 * Takes no props: the reset is authorised by the httpOnly ticket cookie
 * `/verify-otp` set, so there is no identifier or code to thread through — and
 * nothing sensitive sitting in the URL where history and referrers can see it.
 */
export function ResetPasswordForm() {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [expired, setExpired] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setError(null);
    setPending(true);

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (response.ok) {
      setDone(true);
      return;
    }

    const data = await response.json().catch(() => null);
    // 401 means the ticket is gone or spent — another guess at the form won't
    // help, so the only useful control is a link back to the start.
    if (response.status === 401) setExpired(true);
    setError(
      data?.issues?.password?.[0] ?? data?.error ?? "Something went wrong"
    );
    setPending(false);
  }

  if (done) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <CheckCircle2Icon className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          Your password has been updated. Sign in with the new one.
        </div>
        <Button nativeButton={false} render={<Link href="/login" />} className="w-full">
          Back to sign in
        </Button>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          {error ?? "Your reset session has expired."}
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/forgot-password" />}
          className="w-full"
        >
          Request a new code
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-password" required>New password</FieldLabel>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            className="bg-card"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password" required>Confirm password</FieldLabel>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            className="bg-card"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
            minLength={8}
          />
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Updating…" : "Reset password"}
        </Button>
      </FieldGroup>
    </form>
  );
}
