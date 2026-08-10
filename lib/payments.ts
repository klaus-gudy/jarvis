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
function orgPaymentFilter(organizationId: string) {
  return {
    invoice: {
      lease: {
        membership: { organizationId },
        unit: { property: { organizationId } },
      },
    },
  };
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
  /** The parent invoice's status *now*, after every payment on it. */
  invoiceStatus: InvoiceStatus;
  leaseId: string;
  tenantName: string;
};

/** Every payment recorded in the organization, newest first. */
export async function getPayments(organizationId: string): Promise<PaymentRow[]> {
  const payments = await prisma.payment.findMany({
    where: orgPaymentFilter(organizationId),
    orderBy: { paidAt: "desc" },
    include: {
      invoice: {
        include: {
          // Every payment on the invoice, not just this one — the row reports
          // where the invoice stands overall, which needs the full total.
          payments: { select: { amount: true } },
          lease: {
            include: {
              membership: {
                include: {
                  user: { select: { name: true, email: true, phone: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return payments.map((payment) => {
    const { invoice } = payment;
    const paid = invoice.payments.reduce((sum, item) => sum + item.amount, 0);

    return {
      id: payment.id,
      amount: payment.amount,
      paidAt: payment.paidAt.toISOString(),
      method: payment.method,
      notes: payment.notes,
      invoiceId: invoice.id,
      invoiceReference: invoiceReference(invoice.id),
      invoiceAmount: invoice.amount,
      invoiceStatus: deriveInvoiceStatus(invoice.amount, paid),
      leaseId: invoice.leaseId,
      tenantName: displayName(invoice.lease.membership.user),
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
  const invoices = await prisma.invoice.findMany({
    where: {
      lease: {
        membership: { organizationId },
        unit: { property: { organizationId } },
      },
    },
    orderBy: { dueDate: "asc" },
    include: {
      payments: { select: { amount: true } },
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

  return invoices
    .map((invoice) => {
      const paid = invoice.payments.reduce((sum, item) => sum + item.amount, 0);
      return {
        id: invoice.id,
        reference: invoiceReference(invoice.id),
        amount: invoice.amount,
        paid,
        balance: invoice.amount - paid,
        status: deriveInvoiceStatus(invoice.amount, paid),
        tenantName: displayName(invoice.lease.membership.user),
        unitLabel: invoice.lease.unit.label,
        propertyName: invoice.lease.unit.property.name,
      };
    })
    // Balance is derived from the payments, so the filter can't be a `where`.
    .filter((invoice) => invoice.balance > 0);
}
