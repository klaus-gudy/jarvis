import { describeActivity, summariseChanges } from "@/lib/activity-format";
import type { Prisma } from "@/lib/generated/prisma/client";
import { invoiceReference } from "@/lib/invoice-types";
import { leaseReference } from "@/lib/leases";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/user-display";

/**
 * Activity timelines, read from `AuditLog`. One query shape serves every page:
 * a record's timeline is the entries whose `subjects` include it (a unit's
 * covers its leases, invoices, payments and files too), and the org-wide feed
 * is every entry, optionally narrowed to some entity types.
 */

/** Types a timeline can be opened for, with the page that shows one. */
export const ACTIVITY_SUBJECT_TYPES = ["Property", "Unit", "Lease", "Membership"] as const;
export type ActivitySubjectType = (typeof ACTIVITY_SUBJECT_TYPES)[number];

/** The payments page's feed. */
export const PAYMENT_ACTIVITY_TYPES: Prisma.ModelName[] = ["Payment", "PaymentClaim", "Invoice"];

export type ActivityLink = { label: string; href: string | null };

/** Serialisable: crosses to the client timeline as JSON. */
export type ActivityItem = {
  id: string;
  at: string;
  title: string;
  /** One short line: the amount and method, the dates, or what an edit changed. */
  detail?: string;
  /** Who did it, or "System" when no member did (automation, or history from before the log). */
  actor: string;
  /** The record it happened to — a payment's invoice, a file's lease — or null when none is left. */
  entity: ActivityLink | null;
};

export type ActivityPage = { items: ActivityItem[]; nextCursor: string | null };

const PAGE_SIZE = 30;

function parseKey(key: string) {
  const at = key.indexOf(":");
  return { type: key.slice(0, at), id: key.slice(at + 1) };
}

export async function getActivity(
  organizationId: string,
  scope: {
    subject?: string;
    types?: Prisma.ModelName[];
    /** Entry types the caller may not see (no `lease:read`, say). */
    exclude?: Prisma.ModelName[];
  },
  page: { cursor?: string | null; limit?: number } = {}
): Promise<ActivityPage> {
  const limit = Math.min(page.limit ?? PAGE_SIZE, 100);
  const rows = await prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(scope.subject ? { subjects: { has: scope.subject } } : {}),
      entityType: {
        ...(scope.types ? { in: scope.types } : {}),
        ...(scope.exclude?.length ? { notIn: scope.exclude } : {}),
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  // Names for everything on the page, in four queries rather than per row.
  const ids = { Property: new Set<string>(), Unit: new Set<string>(), Membership: new Set<string>() };
  for (const row of pageRows) {
    for (const key of row.subjects) {
      const { type, id } = parseKey(key);
      if (type in ids) ids[type as keyof typeof ids].add(id);
    }
  }
  const actorUserIds = [...new Set(pageRows.map((r) => r.actorUserId).filter((id): id is string => !!id))];

  const [properties, units, memberships, actors] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId, id: { in: [...ids.Property] } },
      select: { id: true, name: true },
    }),
    prisma.unit.findMany({
      where: { property: { organizationId }, id: { in: [...ids.Unit] } },
      select: { id: true, label: true, propertyId: true },
    }),
    prisma.membership.findMany({
      where: { organizationId, id: { in: [...ids.Membership] } },
      select: { id: true, user: { select: { name: true, email: true, phone: true } } },
    }),
    prisma.user.findMany({
      where: { id: { in: actorUserIds } },
      select: { id: true, name: true, email: true, phone: true },
    }),
  ]);
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const unitOf = new Map(units.map((u) => [u.id, u]));
  const memberName = new Map(memberships.map((m) => [m.id, displayName(m.user)]));
  const actorName = new Map(actors.map((u) => [u.id, displayName(u)]));

  // A record that no longer exists has no page to link to. `leaseId` is where
  // an invoice or payment lives, as neither has a page of its own.
  function link(key: string, leaseId: string | null): ActivityLink | null {
    const { type, id } = parseKey(key);
    switch (type) {
      case "Property": {
        const name = propertyName.get(id);
        return name ? { label: name, href: `/properties/${id}` } : null;
      }
      case "Unit": {
        const unit = unitOf.get(id);
        return unit
          ? { label: `Unit ${unit.label}`, href: `/properties/${unit.propertyId}/units/${id}` }
          : null;
      }
      case "Lease":
        return { label: `Lease ${leaseReference(id)}`, href: `/leases/${id}` };
      case "Invoice":
        return {
          label: invoiceReference(id),
          href: leaseId ? `/leases/${leaseId}?tab=billing` : null,
        };
      case "Payment":
        return { label: "Payment", href: leaseId ? `/leases/${leaseId}?tab=billing` : null };
      case "Membership": {
        const name = memberName.get(id);
        return name ? { label: name, href: `/members/${id}` } : null;
      }
    }
    return null;
  }

  const items = pageRows.map((row): ActivityItem => {
    const { title, detail } = describeActivity({
      action: row.action,
      entityId: row.entityId,
      changes: row.changes,
    });
    // The nearest record above it (`subjects` runs self, parent, grandparent…);
    // a record with no parent names itself, unless it's the thing deleted.
    const leaseKey = row.subjects.find((key) => key.startsWith("Lease:"));
    const leaseId = leaseKey ? parseKey(leaseKey).id : null;
    const deleted = row.action.endsWith(".deleted") || row.action.endsWith(".removed");
    const candidates = [...row.subjects.slice(1), ...(deleted ? [] : row.subjects.slice(0, 1))];
    const entity =
      candidates.map((key) => link(key, leaseId)).find((value) => value !== null) ?? null;

    return {
      id: row.id,
      at: row.createdAt.toISOString(),
      title,
      detail: detail ?? summariseChanges(row.changes),
      actor: row.actorUserId ? (actorName.get(row.actorUserId) ?? "Former member") : "System",
      entity,
    };
  });

  return { items, nextCursor: hasMore ? pageRows.at(-1)!.id : null };
}
