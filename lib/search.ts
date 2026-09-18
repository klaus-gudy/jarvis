import { formatCurrency, formatDayMonth } from "@/lib/format";
import { invoiceReference } from "@/lib/invoice-types";
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
function referenceSuffix(query: string, prefix: RegExp): string | null {
  const stripped = query.trim().replace(prefix, "").toLowerCase();
  if (stripped.length < 3) return null;
  if (!/^[a-z0-9]+$/.test(stripped)) return null;
  return stripped;
}

const leaseIdSuffix = (query: string) => referenceSuffix(query, /^l-/i);

/**
 * Same idea for `invoiceReference`'s "INV-9VNQV". The two can't collide: a
 * query still carrying the other prefix keeps its hyphen after the strip and
 * fails the alphanumeric test, so "INV-ABC" is never matched against lease ids.
 */
const invoiceIdSuffix = (query: string) => referenceSuffix(query, /^inv-/i);

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
  const invoiceSuffix = invoiceIdSuffix(q);

  const [properties, units, tenants, users, leases, payments] = await Promise.all([
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

    // Everyone who isn't a tenant — Owner, Manager, Caretaker. Exactly the
    // complement of the branch above, so a member surfaces once, under the
    // heading that describes what they actually are.
    prisma.membership.findMany({
      where: {
        organizationId,
        // NOT at this level, not `name: { not: ... }` — Prisma rejects `mode`
        // inside a nested `not`, and Role is a required relation so this is
        // an exact complement of the tenant branch.
        NOT: {
          role: { name: { equals: TENANT_ROLE_NAME, mode: "insensitive" } },
        },
        user: {
          OR: [{ name: contains }, { email: contains }, { phone: contains }],
        },
      },
      orderBy: { createdAt: "desc" },
      take: PER_TYPE_LIMIT,
      select: {
        id: true,
        role: { select: { name: true } },
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
        status: true,
        endDate: true,
        unit: { select: { label: true, property: { select: { name: true } } } },
        membership: {
          select: { user: { select: { name: true, email: true, phone: true } } },
        },
      },
    }),

    // Scoped through the invoice's lease with the same double filter every
    // other lease query uses — the membership's org *and* the unit's property's
    // org — so a payment can't surface from a lease that crosses organizations.
    prisma.payment.findMany({
      where: {
        invoice: {
          lease: {
            membership: { organizationId },
            unit: { property: { organizationId } },
          },
        },
        OR: [
          { method: contains },
          {
            invoice: {
              lease: {
                membership: {
                  user: {
                    OR: [
                      { name: contains },
                      { email: contains },
                      { phone: contains },
                    ],
                  },
                },
              },
            },
          },
          // Same guard as the lease reference: only scan ids when the query
          // could actually be one.
          ...(invoiceSuffix
            ? [{ invoice: { id: { endsWith: invoiceSuffix } } }]
            : []),
        ],
      },
      orderBy: { paidAt: "desc" },
      take: PER_TYPE_LIMIT,
      select: {
        id: true,
        amount: true,
        method: true,
        paidAt: true,
        invoice: {
          select: {
            id: true,
            leaseId: true,
            lease: {
              select: {
                membership: {
                  select: {
                    user: { select: { name: true, email: true, phone: true } },
                  },
                },
              },
            },
          },
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

    ...users.map((membership) => ({
      key: `user-${membership.id}`,
      type: "user" as const,
      title: displayName(membership.user),
      // Role first: when looking someone up, what they can do is the point.
      subtitle: `${membership.role.name} · ${
        membership.user.phone ?? membership.user.email ?? "No contact"
      }`,
      meta: null,
      href: `/members/${membership.id}`,
    })),

    ...leases.map((lease) => {
      const status = lease.status;

      return {
        key: `lease-${lease.id}`,
        type: "lease" as const,
        title: displayName(lease.membership.user),
        subtitle: `${lease.unit.property.name} / ${lease.unit.label} · ${status}`,
        meta: leaseReference(lease.id),
        href: `/leases/${lease.id}`,
      };
    }),

    ...payments.map((payment) => ({
      key: `payment-${payment.id}`,
      type: "payment" as const,
      title: displayName(payment.invoice.lease.membership.user),
      // Which invoice it settled, how it was paid, and when — the three things
      // that tell one payment from another by the same tenant.
      subtitle: `${invoiceReference(payment.invoice.id)} · ${
        payment.method ?? "Payment"
      } · ${formatDayMonth(payment.paidAt)}`,
      meta: formatCurrency(payment.amount),
      // There is no payment detail route; the payments table's own rows open
      // the parent lease, so this goes to the same place.
      href: `/leases/${payment.invoice.leaseId}`,
    })),
  ];
}
