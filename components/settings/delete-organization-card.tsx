"use client";

import * as React from "react";
import { Trash2Icon } from "lucide-react";

import { DeleteOrganizationDialog } from "@/components/profile/delete-organization-dialog";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The destructive action on Settings → Organization. Rendered only for a
 * holder of `org:delete` — a member without it is not shown a control that
 * 403s; the API re-checks inside the delete transaction.
 */
export function DeleteOrganizationCard({
  organization,
}: {
  organization: { id: string; name: string };
}) {
  const [deleting, setDeleting] = React.useState(false);

  return (
    <>
      <Card>
        <ProfileCardHeader title="Danger zone" />
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium">Delete organization</p>
              <p className="text-sm text-muted-foreground">
                Permanently removes {organization.name} and all of its
                properties, leases and payment records.
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0 bg-card"
              onClick={() => setDeleting(true)}
            >
              <Trash2Icon />
              Delete organization
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Keyed so each opening re-fetches the counts rather than showing last
          time's, which may predate a property or lease being added. */}
      {deleting && (
        <DeleteOrganizationDialog
          key={`delete-${organization.id}`}
          open
          onOpenChange={setDeleting}
          organizationId={organization.id}
          organizationName={organization.name}
        />
      )}
    </>
  );
}
