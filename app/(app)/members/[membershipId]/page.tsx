import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { DetailRow, orDash } from "@/components/detail-row";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { ProfilePhotoAvatar } from "@/components/documents/profile-photo-avatar";
import { MemberLeasesTab } from "@/components/members/member-leases-tab";
import { MemberPaymentsTab } from "@/components/members/member-payments-tab";
import { MemberSmsTab } from "@/components/members/member-sms-tab";
import { ProfileEditDialog } from "@/components/tenants/profile-edit-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/session";
import { listAssetTypes } from "@/lib/asset-types";
import { listDocuments } from "@/lib/documents";
import { formatDate } from "@/lib/format";
import { getLeaseOptions } from "@/lib/leases";
import { getPayments } from "@/lib/payments";
import { TENANT_ROLE_NAME } from "@/lib/roles";
import { getTenantDetail, type TenantStatus } from "@/lib/tenants";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<TenantStatus, string> = {
  Active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Upcoming: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  Prospect: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Vacated: "bg-muted text-muted-foreground",
};

const STATUS_DOT: Record<TenantStatus, string> = {
  Active: "bg-emerald-500",
  Upcoming: "bg-sky-500",
  Prospect: "bg-amber-500",
  Vacated: "bg-muted-foreground",
};

/**
 * Detail view for any member of the organization, not just tenants — it is
 * reached from both the Tenants and the Users table. The route is deliberately
 * role-neutral: an Owner sitting under /tenants/... read as though they had
 * somehow become a tenant.
 */
