"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BuildingIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Shown when a signed-in user belongs to no organization — never invited, or
 * their last one was deleted. Non-dismissible, because nothing in the app works
 * without an organization; signing out is the only other way forward.
 */
export function CreateOrganizationDialog({ userName }: { userName: string }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (response.ok) {
      toast.success(`${name} created`);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message =
      data?.issues?.name?.[0] ?? data?.error ?? "Could not create the organization";
    setError(message);
    toast.error(message);
    setPending(false);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    // Controlled open with no close path, so it can't be escaped by clicking
    // away or pressing Escape.
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BuildingIcon className="size-5" />
            </div>
            <DialogTitle>Create your organization</DialogTitle>
            <DialogDescription>
              Hi {userName} — you don&apos;t belong to any organization yet. Create
              one to get started, or ask someone to invite you to theirs.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Field>
              <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
              <Input
                id="org-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Acme Property Group"
                required
                autoFocus
              />
              <FieldDescription>
                You&apos;ll be its owner and can invite others afterwards.
              </FieldDescription>
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={signOut}
              disabled={pending}
            >
              Sign out
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
