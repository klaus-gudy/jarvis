import { prisma } from "@/lib/prisma";
import type { RecordPaymentInput } from "@/lib/invoices-schemas";
import {
  deriveInvoiceStatus,
  invoiceReference,
  type InvoiceStatus,
} from "@/lib/invoice-types";

// Re-exported so server callers can keep importing both from one place; the
// definitions live in the Prisma-free module so client components can use them.
export { deriveInvoiceStatus, type InvoiceStatus };

export type PaymentRow = {
  id: string;
  amount: number;
  paidAt: Date;
  method: string | null;
  notes: string | null;
};

export type InvoiceDetail = {
  id: string;
  reference: string;
  amount: number;
  dueDate: Date;
  paid: number;
  balance: number;
  status: InvoiceStatus;
  payments: PaymentRow[];
};

/**
 * Scoped through the owning lease the same way `getLease` is — both the
 * membership and the unit's property — so one org can never read or pay
 * another's invoice.
 */
function orgInvoiceFilter(organizationId: string) {
  return {
    lease: {
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
  };
}

export async function getInvoiceForLease(
  organizationId: string,
  leaseId: string
): Promise<InvoiceDetail | null> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      leaseId,
      ...orgInvoiceFilter(organizationId),
    },
    include: {
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!invoice) return null;

  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    id: invoice.id,
    reference: invoiceReference(invoice.id),
    amount: invoice.amount,
    dueDate: invoice.dueDate,
    paid,
    balance: invoice.amount - paid,
    status: deriveInvoiceStatus(invoice.amount, paid),
    payments: invoice.payments,
  };
}

export async function recordPayment(
  organizationId: string,
  invoiceId: string,
  input: RecordPaymentInput
) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ...orgInvoiceFilter(organizationId) },
    include: { payments: { select: { amount: true } } },
  });
  if (!invoice) return { error: "not-found" as const };

  const paid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = invoice.amount - paid;
  if (input.amount > balance) {
    return { error: "overpayment" as const, balance };
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method ?? null,
      notes: input.notes ?? null,
    },
  });

  return { payment };
}

export async function deletePayment(
  organizationId: string,
  invoiceId: string,
  paymentId: string
) {
  const payment = await prisma.payment.findFirst({
    where: {
      id: paymentId,
      invoiceId,
      invoice: orgInvoiceFilter(organizationId),
    },
    select: { id: true },
  });
  if (!payment) return { error: "not-found" as const };

  await prisma.payment.delete({ where: { id: payment.id } });
  return { ok: true as const };
}
