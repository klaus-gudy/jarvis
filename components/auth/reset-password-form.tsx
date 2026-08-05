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

export function ResetPasswordForm({
  identifier,
  code,
}: {
  identifier: string | null;
  code: string | null;
}) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setError(null);
    // TODO: POST /api/auth/reset-password with { identifier, code, password }
    // once the endpoint exists — identifier and code are already threaded
    // through the flow for it.
    void identifier;
    void code;
    setDone(true);
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

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
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
          <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
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

        <Button type="submit" className="w-full">
          Reset password
        </Button>
      </FieldGroup>
    </form>
  );
}
