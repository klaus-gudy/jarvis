import { redirect } from "next/navigation";
import { DoorOpenIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { AllUnitsTable } from "@/components/units/all-units-table";
import { getCurrentUser, SESSION_EXPIRED_PATH } from "@/lib/auth/session";
import { requireStaffPage } from "@/lib/authz";
import { getOrganizationUnits } from "@/lib/units";

export default async function UnitsPage() {
  await requireStaffPage("property:read");
  const user = await getCurrentUser();
  if (!user) redirect(SESSION_EXPIRED_PATH);

  if (!user.activeOrgId) {
    return (
      <EmptyState
        icon={DoorOpenIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  const units = await getOrganizationUnits(user.activeOrgId);

  return <AllUnitsTable units={units} />;
}
