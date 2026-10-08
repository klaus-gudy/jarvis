import { addMonths } from "@/lib/leases-schemas";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { planPrice, PRICING_PLANS, type BillingPeriod } from "@/lib/site";

/**
 * Turns a verified, completed payment into a paid period — or explains why it
 * didn't. Everything the link claimed is checked against something this app
 * owns, because the `?meta=` blob is editable by whoever holds the link:
 *
 * - the event is `payment.completed`;
 * - it names a known plan, a period and an organization that exists;
 * - the amount, in TZS, is **exactly** that plan's price for that period — so
 *   a Mikumi payment with an edited link can't buy Serengeti.
 *
 * Periods stack: a payment before the current one runs out extends it from its
 * end, so paying early never loses days. One grant per event (unique
 * `billingEventId`), so running this twice for one payment is harmless.
 */
export type GrantOutcome =
  | { granted: true; subscriptionId: string; paidUntil: Date }
  | { granted: false; reason: string };

const COMPLETED = "payment.completed";

export async function grantSubscription(billingEventId: string): Promise<GrantOutcome> {
  const event = await prisma.billingEvent.findUnique({
    where: { id: billingEventId },
    select: {
      id: true,
      type: true,
      amount: true,
      currency: true,
      plan: true,
      billing: true,
      organizationId: true,
      occurredAt: true,
      receivedAt: true,
    },
  });
  if (!event) return { granted: false, reason: "event not found" };
  if (event.type !== COMPLETED) return { granted: false, reason: `not a completed payment (${event.type})` };

  const plan = PRICING_PLANS.find((candidate) => candidate.slug === event.plan);
  const billing = event.billing as BillingPeriod | null;
  if (!plan || (billing !== "monthly" && billing !== "yearly")) {
    return { granted: false, reason: "the link named no known plan and period" };
  }
  if (!event.organizationId) return { granted: false, reason: "the link named no organization" };

  const expected = planPrice(plan, billing);
  if (event.currency?.toUpperCase() !== "TZS" || event.amount !== expected) {
    return {
      granted: false,
      reason: `paid ${event.amount ?? "?"} ${event.currency ?? "?"}, ${plan.name} ${billing} costs ${expected} TZS`,
    };
  }

  const organization = await prisma.organization.findUnique({
    where: { id: event.organizationId },
    select: { id: true },
  });
  if (!organization) return { granted: false, reason: "the named organization does not exist" };

  try {
    const subscription = await prisma.$transaction(async (tx) => {
      // The latest period still running, if any, is where this one starts.
      const paidAt = event.occurredAt ?? event.receivedAt;
      const current = await tx.subscription.findFirst({
        where: { organizationId: organization.id, paidUntil: { gt: paidAt } },
        orderBy: { paidUntil: "desc" },
        select: { paidUntil: true },
      });
      const startsAt = current?.paidUntil ?? paidAt;
      const paidUntil = addMonths(startsAt, billing === "yearly" ? 12 : 1);
      return tx.subscription.create({
        data: {
          organizationId: organization.id,
          plan: plan.slug,
          billing,
          amount: expected,
          currency: "TZS",
          startsAt,
          paidUntil,
          billingEventId: event.id,
        },
        select: { id: true, paidUntil: true },
      });
    });
    return { granted: true, subscriptionId: subscription.id, paidUntil: subscription.paidUntil };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { granted: false, reason: "already granted" };
    }
    throw error;
  }
}

export type SubscriptionRow = {
  id: string;
  plan: string;
  planName: string;
  billing: BillingPeriod;
  amount: number;
  startsAt: Date;
  paidUntil: Date;
  createdAt: Date;
};

/** What Settings → Billing shows: the plan in force, and every period paid. */
export async function getSubscriptionOverview(organizationId: string, now = new Date()) {
  const rows = await prisma.subscription.findMany({
    where: { organizationId },
    orderBy: { startsAt: "desc" },
  });
  const history: SubscriptionRow[] = rows.map((row) => ({
    id: row.id,
    plan: row.plan,
    planName: PRICING_PLANS.find((plan) => plan.slug === row.plan)?.name ?? row.plan,
    billing: row.billing as BillingPeriod,
    amount: row.amount,
    startsAt: row.startsAt,
    paidUntil: row.paidUntil,
    createdAt: row.createdAt,
  }));
  // In force today: started and not yet run out. The furthest-reaching paid
  // date is what "paid until" means when periods are stacked.
  const current = history.find((row) => row.startsAt <= now && row.paidUntil > now) ?? null;
  const paidUntil = history.reduce<Date | null>(
    (latest, row) => (row.paidUntil > now && (!latest || row.paidUntil > latest) ? row.paidUntil : latest),
    null
  );
  return { current, paidUntil, history };
}
