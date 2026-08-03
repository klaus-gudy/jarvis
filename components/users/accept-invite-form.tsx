"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function AcceptInviteForm({
  token,
  organizationName,
  roleName,
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Join {organizationName}</CardTitle>
        <CardDescription>
          You&apos;ve been invited as {roleName}. Choose a password to finish
          setting up your account.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="accept-name">Your name</FieldLabel>
              <Input
                id="accept-name"
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
              <FieldLabel htmlFor="accept-password">Password</FieldLabel>
              <Input
                id="accept-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
              <FieldDescription>At least 8 characters.</FieldDescription>
            </Field>

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Setting up…" : "Accept invitation"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
