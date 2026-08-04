import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { PropertyForm } from "@/components/properties/property-form";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { getProperty } from "@/lib/properties";

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.activeOrgId) redirect("/properties");

  const { id } = await params;
  const property = await getProperty(user.activeOrgId, id);
  if (!property) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Button
        variant="ghost"
        className="-ml-2 w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href={`/properties/${property.id}`} />}
      >
        <ArrowLeftIcon />
        Back to property
      </Button>

      <PropertyForm
        mode="edit"
        propertyId={property.id}
        ownerName={property.ownerName}
        initialValues={{
          name: property.name,
          type: property.type,
          category: property.category,
          address: property.address,
          status: property.status,
          description: property.description ?? "",
          amenities: property.amenities,
        }}
      />
    </div>
  );
}
