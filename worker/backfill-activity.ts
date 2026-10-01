import "dotenv/config";

import { PARENTS, resolveSubjects, snapshot, subjectKey } from "@/lib/audit";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Gives the Activity timelines a past.
 *
 * `AuditLog` started on 2026-10-01; everything before that exists only as rows
 * with timestamps. This writes one log entry per thing those timestamps prove
 * happened — a property, unit, lease, invoice or member was created, a payment
 * recorded, a claim submitted or reviewed, a file uploaded, a lease ended —
 * dated when it happened, with `source: "backfill"`. Edits and deletions from
 * before the log aren't recoverable, so they aren't invented.
 *
 * Then a second pass fills `subjects` on log rows written before that column
 * existed.
 *
 *   npm run activity:backfill -- --dry-run
 *   npm run activity:backfill -- --org=<organizationId>
 *
 * Safe to run twice: an `(action, entity)` pair already in the log is skipped,
 * whether the backfill or the live app wrote it.
 */

function flag(name: string) {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : undefined;
}

type Row = Record<string, unknown> & { id: string };

type Draft = {
  action: string;
  entityType: Prisma.ModelName;
  entity: Row;
  at: Date;
  actorMembershipId?: string | null;
  changes?: Record<string, unknown>;
};

async function backfillOrganization(organizationId: string, dryRun: boolean) {
  const [properties, memberships, fileAssets] = await Promise.all([
    prisma.property.findMany({ where: { organizationId } }),
    prisma.membership.findMany({ where: { organizationId } }),
    prisma.fileAsset.findMany({ where: { organizationId } }),
  ]);
  const units = await prisma.unit.findMany({
    where: { propertyId: { in: properties.map((p) => p.id) } },
  });
  const leases = await prisma.lease.findMany({
    where: { unitId: { in: units.map((u) => u.id) } },
  });
  const invoices = await prisma.invoice.findMany({
    where: { leaseId: { in: leases.map((l) => l.id) } },
  });
  const invoiceIds = invoices.map((i) => i.id);
  const [payments, claims] = await Promise.all([
    prisma.payment.findMany({ where: { invoiceId: { in: invoiceIds } } }),
    prisma.paymentClaim.findMany({ where: { invoiceId: { in: invoiceIds } } }),
  ]);

  // Every loaded row by `Type:id`, so subjects resolve without a query each.
  const rows = new Map<string, Row>();
  const index = (type: Prisma.ModelName, list: Row[]) =>
    list.forEach((row) => rows.set(subjectKey(type, row.id), row));
  index("Property", properties);
  index("Membership", memberships);
  index("FileAsset", fileAssets);
  index("Unit", units);
  index("Lease", leases);
  index("Invoice", invoices);
  index("Payment", payments);
  index("PaymentClaim", claims);

  function subjectsOf(type: Prisma.ModelName, id: string, seen = new Set<string>()): string[] {
    const key = subjectKey(type, id);
    if (seen.has(key)) return [];
    seen.add(key);
    const row = rows.get(key);
    const keys = [key];
    for (const [field, parentType] of PARENTS[type] ?? []) {
      const parentId = row?.[field];
      if (typeof parentId === "string") keys.push(...subjectsOf(parentType, parentId, seen));
    }
    return keys;
  }

  const userOf = new Map(memberships.map((m) => [m.id, m.userId]));
  const now = new Date();

  const drafts: Draft[] = [
    ...properties.map((p) => ({
      action: "property.created",
      entityType: "Property" as const,
      entity: p,
      at: p.createdAt,
      actorMembershipId: p.createdById,
    })),
    ...units.map((u) => ({
      action: "unit.created",
      entityType: "Unit" as const,
      entity: u,
      at: u.createdAt,
      actorMembershipId: u.createdById,
    })),
    ...memberships.map((m) => ({
      action: "member.joined",
      entityType: "Membership" as const,
      entity: m,
      at: m.createdAt,
      actorMembershipId: m.createdById,
    })),
    ...leases.map((l) => ({
      action: l.renewedFromId ? "lease.renewed" : "lease.created",
      entityType: "Lease" as const,
      entity: l,
      at: l.createdAt,
      actorMembershipId: l.createdById,
    })),
    // The status says it ended; the end date says when.
    ...leases
      .filter((l) => (l.status === "Ended" || l.status === "Renewed") && l.endDate <= now)
      .map((l) => ({
        action: "lease.ended",
        entityType: "Lease" as const,
        entity: l,
        at: l.endDate,
        changes: { status: [null, l.status] },
      })),
    ...invoices.map((i) => ({
      action: "invoice.created",
      entityType: "Invoice" as const,
      entity: i,
      at: i.createdAt,
      actorMembershipId: i.createdById,
    })),
    ...payments.map((p) => ({
      action: "payment.recorded",
      entityType: "Payment" as const,
      entity: p,
      at: p.createdAt,
      actorMembershipId: p.createdById,
    })),
    ...claims.map((c) => ({
      action: "payment_claim.submitted",
      entityType: "PaymentClaim" as const,
      entity: c,
      at: c.createdAt,
      actorMembershipId: c.membershipId,
    })),
    ...claims
      .filter((c) => c.reviewedAt && c.status !== "PENDING")
      .map((c) => ({
        action: c.status === "CONFIRMED" ? "payment_claim.confirmed" : "payment_claim.rejected",
        entityType: "PaymentClaim" as const,
        entity: c,
        at: c.reviewedAt!,
        actorMembershipId: c.reviewedById,
      })),
    ...fileAssets.map((f) => ({
      action: "document.uploaded",
      entityType: "FileAsset" as const,
      entity: f,
      at: f.createdAt,
      actorMembershipId: f.uploadedById,
    })),
  ];

  const logged = await prisma.auditLog.findMany({
    where: { organizationId },
    select: { action: true, entityId: true },
  });
  const done = new Set(logged.map((row) => `${row.action}:${row.entityId}`));
  const fresh = drafts.filter((d) => !done.has(`${d.action}:${d.entity.id}`));

  const data: Prisma.AuditLogCreateManyInput[] = fresh.map((d) => {
    const actor = d.actorMembershipId ?? null;
    return {
      organizationId,
      action: d.action,
      entityType: d.entityType,
      entityId: d.entity.id,
      actorMembershipId: actor,
      actorUserId: actor ? (userOf.get(actor) ?? null) : null,
      source: "backfill",
      changes: (d.changes ?? snapshot(d.entity)) as Prisma.InputJsonValue,
      subjects: subjectsOf(d.entityType, d.entity.id),
      createdAt: d.at,
    };
  });

  // Rows the live app wrote before `subjects` existed.
  const untagged = await prisma.auditLog.findMany({
    where: { organizationId, subjects: { isEmpty: true } },
    select: { id: true, entityType: true, entityId: true, changes: true },
  });

  const counts = new Map<string, number>();
  for (const row of data) counts.set(row.action, (counts.get(row.action) ?? 0) + 1);
  const summary = [...counts].map(([action, n]) => `${action} ${n}`).join(", ") || "nothing";
  console.log(`[activity] ${organizationId}: ${summary}; ${untagged.length} row(s) to tag`);

  if (dryRun) return data.length;

  for (let i = 0; i < data.length; i += 500) {
    await prisma.auditLog.createMany({ data: data.slice(i, i + 500) });
  }
  for (const row of untagged) {
    const subjects = await resolveSubjects(
      prisma,
      row.entityType as Prisma.ModelName,
      row.entityId,
      (row.changes ?? null) as Record<string, unknown> | null
    );
    await prisma.auditLog.update({ where: { id: row.id }, data: { subjects } });
  }
  return data.length;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const only = flag("org");
  const organizations = await prisma.organization.findMany({
    where: only ? { id: only } : undefined,
    select: { id: true },
  });
  if (only && organizations.length === 0) {
    console.error(`[activity] no organization ${only}`);
    process.exit(1);
  }

  let total = 0;
  for (const { id } of organizations) total += await backfillOrganization(id, dryRun);
  console.log(
    dryRun
      ? `[activity] --dry-run, ${total} entr${total === 1 ? "y" : "ies"} would be written`
      : `[activity] wrote ${total} entr${total === 1 ? "y" : "ies"}`
  );
}

main()
  .catch((error) => {
    console.error("[activity] failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
