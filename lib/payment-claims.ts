import { audit, snapshot, type Actor } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { RecordPaymentInput } from "@/lib/invoices-schemas";
import { recordPayment } from "@/lib/invoices";

/**
 * Payments a tenant reports from the portal. A claim is **never** part of a
 * balance — every sum in the app reads `Payment` only, so a claim cannot move
 * a figure until a landlord confirms it, which records a real payment through
 * the same `recordPayment` path the Billing tab uses (same overpayment guard,
 * same paid-in-full notice) and links it here.
 */

export type PaymentClaimView = {
  id: string;
  amount: number;
  paidAt: Date;
  method: string | null;
  notes: string | null;
  createdAt: Date;
};

const VIEW = {
  id: true,
  amount: true,
  paidAt: true,
  method: true,
  notes: true,
  createdAt: true,
} as const;

/**
 * A tenant's claim against an invoice on one of *their own* leases. Capped at
 * the confirmed balance; two claims that together overshoot are caught when
 * the second is confirmed.
 */
export async function createPaymentClaim(
  ctx: AuthContext,
  invoiceId: string,
  input: RecordPaymentInput
) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      lease: {
        membershipId: ctx.membershipId,
        membership: { organizationId: ctx.organizationId },
        unit: { property: { organizationId: ctx.organizationId } },
      },
    },
    select: { id: true, amount: true, payments: { select: { amount: true } } },
  });
  if (!invoice) return { error: "not-found" as const };

  const paid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = invoice.amount - paid;
  if (input.amount > balance) return { error: "overpayment" as const, balance };

  const claim = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentClaim.create({
      data: {
        invoiceId: invoice.id,
        membershipId: ctx.membershipId,
        amount: input.amount,
        paidAt: input.paidAt,
        method: input.method ?? null,
        notes: input.notes ?? null,
      },
      select: VIEW,
    });
    await audit(tx, {
      organizationId: ctx.organizationId,
      actor: ctx,
      action: "payment_claim.submitted",
      entityType: "PaymentClaim",
      entityId: created.id,
      changes: { invoiceId: invoice.id, ...snapshot(created) },
    });
    return created;
  });
  return { claim };
}

/** Claims still waiting on the landlord, oldest first. Scoped like invoices. */
export async function getPendingClaims(
  organizationId: string,
  invoiceId: string
): Promise<PaymentClaimView[]> {
  return prisma.paymentClaim.findMany({
    where: {
      invoiceId,
      status: "PENDING",
      invoice: {
        lease: {
          membership: { organizationId },
          unit: { property: { organizationId } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    select: VIEW,
  });
}

function orgClaim(organizationId: string, invoiceId: string, claimId: string) {
  return {
    id: claimId,
    invoiceId,
    invoice: {
      lease: {
        membership: { organizationId },
        unit: { property: { organizationId } },
      },
    },
  };
}

/**
 * Turns a pending claim into a payment. The claim is taken first (PENDING →
 * CONFIRMED in one guarded update) so two landlords clicking at once record it
 * once; if the payment is then refused — it would overpay — the claim goes
 * back to pending.
 */
export async function confirmPaymentClaim(
  organizationId: string,
  invoiceId: string,
  claimId: string,
  actor: Actor
) {
  const claim = await prisma.paymentClaim.findFirst({
    where: orgClaim(organizationId, invoiceId, claimId),
    select: { id: true, status: true, amount: true, paidAt: true, method: true, notes: true },
  });
  if (!claim) return { error: "not-found" as const };

  const taken = await prisma.paymentClaim.updateMany({
    where: { id: claim.id, status: "PENDING" },
    data: { status: "CONFIRMED", reviewedAt: new Date(), reviewedById: actor.membershipId },
  });
  if (taken.count === 0) return { error: "already-reviewed" as const };

  const result = await recordPayment(
    organizationId,
    invoiceId,
    {
      amount: claim.amount,
      paidAt: claim.paidAt,
      method: claim.method,
      notes: claim.notes,
    },
    actor
  );
  if (result.error) {
    await prisma.paymentClaim.update({
      where: { id: claim.id },
      data: { status: "PENDING", reviewedAt: null, reviewedById: null },
    });
    return result;
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentClaim.update({
      where: { id: claim.id },
      data: { paymentId: result.payment.id },
    });
    await audit(tx, {
      organizationId,
      actor,
      action: "payment_claim.confirmed",
      entityType: "PaymentClaim",
      entityId: claim.id,
      changes: { status: ["PENDING", "CONFIRMED"], paymentId: [null, result.payment.id] },
    });
  });
  return result;
}

export async function rejectPaymentClaim(
  organizationId: string,
  invoiceId: string,
  claimId: string,
  actor: Actor
) {
  return prisma.$transaction(async (tx) => {
    const rejected = await tx.paymentClaim.updateMany({
      where: { ...orgClaim(organizationId, invoiceId, claimId), status: "PENDING" },
      data: { status: "REJECTED", reviewedAt: new Date(), reviewedById: actor.membershipId },
    });
    if (rejected.count === 0) return { error: "not-found" as const };

    await audit(tx, {
      organizationId,
      actor,
      action: "payment_claim.rejected",
      entityType: "PaymentClaim",
      entityId: claimId,
      changes: { status: ["PENDING", "REJECTED"] },
    });
    return { ok: true as const };
  });
}
