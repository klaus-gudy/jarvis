import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon, LockIcon, ShieldCheckIcon } from "lucide-react";

import { RoleActions } from "@/components/roles/role-actions";
import { RoleMembersTable } from "@/components/roles/role-members-table";
import { RolePermissionsEditor } from "@/components/roles/role-permissions-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireStaffPage } from "@/lib/authz";
import { getRole } from "@/lib/roles";

/**
 * One role. Laid out like the lease and property detail pages: outline back
 * button, a compact identity card (name with its type badge beside it), then
 * line tabs with count badges.
 */
export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const access = await requireStaffPage("role:manage");
  if (!access) redirect("/roles");

  const { id } = await params;
  const role = await getRole(access.organizationId, id);
  if (!role) notFound();

  // Permissions first and by default; `?tab=members` opens the other one.
  const tab = (await searchParams).tab === "members" ? "members" : "permissions";

  const grantedCount = role.permissions.length;

  // Only an Owner may edit the Owner role (the API enforces it too).
  const mayEditRole = role.kind !== "OWNER" || access.kind === "OWNER";

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/roles" />}
      >
        <ArrowLeftIcon />
        All roles
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {role.isSystem ? (
                <LockIcon className="size-6" aria-hidden />
              ) : (
                <ShieldCheckIcon className="size-6" aria-hidden />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="truncate text-xl font-semibold tracking-tight">{role.name}</h2>
                <Badge
                  variant={role.isSystem ? "secondary" : "outline"}
                  className="rounded-full font-normal"
                >
                  {role.isSystem ? "Built-in" : "Custom"}
                </Badge>
              </div>
            </div>
          </div>
          {mayEditRole && <RoleActions role={role} />}
        </CardContent>
      </Card>

      <Tabs defaultValue={tab}>
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="permissions" className="flex-none gap-2 px-3">
            Permissions
            {grantedCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {grantedCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="members" className="flex-none gap-2 px-3">
            Members
            {/* Hidden at zero, like every other tab count — a "0" reads as a
                problem rather than a total. */}
            {role.memberCount > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {role.memberCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="pt-5">
          <RolePermissionsEditor
            // Remounted after a save so the draft starts from what was stored.
            key={role.permissions.join(",")}
            roleId={role.id}
            roleName={role.name}
            kind={role.kind}
            granted={role.permissions}
            memberCount={role.memberCount}
            editable={mayEditRole}
          />
        </TabsContent>

        <TabsContent value="members" className="pt-5">
          <RoleMembersTable members={role.members} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
