import { getProfilePhotoIds } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import {
  deriveInvoiceStatus,
  invoiceReference,
  type InvoiceStatus,
} from "@/lib/invoice-types";
import { displayName } from "@/lib/user-display";

/**
 * Payments hang off an invoice, which hangs off a lease — so the org filter is
 * the same double-scoped one every lease query here uses (membership *and* the
 * unit's property), reached one relation deeper.
 */
function orgPaymentFilter(organizationId: string, membershipId?: string) {
  return {
    invoice: {
      lease: {
        membership: { organizationId },
        unit: { property: { organizationId } },
        /*
         * Narrows the ledger to one member's payments, for the Payments tab on
         * their detail page. It sits *beside* the two organization checks
         * rather than replacing them — a membership id is a value off a URL,
         * and scoping by it alone would answer for a membership in someone
         * else's organization.
         */
        ...(membershipId ? { membershipId } : {}),
      },
    },
  };
}

function orgInvoiceFilter(organizationId: string) {
  return {
    lease: {
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
  };
}

/**
 * How much has been paid against each invoice, as one grouped aggregate.
 *
 * A balance is derived rather than stored, so it can't be filtered or summed
 * in a plain `where`. This is the cheap way to get it: one row per invoice
 * from the database instead of hydrating every payment row and adding them up
 * in JS — which the callers below used to do, once per result row.
 */
async function paidByInvoice(organizationId: string, membershipId?: string) {
  const totals = await prisma.payment.groupBy({
    by: ["invoiceId"],
    where: orgPaymentFilter(organizationId, membershipId),
    _sum: { amount: true },
  });

  return new Map(totals.map((total) => [total.invoiceId, total._sum.amount ?? 0]));
}

export type PaymentRow = {
  id: string;
  amount: number;
  paidAt: string;
  method: string | null;
  notes: string | null;
  invoiceId: string;
  invoiceReference: string;
  invoiceAmount: number;
  /**
   * Total paid against the parent invoice, for the row's "Make payment"
   * action — **not for display**. Phase 34 removed the balance *column*
   * because, repeated on every payment of one invoice, it read as a
   * per-payment figure; that reasoning is about showing it, not carrying it.
   */
  invoicePaid: number;
  /** The parent invoice's status *now*, after every payment on it. */
  invoiceStatus: InvoiceStatus;
  leaseId: string;
  tenantName: string;
  photoId: string | null;
  /**
   * Re-added after Phase 34 dropped it: the payments table filters by property,
   * and a facet needs the value on the row. Org scoping is still done by the
   * `where` clause, never by this include.
   */
  propertyName: string;
  unitLabel: string;
};

/**
 * Every payment recorded in the organization, newest first — or, given a
 * `membershipId`, only the ones made against that member's own leases.
 *
 * Narrowing `paidByInvoice` by the same membership is safe and cheaper:
 * an invoice belongs to exactly one lease, which belongs to exactly one
 * membership, so every payment on it is that member's. The per-invoice totals
 * come out identical to the org-wide ones.
 */
export async function getPayments(
  organizationId: string,
  membershipId?: string
): Promise<PaymentRow[]> {
  // The per-invoice totals come from one grouped aggregate rather than a
  // nested `payments` include: that include pulled every payment of an invoice
  // once per payment of that invoice, so an invoice with n payments was
  // hydrated n² times.
  const [payments, paid] = await Promise.all([
    prisma.payment.findMany({
      where: orgPaymentFilter(organizationId, membershipId),
      orderBy: { paidAt: "desc" },
      include: {
        invoice: {
          include: {
            lease: {
              include: {
                membership: {
                  include: {
                    user: { select: { name: true, email: true, phone: true } },
                  },
                },
                unit: {
                  select: {
                    label: true,
                    property: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    paidByInvoice(organizationId, membershipId),
  ]);

  const photoIds = await getProfilePhotoIds(
    organizationId,
    payments.map((payment) => payment.invoice.lease.membershipId)
  );

  return payments.map((payment) => {
    const { invoice } = payment;
    const invoicePaid = paid.get(invoice.id) ?? 0;

    return {
      id: payment.id,
      amount: payment.amount,
      paidAt: payment.paidAt.toISOString(),
      method: payment.method,
      notes: payment.notes,
      invoiceId: invoice.id,
      invoiceReference: invoiceReference(invoice.id),
      invoiceAmount: invoice.amount,
      invoicePaid,
      invoiceStatus: deriveInvoiceStatus(invoice.amount, invoicePaid),
      leaseId: invoice.leaseId,
      tenantName: displayName(invoice.lease.membership.user),
      photoId: photoIds.get(invoice.lease.membershipId) ?? null,
      propertyName: invoice.lease.unit.property.name,
      unitLabel: invoice.lease.unit.label,
    };
  });
}

export type PayableInvoice = {
  id: string;
  reference: string;
  amount: number;
  paid: number;
  balance: number;
  status: InvoiceStatus;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
};

/**
 * Invoices that still owe something, for the "Make payment" picker. A fully
 * paid invoice is excluded rather than shown disabled — `recordPayment` would
 * reject it anyway, so offering it would only be a dead end.
 */
export async function getPayableInvoices(
  organizationId: string
): Promise<PayableInvoice[]> {
  // Which invoices still owe something is decided from two narrow reads — two
  // columns per invoice and one grouped total per invoice — so the tenant and
  // unit joins below are paid for only by the rows that survive the filter.
  const [amounts, paid] = await Promise.all([
    prisma.invoice.findMany({
      where: orgInvoiceFilter(organizationId),
      select: { id: true, amount: true },
    }),
    paidByInvoice(organizationId),
  ]);

  const payableIds = amounts
    .filter((invoice) => invoice.amount - (paid.get(invoice.id) ?? 0) > 0)
    .map((invoice) => invoice.id);

  if (payableIds.length === 0) return [];

  const invoices = await prisma.invoice.findMany({
    where: { id: { in: payableIds } },
    orderBy: { dueDate: "asc" },
    include: {
      lease: {
        include: {
          unit: { include: { property: { select: { name: true } } } },
          membership: {
            include: { user: { select: { name: true, email: true, phone: true } } },
          },
        },
      },
    },
  });

  return invoices.map((invoice) => {
    const settled = paid.get(invoice.id) ?? 0;
    return {
      id: invoice.id,
      reference: invoiceReference(invoice.id),
      amount: invoice.amount,
      paid: settled,
      balance: invoice.amount - settled,
      status: deriveInvoiceStatus(invoice.amount, settled),
      tenantName: displayName(invoice.lease.membership.user),
      unitLabel: invoice.lease.unit.label,
      propertyName: invoice.lease.unit.property.name,
    };
  });
}
