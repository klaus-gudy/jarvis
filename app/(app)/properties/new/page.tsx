import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { PropertyForm } from "@/components/properties/property-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrganizationOwnerName } from "@/lib/organizations";

export default async function NewPropertyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.activeOrgId) redirect("/properties");

  const ownerName = await getOrganizationOwnerName(user.activeOrgId);

  return (
    <div className="max-w-3xl space-y-6">
      <Button
        variant="ghost"
        className="-ml-2 w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/properties" />}
      >
        <ArrowLeftIcon />
        All properties
      </Button>

      <PropertyForm mode="create" ownerName={ownerName} />
    </div>
  );
}
