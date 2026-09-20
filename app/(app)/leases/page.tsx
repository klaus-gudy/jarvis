import { redirect } from "next/navigation";
import { FileTextIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeasesTable } from "@/components/leases/leases-table";
import { getCurrentUser } from "@/lib/auth/session";
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

  const [leases, options] = await Promise.all([
    getLeases(user.activeOrgId),
    getLeaseOptions(user.activeOrgId),
  ]);

  return <LeasesTable leases={leases} options={options} />;
}
