import { redirect } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { RolesView } from "@/components/roles/roles-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getRoles } from "@/lib/roles";

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.activeOrgId) {
    return (
      <EmptyState
        icon={ShieldCheckIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  const roles = await getRoles(user.activeOrgId);

  return <RolesView roles={roles} />;
}
