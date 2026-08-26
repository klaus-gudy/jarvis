import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ScrollTextIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeaseTemplateForm } from "@/components/settings/lease-template-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { countLeaseTemplates } from "@/lib/lease-templates";
import {
  LEASE_TEMPLATE_LANGUAGES,
  type LeaseTemplateLanguage,
} from "@/lib/lease-template-options";

function readLanguage(value: string | undefined): LeaseTemplateLanguage {
  return LEASE_TEMPLATE_LANGUAGES.some((option) => option.value === value)
    ? (value as LeaseTemplateLanguage)
    : "en";
}

export default async function NewLeaseTemplatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  /**
   * Carried from the New-template dialog rather than re-asked. Query string
   * rather than session state so the page is refreshable and linkable — none
   * of it is sensitive, and it is all about to be typed into a form anyway.
   */
  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

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

      <LeaseTemplateForm
        isFirstTemplate={existingCount === 0}
        initialDetails={{
          name: single("name") ?? "",
          language: readLanguage(single("language")),
          description: single("description") ?? "",
        }}
      />
    </div>
  );
}
