import Link from "next/link";

import { AuthHeader } from "@/components/auth/auth-header";
import { AcceptInviteForm } from "@/components/users/accept-invite-form";
import { Button } from "@/components/ui/button";
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
      <>
        <AuthHeader
          title="This invitation isn't valid"
          subtitle="It may have expired, been revoked, or already been used. Ask whoever invited you for a fresh link."
        />
        <Button nativeButton={false} render={<Link href="/login" />} className="w-full">
          Go to sign in
        </Button>
      </>
    );
  }

  return (
    <>
      <AuthHeader
        title={`Join ${invitation.organizationName}`}
        subtitle={`You've been invited as ${invitation.roleName}. Choose a password to finish setting up your account.`}
      />
      <AcceptInviteForm
        token={token}
        organizationName={invitation.organizationName}
        roleName={invitation.roleName}
        presetName={invitation.name}
        presetEmail={invitation.email}
        presetPhone={invitation.phone}
      />
    </>
  );
}
