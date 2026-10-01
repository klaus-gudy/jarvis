import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Who performed a write. A route passes its `AuthContext` straight through —
 * it has both ids, so it fits without conversion. Writes no member made (queue
 * consumers, imports run as a script) use `systemActor`.
 */
export type Actor = {
  membershipId: string | null;
  userId: string | null;
  source?: string;
};

export const systemActor = (source: string): Actor => ({
  membershipId: null,
  userId: null,
  source,
});

/** Spread into a create's `data`: the creator is also the last editor. */
export const createdBy = (actor: Actor) => ({
  createdById: actor.membershipId,
  updatedById: actor.membershipId,
});

/** Spread into an update's `data`. A system write clears it on purpose. */
export const updatedBy = (actor: Actor) => ({ updatedById: actor.membershipId });

type Db = Prisma.TransactionClient | typeof prisma;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function toJson(value: unknown): JsonValue {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, toJson(inner)])
    );
  }
  return value as JsonValue;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(toJson(a)) === JSON.stringify(toJson(b));

/**
 * `{ field: [before, after] }` for every key of `input` whose value differs
 * from `before`. Keys `input` leaves undefined weren't part of the edit.
 */
export function diff(before: object, input: object) {
  const old = before as Record<string, unknown>;
  const changes: Record<string, [JsonValue, JsonValue]> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || same(old[key], value)) continue;
    changes[key] = [toJson(old[key]), toJson(value)];
  }
  return changes;
}

/** Columns never worth repeating in a log entry. */
const NOISE = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "createdById",
  "updatedById",
  "organizationId",
  "passwordHash",
  "tokenHash",
  // Prisma's relation counts, when a row was read with `include: { _count }`.
  "_count",
]);

/** A row's own values, for a create or delete entry. */
export function snapshot(row: object) {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !NOISE.has(key))
      .map(([key, value]) => [key, toJson(value)])
  );
}

export type AuditEntry = {
  organizationId: string;
  actor: Actor;
  /** `<entity>.<verb>` in snake case: `lease.created`, `member.role_changed`. */
  action: string;
  entityType: Prisma.ModelName;
  entityId: string;
  changes?: Record<string, unknown> | null;
};

/**
 * Appends to `AuditLog`. Pass the transaction the change runs in, so the entry
 * and the change commit or roll back together. An update that changed nothing
 * logs nothing.
 */
export async function audit(db: Db, entry: AuditEntry) {
  if (entry.changes && Object.keys(entry.changes).length === 0) return;
  await db.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorMembershipId: entry.actor.membershipId,
      actorUserId: entry.actor.userId,
      source: entry.actor.source ?? null,
      changes: entry.changes ? (toJson(entry.changes) as Prisma.InputJsonValue) : undefined,
    },
  });
}
