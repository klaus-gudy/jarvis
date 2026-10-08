import { ProfilePhotoAvatar } from "@/components/documents/profile-photo-avatar"
import { SignatureCard } from "@/components/members/signature-card"
import { PortalNoOrganization, PortalNotFound } from "@/components/portal/portal-states"
import { VerifyEmailCard } from "@/components/portal/verify-email-card"
import {
  EmergencyContactCard,
  TenantProfileCard,
  type TenantEditable,
} from "@/components/portal/tenant-profile-card"
import { AccountSettingsCard } from "@/components/profile/account-settings-card"
import { Card, CardContent } from "@/components/ui/card"
import { listAssetTypes } from "@/lib/asset-types"
import { requireTenantPage } from "@/lib/authz"
import { getProfilePhotoIds } from "@/lib/documents"
import { getPortalMember } from "@/lib/portal"
import { displayName } from "@/lib/user-display"

export const metadata = { title: "Profile" }

export default async function PortalProfilePage() {
  const access = await requireTenantPage()
  if (!access) return <PortalNoOrganization />

  const [member, photoIds, assetTypes] = await Promise.all([
    getPortalMember(access),
    getProfilePhotoIds(access.organizationId, [access.membershipId]),
    listAssetTypes(access.organizationId, "MEMBERSHIP"),
  ])
  if (!member) return <PortalNotFound />

  const name = displayName(member)
  const details: TenantEditable = {
    name: member.name,
    occupation: member.profile.occupation,
    employer: member.profile.employer,
    nationality: member.profile.nationality,
    emergencyContactName: member.profile.emergencyContactName,
    emergencyContactPhone: member.profile.emergencyContactPhone,
    emergencyContactRelation: member.profile.emergencyContactRelation,
  }

  return (
    // The Home dashboard uses the full width; reading pages stay narrow.
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-4">
          {/* Uploads through `/api/documents`, which lets any member file their
              own profile photo (`lib/document-access.ts`). */}
          <ProfilePhotoAvatar
            membershipId={access.membershipId}
            name={name}
            photoId={photoIds.get(access.membershipId) ?? null}
            assetTypeId={assetTypes.find((type) => type.isPhoto)?.id ?? null}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">{name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              Tenant · {member.organizationName}
            </p>
          </div>
        </CardContent>
      </Card>

      {member.email && !member.emailVerified && <VerifyEmailCard email={member.email} />}

      <TenantProfileCard
        details={details}
        phone={member.phone}
        email={member.email}
        nidaNumber={member.profile.nidaNumber}
      />

      <EmergencyContactCard details={details} />

      <SignatureCard
        membershipId={access.membershipId}
        name={name}
        signatureKey={member.signatureKey}
        isSelf
      />

      <AccountSettingsCard canSignIn={member.canSignIn} />
    </div>
  )
}
