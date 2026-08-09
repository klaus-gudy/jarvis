import { redirect } from "next/navigation";
import { FileTextIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeasesTable } from "@/components/leases/leases-table";
import { getCurrentUser } from "@/lib/auth/session";
import { runAutoRenewals } from "@/lib/lease-renewal";
import { getLeaseOptions, getLeases } from "@/lib/leases";

export default async function LeasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.activeOrgId) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  // No scheduler exists yet, so this is where an ended, auto-renewing lease
  // actually gets its successor — the first page a manager is likely to load.
  await runAutoRenewals(user.activeOrgId);

  const [leases, options] = await Promise.all([
    getLeases(user.activeOrgId),
    getLeaseOptions(user.activeOrgId),
  ]);

  return <LeasesTable leases={leases} options={options} />;
}
