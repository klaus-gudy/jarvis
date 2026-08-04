import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { DetailRow, orDash } from "@/components/detail-row";
import { ProfileEditDialog } from "@/components/tenants/profile-edit-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/session";
import { formatCurrencyFull, formatDate } from "@/lib/format";
import { getTenantDetail, type TenantStatus } from "@/lib/tenants";
import { initials } from "@/lib/user-display";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<TenantStatus, string> = {
  Active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Prospect: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Vacated: "bg-muted text-muted-foreground",
};

const STATUS_DOT: Record<TenantStatus, string> = {
  Active: "bg-emerald-500",
  Prospect: "bg-amber-500",
  Vacated: "bg-muted-foreground",
};

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ membershipId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.activeOrgId) redirect("/tenants");

  const { membershipId } = await params;
  const tenant = await getTenantDetail(user.activeOrgId, membershipId);
  if (!tenant) notFound();

  const { profile } = tenant;

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
        nativeButton={false}
        render={<Link href="/tenants" />}
      >
        <ArrowLeftIcon />
        All tenants
      </Button>

      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-12 shrink-0">
            <AvatarFallback className="text-sm">
              {initials(tenant.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-xl font-semibold tracking-tight">
                {tenant.name}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  STATUS_TONE[tenant.status]
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-1.5 rounded-full", STATUS_DOT[tenant.status])}
                />
                {tenant.status}
              </span>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {tenant.roleName} · Joined {formatDate(tenant.joinedAt)}
            </p>
          </div>
          <ProfileEditDialog membershipId={tenant.membershipId} profile={profile} />
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList variant="line" className="w-full justify-start border-b">
          <TabsTrigger value="overview" className="flex-none px-3">
            Overview
          </TabsTrigger>
          <TabsTrigger value="leases" className="flex-none gap-2 px-3">
            Lease
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
              {tenant.leases.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 pt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Tenant details</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <dl>
                  <DetailRow label="Full name" value={tenant.name} />
                  <DetailRow label="Phone" value={orDash(tenant.phone)} />
                  <DetailRow label="Email" value={orDash(tenant.email)} />
                  <DetailRow label="Role" value={tenant.roleName} />
                  <DetailRow
                    label="Date joined"
                    value={formatDate(tenant.joinedAt)}
                  />
                  <DetailRow
                    label="Portal access"
                    value={tenant.canSignIn ? "Can sign in" : "Not invited yet"}
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
                </dl>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Emergency contact</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <dl className="md:grid md:grid-cols-3 md:[&>*:nth-last-child(-n+3)]:border-b-0">
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
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Leases</CardTitle>
            </CardHeader>
            <CardContent className={tenant.leases.length === 0 ? undefined : "p-0"}>
              {tenant.leases.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  This tenant has no leases yet.
                </p>
              ) : (
                <ul>
                  {tenant.leases.map((lease) => (
                    <li
                      key={lease.id}
                      className="border-b last:border-b-0 hover:bg-muted/40"
                    >
                      <Link
                        href={`/leases/${lease.id}`}
                        className="flex items-center justify-between gap-4 px-6 py-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {lease.propertyName} · {lease.unitLabel}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDate(lease.startDate)} –{" "}
                            {formatDate(lease.endDate)} · {lease.durationMonths}{" "}
                            months · {lease.status}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono tabular-nums">
                          {formatCurrencyFull(lease.leaseAmount)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
