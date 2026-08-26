import { redirect } from "next/navigation";
import { ScrollTextIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeaseTemplatesView } from "@/components/settings/lease-templates-view";
import { getCurrentUser } from "@/lib/auth/session";
import { getLeaseTemplates } from "@/lib/lease-templates";

export default async function LeaseTemplatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
