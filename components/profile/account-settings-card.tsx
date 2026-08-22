"use client";

import * as React from "react";
import { KeyRoundIcon, Trash2Icon } from "lucide-react";

import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { DeleteOrganizationDialog } from "@/components/profile/delete-organization-dialog";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/**
 * Password plus the destructive action. Changing a phone number used to sit
 * here too and was removed: it was a second entry point to the field the Edit
 * profile dialog already owns.
 */
export function AccountSettingsCard({
  canSignIn,
  organization,
}: {
  canSignIn: boolean;
  /**
   * Null unless the signed-in user owns the active organization. Deleting is
   * the owner's call alone, so a non-owner is not shown the control at all
   * rather than shown one that 403s.
   */
  organization: { id: string; name: string } | null;
}) {
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [deletingOrganization, setDeletingOrganization] = React.useState(false);

  return (
    <>
      <Card>
        <ProfileCardHeader title="Account settings" />

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="bg-card"
              onClick={() => setChangingPassword(true)}
              disabled={!canSignIn}
            >
              <KeyRoundIcon />
              Change password
            </Button>

            {!canSignIn && (
              <p className="self-center text-sm text-muted-foreground">
                This account has no password yet — it was created for you.
                Accept an invitation to set one.
              </p>
            )}
          </div>

          {organization && (
            <>
              <Separator />
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
                  className="shrink-0 border-destructive/40 bg-card text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setDeletingOrganization(true)}
                >
                  <Trash2Icon />
                  Delete organization
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {changingPassword && (
        <ChangePasswordDialog
          key="password"
          open
          onOpenChange={setChangingPassword}
        />
      )}
      {/* Keyed so each opening re-fetches the counts rather than showing last
          time's, which may predate a property or lease being added. */}
      {deletingOrganization && organization && (
        <DeleteOrganizationDialog
          key={`delete-${organization.id}`}
          open
          onOpenChange={setDeletingOrganization}
          organizationId={organization.id}
          organizationName={organization.name}
        />
      )}
    </>
  );
}
