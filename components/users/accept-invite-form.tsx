"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Fields only — the page above it renders the AuthHeader, so this slots into
 * the (auth) shell like every other auth form.
 */
export function AcceptInviteForm({
  token,
  presetName,
  presetEmail,
  presetPhone,
}: {
  token: string;
  organizationName: string;
  roleName: string;
  presetName: string | null;
  presetEmail: string | null;
  presetPhone: string | null;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(presetName ?? "");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const contact = presetPhone ?? presetEmail;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name, password }),
    });

    if (response.ok) {
      // The endpoint signs them in, so go straight to the app.
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    setError(
      data?.issues?.password?.[0] ??
        data?.issues?.name?.[0] ??
        data?.error ??
        "Something went wrong"
    );
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="accept-name" required>Your name</FieldLabel>
          <Input
            id="accept-name"
            className="bg-card"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>

        {contact && (
          <Field>
            <FieldLabel htmlFor="accept-contact">Signing in as</FieldLabel>
            <Input id="accept-contact" value={contact} readOnly disabled />
            <FieldDescription>
              Set by whoever invited you — use this to sign in later.
            </FieldDescription>
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="accept-password" required>Password</FieldLabel>
          <PasswordInput
            id="accept-password"
            autoComplete="new-password"
            className="bg-card"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>

        {error && <FieldError>{error}</FieldError>}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Setting up…" : "Accept invitation"}
        </Button>
      </FieldGroup>
    </form>
  );
}
