import { redirect } from "next/navigation";

import { ProfilePhotoAvatar } from "@/components/documents/profile-photo-avatar";
import { AccountSettingsCard } from "@/components/profile/account-settings-card";
import { PaymentAccountsCard } from "@/components/profile/payment-accounts-card";
import { SignatureCard } from "@/components/members/signature-card";
import { PersonalInfoCard } from "@/components/profile/personal-info-card";
import { Card, CardContent } from "@/components/ui/card";
import { listAssetTypes } from "@/lib/asset-types";
import { getCurrentUser } from "@/lib/auth/session";
import { listDocuments } from "@/lib/documents";
import { getProfile } from "@/lib/profile";
import { displayName, primaryContact } from "@/lib/user-display";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id, user.activeOrgId);
  const { personal, organization, membershipId } = profile;
  const name = displayName(personal);

  // Same split as the member detail page: the profile photo is a `FileAsset`
  // like any other, scoped to the `Membership` — which this account may not
  // have if it belongs to no organization, the one case `ProfilePhotoAvatar`
  // renders read-only.
  const [assets, assetTypes] =
    membershipId && user.activeOrgId
      ? await Promise.all([
          listDocuments(user.activeOrgId, "MEMBERSHIP", membershipId),
          listAssetTypes(user.activeOrgId, "MEMBERSHIP"),
        ])
      : [[], []];
  const profilePhoto = assets.find((asset) => asset.assetType.isPhoto) ?? null;
  const profilePhotoTypeId =
    assetTypes.find((type) => type.isPhoto)?.id ?? null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Card>
        <CardContent className="flex items-center gap-4">
          <ProfilePhotoAvatar
            membershipId={membershipId}
            name={name}
            photoId={profilePhoto?.id ?? null}
            assetTypeId={profilePhotoTypeId}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">
              {name}
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              {organization
                ? `${organization.roleName} · ${organization.name}`
                : (primaryContact(personal) ?? "No organization")}
            </p>
          </div>
        </CardContent>
      </Card>

      <PersonalInfoCard personal={personal} membershipId={membershipId} />

      {/* A signature belongs to a membership, so an account with no
          organization has nowhere to keep one. */}
      {membershipId && (
        <SignatureCard
          membershipId={membershipId}
          name={name}
          signatureKey={profile.signatureKey}
          isSelf
        />
      )}


      <AccountSettingsCard canSignIn={profile.canSignIn} />

      <PaymentAccountsCard accounts={profile.paymentAccounts} />
    </div>
  );
}
