"use client";

import * as React from "react";
import { KeyRoundIcon } from "lucide-react";

import { ChangePasswordDialog } from "@/components/profile/change-password-dialog";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Only the password lives here. Changing a phone number was a second entry
 * point to the same field the Edit profile dialog already owns, writing the
 * same column through the same endpoint — one control per thing that changes.
 */
export function AccountSettingsCard({ canSignIn }: { canSignIn: boolean }) {
  const [changingPassword, setChangingPassword] = React.useState(false);

  return (
    <>
      <Card>
        <ProfileCardHeader title="Account settings" />

        <CardContent className="grid gap-3 sm:grid-cols-2">
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
              This account has no password yet — it was created for you. Accept
              an invitation to set one.
            </p>
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
    </>
  );
}
