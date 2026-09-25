import { redirect } from "next/navigation";
import {
  BuildingIcon,
  CalendarIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react";

import { ProfilePhotoAvatar } from "@/components/documents/profile-photo-avatar";
import { AccountSettingsCard } from "@/components/profile/account-settings-card";
import { OrganizationDataActions } from "@/components/profile/organization-data-actions";
import { PaymentAccountsCard } from "@/components/profile/payment-accounts-card";
import { SignatureCard } from "@/components/members/signature-card";
import { PersonalInfoCard } from "@/components/profile/personal-info-card";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { ProfileField } from "@/components/profile/profile-field";
import { Card, CardContent } from "@/components/ui/card";
import { listAssetTypes } from "@/lib/asset-types";
import { getCurrentUser } from "@/lib/auth/session";
import { listDocuments } from "@/lib/documents";
import { formatDate } from "@/lib/format";
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

      <Card>
        <ProfileCardHeader
          title="Organization information"
          stackAction
          action={
            // Owner-only: this is a full backup of the organization's data
            // (every tenant's NIDA number and emergency contacts included),
            // the same boundary `AccountSettingsCard` draws around delete.
            profile.isOwner && organization ? (
              <OrganizationDataActions
                // Restoring into a non-empty organization would duplicate or
                // merge unrelated data, so the button greys out rather than
                // vanishing once this one has a property or a second member —
                // matches the server-side guard on the import route exactly.
                canImport={
                  organization.propertyCount === 0 && organization.memberCount <= 1
                }
              />
            ) : undefined
          }
        />
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {organization ? (
              <>
                <ProfileField
                  label="Organization"
                  value={organization.name}
                  icon={BuildingIcon}
                />
                <ProfileField
                  label="Your role"
                  value={organization.roleName}
                  icon={ShieldCheckIcon}
                />
                <ProfileField
                  label="Owner"
                  value={organization.ownerName}
                  icon={UserRoundIcon}
                />
                <ProfileField
                  label="Member since"
                  value={formatDate(organization.joinedAt)}
                  icon={CalendarIcon}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                You are not a member of an organization yet.
              </p>
            )}
          </dl>
        </CardContent>
      </Card>

      <AccountSettingsCard
        canSignIn={profile.canSignIn}
        // Owner-only, and resolved here rather than in the card: `isOwner`
        // already comes from the profile query, so the card never has to ask
        // who may delete.
        organization={
          profile.isOwner && organization
            ? { id: organization.id, name: organization.name }
            : null
        }
      />

      <PaymentAccountsCard accounts={profile.paymentAccounts} />
    </div>
  );
}
