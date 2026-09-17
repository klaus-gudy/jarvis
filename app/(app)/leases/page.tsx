import { after } from "next/server";
import { redirect } from "next/navigation";
import { FileTextIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeasesTable } from "@/components/leases/leases-table";
import { getCurrentUser } from "@/lib/auth/session";
import { queueContractsForRenewals, runAutoRenewals } from "@/lib/lease-renewal";
import { announceLeaseRenewals, getLeaseOptions, getLeases } from "@/lib/leases";

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
  const { renewals } = await runAutoRenewals(user.activeOrgId);
  // Announced after the render, not during it: publishing waits on the broker,
  // and nothing a person is waiting for should depend on RabbitMQ being up.
  if (renewals.length > 0) {
    const orgId = user.activeOrgId;
    after(() => announceLeaseRenewals(orgId, renewals));
    // A renewal is a new Lease row exactly like one created by hand, and
    // deserves the same contract — see `queueContractsForRenewals`.
    after(() => queueContractsForRenewals(orgId, renewals));
  }

  const [leases, options] = await Promise.all([
    getLeases(user.activeOrgId),
    getLeaseOptions(user.activeOrgId),
  ]);

  return <LeasesTable leases={leases} options={options} />;
}
