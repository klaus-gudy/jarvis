import { redirect } from "next/navigation";
import { UsersIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { TenantsTable } from "@/components/tenants/tenants-table";
import { getCurrentUser } from "@/lib/auth/session";
import { getLeaseOptions } from "@/lib/leases";
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

  // Options for the row-level "Assign lease" action — the same free-unit list
  // the leases page builds its form from.
  const [tenants, leaseOptions] = await Promise.all([
    getTenants(user.activeOrgId),
    getLeaseOptions(user.activeOrgId),
  ]);

  return <TenantsTable tenants={tenants} leaseOptions={leaseOptions} />;
}
