import Link from "next/link";

import { AcceptInviteForm } from "@/components/users/accept-invite-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getInvitationByToken } from "@/lib/invitations";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>This invitation isn&apos;t valid</CardTitle>
            <CardDescription>
              It may have expired, been revoked, or already been used. Ask whoever
              invited you for a fresh link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button nativeButton={false} render={<Link href="/login" />}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <AcceptInviteForm
        token={token}
        organizationName={invitation.organizationName}
        roleName={invitation.roleName}
        presetName={invitation.name}
        presetEmail={invitation.email}
        presetPhone={invitation.phone}
      />
    </main>
  );
}
