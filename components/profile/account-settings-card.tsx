"use client";

import * as React from "react";
import { KeyRoundIcon } from "lucide-react";

import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The account's password. Changing a phone number used to sit here too and was
 * removed: it was a second entry point to the field the Edit profile dialog
 * already owns. Deleting the organization moved to Settings → Organization.
 */
export function AccountSettingsCard({ canSignIn }: { canSignIn: boolean }) {
  const [changingPassword, setChangingPassword] = React.useState(false);

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
        </CardContent>
      </Card>

      {changingPassword && (
        <ChangePasswordDialog
          key="password"
          open
          onOpenChange={setChangingPassword}
        />
      )}
    </>
  );
}
