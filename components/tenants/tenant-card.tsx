"use client";

import { PersonCell } from "@/components/person-cell";
import { TENANT_STATUS_VARIANT } from "@/components/tenants/tenant-columns";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { TenantRow } from "@/lib/tenants";

/**
 * A tenant as one card, for the mobile list.
 *
 * The table's eight columns don't survive being stacked, so this keeps what
 * identifies a person and what you'd act on — name, status, phone, where they
 * live — and drops the rest. Email is omitted deliberately: it is optional for
 * a tenant, frequently absent, and long enough to wrap a 375px card onto three
 * lines when it isn't. The detail page is one tap away for the rest.
 */
export function TenantCard({ tenant }: { tenant: TenantRow }) {
  const { unitLabel, propertyName, status } = tenant;

  // Same rule the table's Unit column uses: neither a Vacated nor an Upcoming
  // tenant is in the unit now, so the placement is marked rather than left to
  // read as a current occupancy.
  const placement =
    unitLabel && propertyName
      ? `${propertyName} / ${unitLabel}${
          status === "Vacated"
            ? " (past)"
            : status === "Upcoming"
              ? " (upcoming)"
              : ""
        }`
      : null;

  return (
    <div className="min-w-0 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <PersonCell name={tenant.name} photoId={tenant.photoId} />
        <Badge
          variant={TENANT_STATUS_VARIANT[status]}
          className="shrink-0 rounded-full font-normal"
        >
          {status}
        </Badge>
      </div>

      <div className="space-y-1 pl-[42px] text-xs text-muted-foreground">
        <p className="truncate">
          {tenant.phone ?? <span className="italic">No phone</span>}
        </p>
        <p className="truncate">
          {placement ?? <span className="italic">No unit</span>}
        </p>
        <p>Joined {formatDate(new Date(tenant.joinedAt))}</p>
      </div>
    </div>
  );
}
