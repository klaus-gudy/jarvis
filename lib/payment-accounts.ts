import { prisma } from "@/lib/prisma";
import type { PaymentAccountTypeValue } from "@/lib/payment-account-options";
import type { PaymentAccountInput } from "@/lib/payment-accounts-schemas";

export type PaymentAccountRow = {
  id: string;
  type: PaymentAccountTypeValue;
  provider: string;
  accountNumber: string;
  accountName: string | null;
  isDefault: boolean;
};

/**
 * Accounts belong to a membership, so every read and write is scoped through
 * `{ userId, organizationId }` rather than the account id alone — an id from
 * another member (or another org) must not resolve.
 */
type Scope = { userId: string; organizationId: string };

async function findMembershipId(scope: Scope) {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: scope.userId,
        organizationId: scope.organizationId,
      },
    },
    select: { id: true },
  });
  return membership?.id ?? null;
}

export async function getPaymentAccounts(
  scope: Scope
): Promise<PaymentAccountRow[]> {
  const membershipId = await findMembershipId(scope);
  if (!membershipId) return [];

  const accounts = await prisma.paymentAccount.findMany({
    where: { membershipId },
    // Default first — it is the one a tenant should use — then oldest first so
    // the list doesn't reshuffle as accounts are edited.
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      type: true,
      provider: true,
      accountNumber: true,
      accountName: true,
      isDefault: true,
    },
  });

  return accounts;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Serializes every write touching one member's accounts.
 *
 * A transaction alone is *not* enough, which this got wrong first time round:
 * at Postgres's default READ COMMITTED, two concurrent creates each read
 * `count === 0`, each conclude they are the first account, and both commit
 * with `isDefault: true` — neither sees the other's uncommitted row. Caught by
 * firing two POSTs from one `Promise.all`, which produced exactly that.
 *
 * Locking the parent Membership row makes the second writer wait for the
 * first to commit, so its count and its `clearOtherDefaults` both see reality.
 * The lock is on Membership rather than the accounts because the first write
 * has no account row to lock.
 */
async function lockMembership(tx: Tx, membershipId: string) {
  await tx.$executeRaw`SELECT id FROM "Membership" WHERE id = ${membershipId} FOR UPDATE`;
}

/** At most one default per membership — clear the others rather than reading first. */
async function clearOtherDefaults(
  tx: Tx,
  membershipId: string,
  keepId?: string
) {
  await tx.paymentAccount.updateMany({
    where: {
      membershipId,
      isDefault: true,
      ...(keepId ? { NOT: { id: keepId } } : {}),
    },
    data: { isDefault: false },
  });
}

export async function createPaymentAccount(
  scope: Scope,
  input: PaymentAccountInput
) {
  const membershipId = await findMembershipId(scope);
  if (!membershipId) return { error: "no-membership" as const };

  const account = await prisma.$transaction(async (tx) => {
    await lockMembership(tx, membershipId);

    // The first account is the default whether or not it was ticked —
    // otherwise a member with exactly one account has no default at all.
    const existing = await tx.paymentAccount.count({ where: { membershipId } });
    const isDefault = input.isDefault || existing === 0;

    if (isDefault) await clearOtherDefaults(tx, membershipId);

    return tx.paymentAccount.create({
      data: { ...input, isDefault, membershipId },
      select: { id: true },
    });
  });

  return { account };
}

export async function updatePaymentAccount(
  scope: Scope,
  accountId: string,
  input: PaymentAccountInput
) {
  const membershipId = await findMembershipId(scope);
  if (!membershipId) return { error: "not-found" as const };

  const found = await prisma.$transaction(async (tx) => {
    await lockMembership(tx, membershipId);

    // Re-read inside the lock: `isDefault` may have moved to another account
    // between the request arriving and this transaction starting.
    const existing = await tx.paymentAccount.findFirst({
      where: { id: accountId, membershipId },
      select: { id: true, isDefault: true },
    });
    if (!existing) return false;

    // Un-ticking the only default would leave the member without one, so the
    // flag can be turned on here but only turned off by promoting another.
    const isDefault = input.isDefault || existing.isDefault;
    if (isDefault) await clearOtherDefaults(tx, membershipId, accountId);

    await tx.paymentAccount.update({
      where: { id: accountId },
      data: { ...input, isDefault },
    });
    return true;
  });

  if (!found) return { error: "not-found" as const };
  return { ok: true as const };
}

export async function deletePaymentAccount(scope: Scope, accountId: string) {
  const membershipId = await findMembershipId(scope);
  if (!membershipId) return { error: "not-found" as const };

  const found = await prisma.$transaction(async (tx) => {
    await lockMembership(tx, membershipId);

    const existing = await tx.paymentAccount.findFirst({
      where: { id: accountId, membershipId },
      select: { id: true, isDefault: true },
    });
    // Already gone — two deletes of the same row raced, and the first won.
    if (!existing) return false;

    await tx.paymentAccount.delete({ where: { id: accountId } });

    // Deleting the default promotes the next-oldest, so the member never ends
    // up with accounts but no default.
    if (existing.isDefault) {
      const next = await tx.paymentAccount.findFirst({
        where: { membershipId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.paymentAccount.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return true;
  });

  if (!found) return { error: "not-found" as const };
  return { ok: true as const };
}
