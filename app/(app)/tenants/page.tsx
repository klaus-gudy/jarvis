import { redirect } from "next/navigation";
import { UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { TenantsTable } from "@/components/tenants/tenants-table";
import { getCurrentUser } from "@/lib/auth/session";
import { getTenants } from "@/lib/tenants";

export default async function TenantsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.activeOrgId) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  const tenants = await getTenants(user.activeOrgId);

  return <TenantsTable tenants={tenants} />;
}
