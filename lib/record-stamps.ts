import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/user-display";

/** "Created by / last edited by" for a detail page's header. */
export type RecordStamps = {
  createdAt: Date;
  /** Null when no member is on record — a system write, or a row from before 2026-10-01. */
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
};

type Stamped = {
  createdAt: Date;
  updatedAt: Date;
  createdBy: { user: { name: string | null; email: string | null; phone: string | null } } | null;
  updatedBy: { user: { name: string | null; email: string | null; phone: string | null } } | null;
};

const actor = { select: { user: { select: { name: true, email: true, phone: true } } } };
const select = { createdAt: true, updatedAt: true, createdBy: actor, updatedBy: actor } as const;

/**
 * Read separately from each page's own query, so the four detail getters keep
 * their shapes. Scoped to the organization like those getters are.
 */
export async function getRecordStamps(
  organizationId: string,
  type: "Property" | "Unit" | "Lease" | "Membership",
  id: string
): Promise<RecordStamps | null> {
  let row: Stamped | null = null;
  switch (type) {
    case "Property":
      row = await prisma.property.findFirst({ where: { id, organizationId }, select });
      break;
    case "Unit":
      row = await prisma.unit.findFirst({ where: { id, property: { organizationId } }, select });
      break;
    case "Lease":
      row = await prisma.lease.findFirst({ where: { id, membership: { organizationId } }, select });
      break;
    case "Membership":
      row = await prisma.membership.findFirst({ where: { id, organizationId }, select });
      break;
  }
  if (!row) return null;
  return {
    createdAt: row.createdAt,
    createdBy: row.createdBy ? displayName(row.createdBy.user) : null,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy ? displayName(row.updatedBy.user) : null,
  };
}
