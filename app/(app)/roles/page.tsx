import { ShieldCheckIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { RolesView } from "@/components/roles/roles-view";
import { requireStaffPage } from "@/lib/authz";
import { getRoles } from "@/lib/roles";

export default async function RolesPage() {
  const access = await requireStaffPage("role:manage");

  if (!access) {
    return (
      <EmptyState
        icon={ShieldCheckIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  const roles = await getRoles(access.organizationId);

  return <RolesView roles={roles} />;
}
