import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { LeaseTemplateForm } from "@/components/settings/lease-template-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getLeaseTemplate } from "@/lib/lease-templates";

export default async function EditLeaseTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.activeOrgId) redirect("/settings/lease-templates");

  const { id } = await params;
  const template = await getLeaseTemplate(user.activeOrgId, id);
  // Scoped lookup, so another org's id is indistinguishable from a missing one.
  if (!template) notFound();

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

      <LeaseTemplateForm template={template} />
    </div>
  );
}
