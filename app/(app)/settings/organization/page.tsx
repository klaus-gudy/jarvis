import { redirect } from "next/navigation";
import {
  BuildingIcon,
  CalendarIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { OrganizationDataActions } from "@/components/profile/organization-data-actions";
import { ProfileCardHeader } from "@/components/profile/profile-card-header";
import { ProfileField } from "@/components/profile/profile-field";
import { DeleteOrganizationCard } from "@/components/settings/delete-organization-card";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { requireStaffPage } from "@/lib/authz";
import { formatDate } from "@/lib/format";
import { ORGANIZATION_SETTINGS_PERMISSIONS } from "@/lib/nav";
import { getProfile } from "@/lib/profile";

export const metadata = { title: "Organization" };

/**
 * The organization itself: who owns it, backup/restore and deletion. Moved out
 * of /profile, which is about the signed-in person, not the org they're in.
 */
export default async function OrganizationSettingsPage() {
  await requireStaffPage(ORGANIZATION_SETTINGS_PERMISSIONS);
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const held = user.activeMembership?.permissions ?? [];
  const { organization } = await getProfile(user.id, user.activeOrgId);

  if (!organization) {
    return (
      <EmptyState
        icon={BuildingIcon}
        title="No organization"
        description="You are not a member of an organization yet."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <Card>
        <ProfileCardHeader
          title="Organization information"
          stackAction
          action={
            // A full backup of the organization's data (every tenant's NIDA
            // number and emergency contacts included), so it follows the
            // `org:backup` / `org:restore` permissions — the buttons inside
            // check which one each needs.
            held.includes("org:backup") || held.includes("org:restore") ? (
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
          </dl>
        </CardContent>
      </Card>

      {held.includes("org:delete") && (
        <DeleteOrganizationCard
          organization={{ id: organization.id, name: organization.name }}
        />
      )}
    </div>
  );
}
