import { formatCurrency } from "@/lib/format";
import { leaseReference } from "@/lib/leases";
import { prisma } from "@/lib/prisma";
import { TENANT_ROLE_NAME } from "@/lib/roles";
import { MIN_QUERY_LENGTH, type SearchResult } from "@/lib/search-types";
import { displayName } from "@/lib/user-display";

/** Per type, so one crowded type can't push the others off the list. */
const PER_TYPE_LIMIT = 5;

/**
 * Leases have no reference column — `leaseReference` derives "L-AB12C" from the
 * tail of the cuid. To search by the reference a user can see, strip the
 * prefix and match the id's suffix. cuids are lowercase, the reference is
 * shown uppercase, hence the fold.
 */
function leaseIdSuffix(query: string): string | null {
  const stripped = query.trim().replace(/^l-/i, "").toLowerCase();
  if (stripped.length < 3) return null;
  if (!/^[a-z0-9]+$/.test(stripped)) return null;
  return stripped;
}

/**
 * One search across everything the organization owns.
 *
 * Every branch is scoped by organizationId, and leases additionally through
 * both the membership and the unit's property — the same double scoping the
 * lease queries use, so a cross-org row can't surface here either.
 */
export async function searchOrganization(
  organizationId: string,
  query: string
): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const contains = { contains: q, mode: "insensitive" as const };
  const suffix = leaseIdSuffix(q);
  const now = new Date();

  const [properties, units, tenants, leases] = await Promise.all([
    prisma.property.findMany({
      where: {
        organizationId,
        OR: [{ name: contains }, { address: contains }, { category: contains }],
      },
      orderBy: { name: "asc" },
      take: PER_TYPE_LIMIT,
      select: { id: true, name: true, address: true, category: true },
    }),

    prisma.unit.findMany({
      where: {
        property: { organizationId },
        OR: [{ label: contains }, { unitType: contains }],
      },
      orderBy: { label: "asc" },
      take: PER_TYPE_LIMIT,
      select: {
        id: true,
        label: true,
        rentAmount: true,
        unitType: true,
        property: { select: { id: true, name: true } },
      },
    }),

    prisma.membership.findMany({
      where: {
        organizationId,
        role: { name: { equals: TENANT_ROLE_NAME, mode: "insensitive" } },
        user: {
          OR: [{ name: contains }, { email: contains }, { phone: contains }],
        },
      },
      orderBy: { createdAt: "desc" },
      take: PER_TYPE_LIMIT,
      select: {
        id: true,
        user: { select: { name: true, email: true, phone: true } },
      },
    }),

    prisma.lease.findMany({
      where: {
        membership: { organizationId },
        unit: { property: { organizationId } },
        OR: [
          { unit: { label: contains } },
          { unit: { property: { name: contains } } },
          {
            membership: {
              user: {
                OR: [{ name: contains }, { email: contains }, { phone: contains }],
              },
            },
          },
          // Only added when the query could plausibly be a reference, so a
          // short word doesn't scan every lease id.
          ...(suffix ? [{ id: { endsWith: suffix } }] : []),
        ],
      },
      orderBy: { startDate: "desc" },
      take: PER_TYPE_LIMIT,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        unit: { select: { label: true, property: { select: { name: true } } } },
        membership: {
          select: { user: { select: { name: true, email: true, phone: true } } },
        },
      },
    }),
  ]);

  return [
    ...properties.map((property) => ({
      key: `property-${property.id}`,
      type: "property" as const,
      title: property.name,
      subtitle: `${property.category} · ${property.address}`,
      meta: null,
      href: `/properties/${property.id}`,
    })),

    ...units.map((unit) => ({
      key: `unit-${unit.id}`,
      type: "unit" as const,
      title: `${unit.property.name} / ${unit.label}`,
      subtitle: unit.unitType ?? "Unit",
      meta: `${formatCurrency(unit.rentAmount)}/mo`,
      // No unit detail route — the property's Units tab is where a unit lives.
      href: `/properties/${unit.property.id}`,
    })),

    ...tenants.map((membership) => ({
      key: `tenant-${membership.id}`,
      type: "tenant" as const,
      title: displayName(membership.user),
      subtitle: membership.user.phone ?? membership.user.email ?? "No contact",
      meta: null,
      href: `/members/${membership.id}`,
    })),

    ...leases.map((lease) => {
      const status =
        lease.startDate > now
          ? "Upcoming"
          : lease.endDate < now
            ? "Ended"
            : "Active";

      return {
        key: `lease-${lease.id}`,
        type: "lease" as const,
        title: displayName(lease.membership.user),
        subtitle: `${lease.unit.property.name} / ${lease.unit.label} · ${status}`,
        meta: leaseReference(lease.id),
        href: `/leases/${lease.id}`,
      };
    }),
  ];
}
