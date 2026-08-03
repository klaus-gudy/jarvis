import { redirect } from "next/navigation";
import { UserCogIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { UsersView } from "@/components/users/users-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getInvitations } from "@/lib/invitations";
import { getMembers } from "@/lib/members";
import { getRoles } from "@/lib/roles";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.activeOrgId) {
    return (
      <EmptyState
        icon={UserCogIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  const [members, roles, invitations] = await Promise.all([
    getMembers(user.activeOrgId),
    getRoles(user.activeOrgId),
    getInvitations(user.activeOrgId),
  ]);

  return <UsersView members={members} roles={roles} invitations={invitations} />;
}
