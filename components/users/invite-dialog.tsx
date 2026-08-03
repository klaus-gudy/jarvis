"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Values = { name: string; email: string; phone: string; roleId: string };
type FieldErrors = Partial<Record<keyof Values, string[]>>;

export function InviteDialog({
  open,
  onOpenChange,
  roles,
  /** Pre-fills the form when inviting a member who already exists but can't sign in. */
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: { id: string; name: string }[];
  prefill?: {
    name: string;
    email: string | null;
    phone: string | null;
    roleId: string;
  };
}) {
  const router = useRouter();
  // Roles arrive sorted by name, so roles[0] is usually "Owner" — a dangerous
  // thing to pre-select. Prefer Tenant, then any non-Owner role.
  const defaultRoleId =
    roles.find((role) => role.name.toLowerCase() === "tenant")?.id ??
    roles.find((role) => role.name.toLowerCase() !== "owner")?.id ??
    roles[0]?.id ??
    "";
  const [values, setValues] = React.useState<Values>({
    name: prefill?.name ?? "",
    email: prefill?.email ?? "",
    phone: prefill?.phone ?? "",
    roleId: prefill?.roleId ?? defaultRoleId,
  });
  const [pending, setPending] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.token) {
      // The token is only ever returned here, so build the link immediately.
      setInviteLink(`${window.location.origin}/invite/${data.token}`);
      setPending(false);
      router.refresh();
      return;
    }

    setFieldErrors(data?.issues ?? {});
    setFormError(data?.issues ? null : (data?.error ?? "Something went wrong"));
    setPending(false);
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
  }

  if (inviteLink) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invitation ready</DialogTitle>
            <DialogDescription>
              Share this link with the person you invited. It expires in 14 days
              and can only be used once — copy it now, it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 py-4">
            <Input readOnly value={inviteLink} className="font-mono text-xs" />
            <Button type="button" variant="outline" onClick={copyLink}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Invite someone</DialogTitle>
            <DialogDescription>
              Creates a link you share yourself. They pick their own password when
              they accept.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field>
              <FieldLabel htmlFor="invite-name">Name (optional)</FieldLabel>
              <Input
                id="invite-name"
                value={values.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="Neema Kimaro"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="invite-phone">Phone</FieldLabel>
              <Input
                id="invite-phone"
                type="tel"
                value={values.phone}
                onChange={(event) => set("phone", event.target.value)}
                placeholder="+255712345678"
                required
              />
              <FieldError errors={fieldErrors.phone?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="invite-email">Email (optional)</FieldLabel>
              <Input
                id="invite-email"
                type="email"
                value={values.email}
                onChange={(event) => set("email", event.target.value)}
                placeholder="neema@example.com"
              />
              <FieldError errors={fieldErrors.email?.map((m) => ({ message: m }))} />
            </Field>

            <Field>
              <FieldLabel htmlFor="invite-role">Role</FieldLabel>
              <Select
                value={values.roleId}
                onValueChange={(next) => next && set("roleId", next)}
              >
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue>
                    {(selected: string) =>
                      roles.find((r) => r.id === selected)?.name ?? "Pick a role"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={fieldErrors.roleId?.map((m) => ({ message: m }))} />
            </Field>

            {formError && <FieldError>{formError}</FieldError>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create invite link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
