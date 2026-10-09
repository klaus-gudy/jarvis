"use client";

import { LeaseHoverCard } from "@/components/hover-cards/lease-hover-card";
import { TenantHoverCard } from "@/components/hover-cards/tenant-hover-card";
import { ExpiryTag } from "@/components/leases/expiry-tag";
import { PersonCell } from "@/components/person-cell";
import { formatDate } from "@/lib/format";
import { lastDayOf } from "@/lib/dates";
import type { UnitListRow, UnitOccupant } from "@/lib/units";

/**
 * Where a lease stands, in one line: "until" while it runs, "ended" once it
 * has. Dates are the last day, never the stored exclusive end.
 */
export function occupantTerm(unit: UnitListRow) {
  if (!unit.occupant) return null;
  const end = formatDate(lastDayOf(unit.occupant.endDate));
  return unit.status === "Occupied" ? `Until ${end}` : `Ended ${end}`;
}

/** "Next: Asha from 1 Jan 2027", or "Renews 1 Jan 2027" for the same tenant. */
export function nextTerm(unit: UnitListRow) {
  if (!unit.next) return null;
  const start = formatDate(new Date(unit.next.startDate));
  return unit.next.membershipId === unit.occupant?.membershipId &&
    unit.status === "Occupied"
    ? `Renews ${start}`
    : `Next: ${unit.next.tenantName} from ${start}`;
}

/**
 * The Units page's answer to "who is in it": the running lease's tenant and
 * end date, or — for a vacant unit — who was last in it and when they left.
 * The leases page lists every term; this shows one per unit.
 */
export function UnitOccupancy({
  unit,
  canReadTenants,
  canReadLeases,
}: {
  unit: UnitListRow;
  /** Each name and reference links only when its page would open. */
  canReadTenants: boolean;
  canReadLeases: boolean;
}) {
  const { occupant } = unit;
  const next = nextTerm(unit);

  if (!occupant) {
    return (
      <div className="leading-tight">
        <span className="text-muted-foreground italic">Never let</span>
        {next && <p className="text-xs text-muted-foreground">{next}</p>}
      </div>
    );
  }

  const current = unit.status === "Occupied";

  return (
    <div className={current ? undefined : "opacity-70"}>
      <PersonCell name={occupant.tenantName} photoId={occupant.photoId}>
        <div className="leading-tight">
          <TenantHoverCard
            tenant={tenantPreview(unit, occupant)}
            href={canReadTenants ? `/members/${occupant.membershipId}` : null}
            className="hover:underline"
            align="start"
          />
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-normal text-muted-foreground">
            <LeaseHoverCard
              lease={{ ...occupant, subtitle: occupant.tenantName }}
              href={canReadLeases ? `/leases/${occupant.leaseId}` : null}
              className="font-mono hover:text-foreground hover:underline"
              align="start"
            />
            <span aria-hidden>·</span>
            <span>{occupantTerm(unit)}</span>
            <ExpiryTag expiry={occupant.expiry} />
          </div>
          {next && (
            <p className="text-xs font-normal text-muted-foreground">{next}</p>
          )}
        </div>
      </PersonCell>
    </div>
  );
}

function tenantPreview(unit: UnitListRow, occupant: UnitOccupant) {
  return {
    name: occupant.tenantName,
    phone: occupant.tenantPhone,
    email: occupant.tenantEmail,
    photoId: occupant.photoId,
    context: `Unit ${unit.label} · ${unit.propertyName}`,
  };
}
