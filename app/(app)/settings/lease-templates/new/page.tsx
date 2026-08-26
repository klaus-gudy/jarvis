import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ScrollTextIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeaseTemplateForm } from "@/components/settings/lease-template-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { countLeaseTemplates } from "@/lib/lease-templates";

export default async function NewLeaseTemplatePage() {
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

  const existingCount = await countLeaseTemplates(user.activeOrgId);

  return (
    <div className="space-y-4">
      <Button
        variant="outline"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/settings/lease-templates" />}
      >
        <ArrowLeftIcon />
        All templates
      </Button>

      <LeaseTemplateForm isFirstTemplate={existingCount === 0} />
    </div>
  );
}
