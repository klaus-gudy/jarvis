import { redirect } from "next/navigation";
import { UserCogIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { UsersView } from "@/components/users/users-view";
import { getCurrentUser, SESSION_EXPIRED_PATH } from "@/lib/auth/session";
import { requireStaffPage } from "@/lib/authz";
import { getInvitations } from "@/lib/invitations";
import { getMembers } from "@/lib/members";
import { getRoles } from "@/lib/roles";

export default async function UsersPage() {
  await requireStaffPage("member:read");
  const user = await getCurrentUser();
  if (!user) redirect(SESSION_EXPIRED_PATH);

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
