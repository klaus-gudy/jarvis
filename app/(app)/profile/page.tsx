import { redirect } from "next/navigation";
import {
  BuildingIcon,
  CalendarIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react";

import { AccountSettingsCard } from "@/components/profile/account-settings-card";
import { PaymentAccountsCard } from "@/components/profile/payment-accounts-card";
import { PersonalInfoCard } from "@/components/profile/personal-info-card";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { ProfileField } from "@/components/profile/profile-field";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getProfile } from "@/lib/profile";
import { displayName, initials, primaryContact } from "@/lib/user-display";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id, user.activeOrgId);
  const { personal, organization, membershipId } = profile;
  const name = displayName(personal);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-12 shrink-0">
            <AvatarFallback className="text-sm">{initials(name)}</AvatarFallback>
          </Avatar>
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

      <Card>
        <ProfileCardHeader title="Organization information" />
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

      <AccountSettingsCard canSignIn={profile.canSignIn} />

      <PaymentAccountsCard accounts={profile.paymentAccounts} />
    </div>
  );
}
