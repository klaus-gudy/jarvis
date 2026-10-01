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

/** `Type:id` — how an `AuditLog.subjects` entry names a record. */
export const subjectKey = (type: Prisma.ModelName, id: string) => `${type}:${id}`;

/**
 * The foreign keys that make a record part of a bigger one: a payment belongs
 * to its invoice, the invoice to its lease, the lease to its unit and tenant,
 * the unit to its property. Followed upward so a single log entry is findable
 * from every timeline it belongs on. Types not listed belong to nothing but
 * themselves (roles, templates, the organization).
 */
export const PARENTS: Partial<Record<Prisma.ModelName, [field: string, type: Prisma.ModelName][]>> = {
  Payment: [["invoiceId", "Invoice"]],
  PaymentClaim: [["invoiceId", "Invoice"]],
  Invoice: [["leaseId", "Lease"]],
  Lease: [
    ["unitId", "Unit"],
    ["membershipId", "Membership"],
  ],
  Unit: [["propertyId", "Property"]],
  MemberProfile: [["membershipId", "Membership"]],
  PaymentAccount: [["membershipId", "Membership"]],
  FileAsset: [
    ["propertyId", "Property"],
    ["unitId", "Unit"],
    ["membershipId", "Membership"],
    ["leaseId", "Lease"],
    ["invoiceId", "Invoice"],
    ["paymentId", "Payment"],
  ],
};

type Finder = {
  findUnique(args: {
    where: { id: string };
    select: Record<string, true>;
  }): Promise<Record<string, unknown> | null>;
};

/** Prisma's delegate key for a model: `PaymentClaim` → `paymentClaim`. */
const delegate = (db: Db, type: Prisma.ModelName) =>
  (db as unknown as Record<string, Finder>)[type[0].toLowerCase() + type.slice(1)];

/**
 * Ids `value` names: a plain id, or both sides of a `diff` pair — a lease moved
 * to another unit belongs on the old unit's timeline as well as the new one's.
 */
function ids(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

/**
 * `entity` and every record above it, as `subjectKey`s. Reads the row through
 * `db` for its parent keys; when the row is already gone (a delete logs after
 * deleting), `hint` — the entry's `changes`, a snapshot holding those same
 * keys — stands in. Parents are only ever read, so this is the same few
 * primary-key lookups at any depth.
 */
export async function resolveSubjects(
  db: Db,
  type: Prisma.ModelName,
  id: string,
  hint?: Record<string, unknown> | null,
  seen = new Set<string>()
): Promise<string[]> {
  const key = subjectKey(type, id);
  if (seen.has(key)) return [];
  seen.add(key);

  const parents = PARENTS[type];
  if (!parents) return [key];

  const select = Object.fromEntries(parents.map(([field]) => [field, true as const]));
  const row = (await delegate(db, type).findUnique({ where: { id }, select })) ?? hint ?? {};

  const keys = [key];
  for (const [field, parentType] of parents) {
    for (const parentId of ids(row[field])) {
      // A live row says nothing about the other side of a moved key; the diff does.
      keys.push(...(await resolveSubjects(db, parentType, parentId, null, seen)));
    }
    if (row !== hint && hint) {
      for (const parentId of ids(hint[field])) {
        keys.push(...(await resolveSubjects(db, parentType, parentId, null, seen)));
      }
    }
  }
  return keys;
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
  const subjects = await resolveSubjects(
    db,
    entry.entityType,
    entry.entityId,
    entry.changes ?? null
  );
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
      subjects,
    },
  });
}