export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.activeOrgId) redirect("/users");

  const { membershipId } = await params;
  const member = await getTenantDetail(user.activeOrgId, membershipId);
  if (!member) notFound();

  const { profile } = member;

  // Send people back where the member is actually listed.
  const isTenant =
    member.roleName.toLowerCase() === TENANT_ROLE_NAME.toLowerCase();
  const backHref = isTenant ? "/tenants" : "/users";
  const backLabel = isTenant ? "All tenants" : "All users";

  // Only tenants can hold a lease, so only they need the create form's data.
  const leaseOptions = isTenant ? await getLeaseOptions(user.activeOrgId) : null;

  // Every member can hold documents, tenant or not — a caretaker's contract is
  // as much a record as a tenant's NIDA.
  //
  // Payments are fetched for every member for the same reason the Lease tab is
  // shown to every member: a non-tenant simply has none, and the tab says so
  // rather than disappearing and leaving the reader to wonder where it went.
  const [assets, assetTypes, payments] = await Promise.all([
    listDocuments(user.activeOrgId, "MEMBERSHIP", member.membershipId),
    listAssetTypes(user.activeOrgId, "MEMBERSHIP"),
    getPayments(user.activeOrgId, member.membershipId),
  ]);

  // The profile photo is a `FileAsset` like any other, but it isn't a
  // "document" the Documents tab should list or offer as a type to pick —
  // it has its own entry point on the avatar above. Split here, the same way
  // the property page separates its Images tab from its Documents tab.
  const documents = assets.filter((asset) => !asset.assetType.isPhoto);
  const profilePhoto = assets.find((asset) => asset.assetType.isPhoto) ?? null;
  const documentAssetTypes = assetTypes.filter((type) => !type.isPhoto);
  const profilePhotoTypeId =
    assetTypes.find((type) => type.isPhoto)?.id ?? null;

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        className="w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href={backHref} />}
      >
        <ArrowLeftIcon />
        {backLabel}
      </Button>

      <Card>
        <CardContent className="flex items-center gap-4">
          <ProfilePhotoAvatar
            membershipId={member.membershipId}
            name={member.name}
            photoId={profilePhoto?.id ?? null}
            assetTypeId={profilePhotoTypeId}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-xl font-semibold tracking-tight">
                {member.name}
              </h2>
              {/* Occupancy status only describes tenants — an Owner showing
                  "Prospect" just meant "has never held a lease". */}
              {isTenant && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    STATUS_TONE[member.status]
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      STATUS_DOT[member.status]
                    )}
                  />
                  {member.status}
                </span>
              )}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {member.roleName} · Joined {formatDate(member.joinedAt)}
            </p>
          </div>
          <ProfileEditDialog membershipId={member.membershipId} profile={profile} />
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="overview" className="flex-none px-3">
            Overview
          </TabsTrigger>
          <TabsTrigger value="leases" className="flex-none gap-2 px-3">
            Lease
            {/* Hidden at zero — a "0" beside a tab reads as a problem rather
                than as a total, same as the Billing and Users tabs. */}
            {member.leases.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {member.leases.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex-none gap-2 px-3">
            Payments
            {payments.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {payments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex-none gap-2 px-3">
            Documents
            {documents.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                {documents.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex-none px-3">
            SMS alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 pt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Member details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl>
                  <DetailRow label="Full name" value={member.name} />
                  <DetailRow label="Phone" value={orDash(member.phone)} />
                  <DetailRow label="Email" value={orDash(member.email)} />
                  <DetailRow label="Role" value={member.roleName} />
                  <DetailRow
                    label="Date joined"
                    value={formatDate(member.joinedAt)}
                  />
                  <DetailRow
                    label="Portal access"
                    value={member.canSignIn ? "Can sign in" : "Not invited yet"}
                  />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Additional details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl>
                  <DetailRow label="Occupation" value={orDash(profile.occupation)} />
                  <DetailRow label="Employer" value={orDash(profile.employer)} />
                  <DetailRow
                    label="NIDA number"
                    value={
                      profile.nidaNumber ? (
                        <span className="font-mono">{profile.nidaNumber}</span>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailRow
                    label="Nationality"
                    value={orDash(profile.nationality)}
                  />
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Emergency contact</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="md:grid md:grid-cols-3 md:[&>*:nth-last-child(-n+3)]:after:hidden">
                <DetailRow
                  label="Name"
                  value={orDash(profile.emergencyContactName)}
                />
                <DetailRow
                  label="Relation"
                  value={orDash(profile.emergencyContactRelation)}
                />
                <DetailRow
                  label="Phone"
                  value={orDash(profile.emergencyContactPhone)}
                />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leases" className="pt-5">
          <MemberLeasesTab
            leases={member.leases.map((lease) => ({
              id: lease.id,
              reference: lease.reference,
              propertyName: lease.propertyName,
              unitLabel: lease.unitLabel,
              // Dates must be serialisable to cross the server/client boundary.
              startDate: lease.startDate.toISOString(),
              endDate: lease.endDate.toISOString(),
              durationMonths: lease.durationMonths,
              leaseAmount: lease.leaseAmount,
              status: lease.status,
              expiry: lease.expiry,
            }))}
            membershipId={member.membershipId}
            isTenant={isTenant}
            roleName={member.roleName}
            options={leaseOptions}
          />
        </TabsContent>

        <TabsContent value="payments" className="pt-5">
          {/* `PaymentRow` is already serialisable — `getPayments` returns
              `paidAt` as an ISO string — so the rows cross to the client as
              they are. */}
          <MemberPaymentsTab
            payments={payments}
            isTenant={isTenant}
            roleName={member.roleName}
          />
        </TabsContent>

        <TabsContent value="documents" className="pt-5">
          <DocumentsPanel
            subjectType="MEMBERSHIP"
            subjectId={member.membershipId}
            assetTypes={documentAssetTypes}
            emptyMessage="No documents yet. Upload a NIDA card, passport or employment letter to keep it on file."
            documents={documents.map((document) => ({
              ...document,
              // Dates must be serialisable to cross the server/client boundary.
              createdAt: document.createdAt.toISOString(),
            }))}
          />
        </TabsContent>

        <TabsContent value="sms" className="pt-5">
          {/* Mounted only while open (base-ui unmounts inactive panels), so
              notifier is asked only when someone looks. */}
          <MemberSmsTab membershipId={member.membershipId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
