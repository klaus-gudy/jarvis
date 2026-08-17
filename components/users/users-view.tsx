"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { PencilIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { MemberEditDialog } from "@/components/member-edit-dialog";
import { PersonCell } from "@/components/person-cell";
import { InvitationCard } from "@/components/users/invitation-card";
import { InviteDialog } from "@/components/users/invite-dialog";
import { MemberCard } from "@/components/users/member-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type RowAction } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import type { InvitationRow } from "@/lib/invitations";
import type { MemberRow } from "@/lib/members";
import type { RoleRow } from "@/lib/roles";

/** The label an invitation goes by before there is a user account behind it. */
function invitationLabel(invitation: InvitationRow) {
  return invitation.name ?? invitation.email ?? invitation.phone ?? "Invitation";
}

export function UsersView({
  members,
  roles,
  invitations,
}: {
  members: MemberRow[];
  roles: RoleRow[];
  invitations: InvitationRow[];
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<MemberRow | null>(null);
  const [inviting, setInviting] = React.useState<MemberRow | null>(null);
  const [editing, setEditing] = React.useState<MemberRow | null>(null);
  const [revoking, setRevoking] = React.useState<InvitationRow | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const memberColumns = React.useMemo<ColumnDef<MemberRow>[]>(
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
              variant="outline"
              size="icon-sm"
              onClick={() => setEditing(row.original)}
              aria-label={`Edit ${row.original.name}`}
            >
              <PencilIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="text-destructive"
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

  const invitationColumns = React.useMemo<ColumnDef<InvitationRow>[]>(
    () => [
      {
        id: "name",
        // Searches the label actually on screen. `Invitation.name` is nullable,
        // so keying off the raw column would fail to match an invite that is
        // only identified by its email or phone.
        accessorFn: (invitation) => invitationLabel(invitation),
        header: "Invitee",
        // The same avatar treatment as the members table, so a person reads
        // the same either side of accepting.
        cell: ({ row }) => <PersonCell name={invitationLabel(row.original)} />,
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
          <Badge variant="outline" className="rounded-full font-normal">
            {row.original.roleName}
          </Badge>
        ),
        filterFn: (row, columnId, filterValue) =>
          row.getValue(columnId) === filterValue,
      },
      {
        accessorKey: "expiresAt",
        header: "Expires",
        cell: ({ row }) =>
          row.original.isExpired ? (
            // An expired invite still occupies the list until it is revoked,
            // so it says so plainly rather than showing a past date alone.
            <Badge variant="outline" className="rounded-full font-normal text-stat-accent">
              Expired
            </Badge>
          ) : (
            <span className="text-muted-foreground">
              {formatDate(new Date(row.original.expiresAt))}
            </span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                setRevoking(row.original);
              }}
            >
              <XIcon />
              Revoke
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
      toast.success(`${removing.name} removed`);
      setRemoving(null);
      setPending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Could not remove this member";
    setError(message);
    toast.error(message);
    setPending(false);
  }

  async function handleRevoke() {
    if (!revoking) return;
    setPending(true);
    setError(null);

    const response = await fetch(`/api/invitations/${revoking.id}`, {
      method: "DELETE",
    });

    if (response.ok) {
      toast.success("Invite revoked");
      setRevoking(null);
      setPending(false);
      router.refresh();
      return;
    }

    const data = await response.json().catch(() => null);
    const message = data?.error ?? "Could not revoke this invitation";
    setError(message);
    toast.error(message);
    setPending(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setInviteOpen(true)}>Invite user</Button>
      </div>

      <Tabs defaultValue="members">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="members" className="flex-none gap-2 px-3">
            All users
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
              {members.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex-none gap-2 px-3">
            Pending invites
            {invitations.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {invitations.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="pt-4">
          <DataTable
            columns={memberColumns}
            data={members}
            searchPlaceholder="Search members…"
            facetFilters={[
              {
                columnId: "roleName",
                placeholder: "All roles",
                label: "Role",
                options: roles.map((role) => ({
                  label: role.name,
                  value: role.name,
                })),
              },
            ]}
            emptyMessage="No members yet."
            getRowHref={(member) => `/members/${member.membershipId}`}
            renderCard={(member) => <MemberCard member={member} />}
            /*
             * Mobile only, and *not* wired back into the desktop column here —
             * that column mixes a labelled "Invite" button with icon buttons,
             * and rendering it through `RowActionButtons` would flatten Invite
             * into an unlabelled icon. The list below is kept in step with it
             * by hand, including the same `canSignIn` condition on Invite.
             */
            rowActions={(member): RowAction[] => [
              ...(member.canSignIn
                ? []
                : [
                    {
                      label: `Invite ${member.name}`,
                      icon: SendIcon,
                      onSelect: () => setInviting(member),
                    },
                  ]),
              {
                label: `Edit ${member.name}`,
                icon: PencilIcon,
                onSelect: () => setEditing(member),
              },
              {
                label: `Remove ${member.name}`,
                icon: Trash2Icon,
                tone: "destructive",
                onSelect: () => {
                  setError(null);
                  setRemoving(member);
                },
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="invitations" className="pt-4">
          <DataTable
            columns={invitationColumns}
            data={invitations}
            searchPlaceholder="Search invites…"
            facetFilters={[
              {
                columnId: "roleName",
                placeholder: "All roles",
                label: "Role",
                options: roles.map((role) => ({
                  label: role.name,
                  value: role.name,
                })),
              },
            ]}
            emptyMessage="No pending invites. Use “Invite user” to send one."
            renderCard={(invitation) => (
              <InvitationCard invitation={invitation} />
            )}
            rowActions={(invitation): RowAction[] => [
              {
                label: "Revoke invite",
                icon: XIcon,
                tone: "destructive",
                onSelect: () => {
                  setError(null);
                  setRevoking(invitation);
                },
              },
            ]}
          />
        </TabsContent>
      </Tabs>

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

      <Dialog
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Revoke invite for {revoking ? invitationLabel(revoking) : ""}?
            </DialogTitle>
            <DialogDescription>
              The invite link stops working immediately. You can send a new one
              at any time.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevoking(null)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={pending}
            >
              {pending ? "Revoking…" : "Revoke invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
