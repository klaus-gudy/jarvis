import { prisma } from "@/lib/prisma";

/**
 * What "deactivated" means, in one place.
 *
 * An INACTIVE property or unit is kept — its history, leases, payments and
 * files stay readable — but it is out of tracking: it adds nothing to the
 * dashboard or occupancy figures and is never offered when creating a lease.
 * A unit is tracked only when both it *and* its property are ACTIVE, so
 * deactivating a property takes every unit in it out without touching the
 * units' own flags; reactivating the property brings back exactly the units
 * that were active before.
 *
 * Money already received is not filtered: payments and lease totals are
 * history, and a property can only be deactivated once nothing on it is
 * running or upcoming (`countLiveLeases`), so no live figure is lost.
 */

/** `where` for this org's properties that count. */
export function trackedProperty(organizationId: string) {
  return { organizationId, status: "ACTIVE" as const };
}

/**
 * `where` for this org's units that count: active itself, in an active
 * property. A function rather than a fragment to spread, because the org
 * scope and the status both live under `property` and a spread would drop one.
 */
export function trackedUnit(organizationId: string) {
  return { status: "ACTIVE" as const, property: trackedProperty(organizationId) };
}

/**
 * Leases running now or signed to start later, on one property's units or on
 * one unit. While any exist the property or unit can't be deactivated.
 */
export function countLiveLeases(
  organizationId: string,
  scope: { propertyId: string } | { unitId: string }
) {
  return prisma.lease.count({
    where: {
      endDate: { gte: new Date() },
      membership: { organizationId },
      ...("unitId" in scope
        ? { unitId: scope.unitId }
        : { unit: { propertyId: scope.propertyId } }),
    },
  });
}
