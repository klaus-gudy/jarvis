"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  PencilIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { MemberEditDialog } from "@/components/member-edit-dialog";
import { PersonCell } from "@/components/person-cell";
import { InviteDialog } from "@/components/users/invite-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import type { InvitationRow } from "@/lib/invitations";
import type { MemberRow } from "@/lib/members";

export function UsersView({
  members,
  roles,
  invitations,
}: {
  members: MemberRow[];
  roles: { id: string; name: string; memberCount: number }[];
  invitations: InvitationRow[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [roleOpen, setRoleOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<MemberRow | null>(null);
  const [inviting, setInviting] = React.useState<MemberRow | null>(null);
  const [editing, setEditing] = React.useState<MemberRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const columns = React.useMemo<ColumnDef<MemberRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <PersonCell name={row.original.name} />,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) =>
          row.original.phone ?? <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) =>
          row.original.email ?? <span className="text-muted-foreground">—</span>,
      },
      {
        accessorKey: "roleName",
        header: "Role",
        cell: ({ row }) => (
          <Badge
            variant={row.original.isOwner ? "secondary" : "outline"}
            className="rounded-full font-normal"
          >
            {row.original.roleName}
          </Badge>
        ),
        filterFn: (row, columnId, filterValue) =>
          row.getValue(columnId) === filterValue,
      },
      {
        accessorKey: "joinedAt",
        header: "Date joined",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(new Date(row.original.joinedAt))}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {/* Members onboarded by staff have no password — this is how they
                get a link to set one and gain access. */}
            {!row.original.canSignIn && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInviting(row.original)}
              >
                <SendIcon />
                Invite
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(row.original)}
              aria-label={`Edit ${row.original.name}`}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setError(null);
                setRemoving(row.original);
              }}
              aria-label={`Remove ${row.original.name}`}
            >
              <Trash2Icon />
            </Button>
          </div>
        ),
        enableSorting: false,
      },
    ],
    []
  );

  async function handleRemove() {
    if (!removing) return;
    setPending(true);
    setError(null);

    const response = await fetch(`/api/members/${removing.membershipId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setRemoving(null);
      setPending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    setError(data?.error ?? "Could not remove this member");
    setPending(false);
  }

  async function revokeInvite(id: string) {
    await fetch(`/api/invitations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => setRoleOpen(true)}>
          <PlusIcon />
          New role
        </Button>
        <Button onClick={() => setInviteOpen(true)}>
          Invite user
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={members}
        searchColumnId="name"
        searchPlaceholder="Search members…"
        facetFilters={[
          {
            columnId: "roleName",
            placeholder: "All roles",
            options: roles.map((role) => ({ label: role.name, value: role.name })),
          },
        ]}
        emptyMessage="No members yet."
        getRowHref={(member) => `/tenants/${member.membershipId}`}
      />

      {invitations.length > 0 && (
        <Card className="gap-4 p-4">
          <CardHeader className="p-0">
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-0">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <div className="leading-tight">
                  <div className="font-medium">
                    {invitation.name ??
                      invitation.phone ??
                      invitation.email ??
                      "Invitation"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {invitation.roleName} ·{" "}
                    {invitation.isExpired
                      ? "Expired"
                      : `expires ${formatDate(new Date(invitation.expiresAt))}`}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeInvite(invitation.id)}
                >
                  <XIcon />
                  Revoke
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <InviteDialog
        key={String(inviteOpen)}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roles={roles}
      />

      <MemberEditDialog
        key={`edit-${editing?.membershipId ?? "none"}`}
        member={editing}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      {inviting && (
        <InviteDialog
          key={`member-invite-${inviting.membershipId}`}
          open
          onOpenChange={(open) => !open && setInviting(null)}
          roles={roles}
          prefill={{
            name: inviting.name,
            email: inviting.email,
            phone: inviting.phone,
            roleId: inviting.roleId,
          }}
        />
      )}

      <NewRoleDialog
        key={`role-${roleOpen}`}
        open={roleOpen}
        onOpenChange={setRoleOpen}
      />

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              They lose access to this organization. Any leases attached to them
              are deleted too. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoving(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={pending}>
              {pending ? "Removing…" : "Remove member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewRoleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (response.ok) {
      onOpenChange(false);
      setPending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    setError(
      data?.issues?.name?.[0] ?? data?.error ?? "Could not create this role"
    );
    setPending(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New role</DialogTitle>
            <DialogDescription>
              Roles are specific to your organization — for example Manager or
              Caretaker.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Field>
              <FieldLabel htmlFor="role-name">Role name</FieldLabel>
              <Input
                id="role-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Manager"
                required
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
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
              {pending ? "Creating…" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
