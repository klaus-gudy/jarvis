import { redirect } from "next/navigation";
import { ScrollTextIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeaseTemplatesView } from "@/components/settings/lease-templates-view";
import { getCurrentUser, SESSION_EXPIRED_PATH } from "@/lib/auth/session";
import { requireStaffPage } from "@/lib/authz";
import { getLeaseTemplates } from "@/lib/lease-templates";

export default async function LeaseTemplatesPage() {
  await requireStaffPage("template:manage");
  const user = await getCurrentUser();
  if (!user) redirect(SESSION_EXPIRED_PATH);

  if (!user.activeOrgId) {
    return (
      <EmptyState
        icon={ScrollTextIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  const templates = await getLeaseTemplates(user.activeOrgId);

  return <LeaseTemplatesView templates={templates} />;
}
