import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, LockIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";

import { RoleActions } from "@/components/roles/role-actions";
import { RolePermissionsEditor } from "@/components/roles/role-permissions-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffPage } from "@/lib/authz";
import { getRole } from "@/lib/roles";

const KIND_LABEL = { OWNER: "Built-in · Owner", TENANT: "Built-in · Tenant", STAFF: "Custom" } as const;

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireStaffPage("role:manage");
  if (!access) redirect("/roles");

  const { id } = await params;
  const role = await getRole(access.organizationId, id);
  if (!role) notFound();

  // Only an Owner may rename the Owner role (the API enforces it too).
  const mayEditRole = role.kind !== "OWNER" || access.kind === "OWNER";

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2"
        nativeButton={false}
        render={<Link href="/roles" />}
      >
        <ArrowLeftIcon />
        All roles
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:size-12">
              {role.isSystem ? (
                <LockIcon className="size-5 sm:size-6" aria-hidden />
              ) : (
                <ShieldCheckIcon className="size-5 sm:size-6" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="truncate text-base font-semibold tracking-tight sm:text-xl">
                {role.name}
              </h2>
              {role.description && (
                <p className="text-sm text-muted-foreground">{role.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <Badge
                  variant={role.isSystem ? "secondary" : "outline"}
                  className="rounded-full font-normal"
                >
                  {KIND_LABEL[role.kind]}
                </Badge>
                <span>
                  {role.memberCount} {role.memberCount === 1 ? "member" : "members"}
                  {role.pendingInviteCount > 0 &&
                    ` · ${role.pendingInviteCount} pending ${role.pendingInviteCount === 1 ? "invite" : "invites"}`}
                </span>
              </div>
            </div>
          </div>
          {mayEditRole && <RoleActions role={role} />}
        </CardContent>
      </Card>

      <RolePermissionsEditor
        // Remounted after a save so the draft starts from what was stored.
        key={role.permissions.join(",")}
        roleId={role.id}
        roleName={role.name}
        kind={role.kind}
        granted={role.permissions}
        memberCount={role.memberCount}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UsersIcon className="size-4" aria-hidden />
            People in this role
          </CardTitle>
        </CardHeader>
        <CardContent>
          {role.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody holds this role yet. Assign it from the Users page, or invite someone into it.
            </p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {role.members.slice(0, 50).map((member) => (
                <li key={member.membershipId}>
                  <Link
                    href={`/members/${member.membershipId}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/40"
                  >
                    <span className="truncate font-medium">{member.name}</span>
                    <span className="shrink-0 truncate text-muted-foreground">{member.contact}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {role.members.length > 50 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Showing 50 of {role.members.length}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
