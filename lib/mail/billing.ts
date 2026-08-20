import { formatCurrencyFull } from "@/lib/format";
import { MAIL_SERVICE_NAME, type MailRoutingKey } from "@/lib/mail/config";
import { appUrl, escapeHtml, renderEmail, type EmailParts } from "@/lib/mail/layout";
import { publishMail } from "@/lib/mail/queue";

/**
 * Section D of the catalogue — billing. `invoice.paid_in_full` fires on the
 * event; `invoice.overdue` comes from the sweep in `lib/notifications/`.
 */

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Dar_es_Salaam",
  }).format(date);
}

async function deliver(
  routingKey: MailRoutingKey,
  to: string | null | undefined,
  subject: string,
  parts: EmailParts
) {
  if (!to) return;
  await publishMail(routingKey, {
    email: to,
    subject,
    content: renderEmail(parts),
    service_name: MAIL_SERVICE_NAME,
  });
}

export type InvoiceFacts = {
  invoiceId: string;
  reference: string;
  leaseId: string;
  amount: number;
  paid: number;
  balance: number;
  dueDate: Date;
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
  propertyName: string;
  unitLabel: string;
};

/* ------------------------------------------------------------------ *
 * invoice.paid_in_full — fires from recordPayment on the crossing
 * ------------------------------------------------------------------ */

export async function sendInvoicePaidToOwner(
  invoice: InvoiceFacts,
  owner: { email: string | null; name: string | null }
) {
  await deliver(
    "invoice.paid_in_full",
    owner.email,
    `${invoice.tenantName} has paid in full — ${invoice.unitLabel}`,
    {
      heading: `${invoice.reference} is settled`,
      body: [
        owner.name?.trim() ? `Hi ${escapeHtml(owner.name.trim())},` : "Hi,",
        `<strong>${escapeHtml(invoice.tenantName)}</strong> has now paid <strong>${escapeHtml(formatCurrencyFull(invoice.amount))}</strong> in full against ${escapeHtml(invoice.reference)} — ${escapeHtml(invoice.unitLabel)} at ${escapeHtml(invoice.propertyName)}.`,
        "Nothing is outstanding on this lease.",
      ],
      action: { label: "View the lease", href: appUrl(`/leases/${invoice.leaseId}`) },
    }
  );
}

/** The tenant's receipt for the *last* payment — the one that cleared it. */
export async function sendInvoicePaidToTenant(invoice: InvoiceFacts) {
  await deliver(
    "invoice.paid_in_full",
    invoice.tenantEmail,
    `Paid in full — ${invoice.reference}`,
    {
      heading: "Your rent is paid in full",
      body: [
        `Hi ${escapeHtml(invoice.tenantName)},`,
        `Thank you — ${escapeHtml(invoice.reference)} for <strong>${escapeHtml(invoice.unitLabel)}</strong> at <strong>${escapeHtml(invoice.propertyName)}</strong> is now fully paid: ${escapeHtml(formatCurrencyFull(invoice.amount))} received.`,
        "You owe nothing further on this lease. Keep this email as your record.",
      ],
    }
  );
}

/* ------------------------------------------------------------------ *
 * invoice.overdue — from the sweep, on a weekly cadence
 * ------------------------------------------------------------------ */

export async function sendInvoiceOverdueToOwner(
  invoice: InvoiceFacts,
  daysLate: number,
  owner: { email: string | null; name: string | null }
) {
  const chase = invoice.tenantPhone
    ? ` You may want to follow up directly on ${escapeHtml(invoice.tenantPhone)}.`
    : "";

  await deliver(
    "invoice.overdue",
    owner.email,
    `Overdue: ${invoice.tenantName} owes ${formatCurrencyFull(invoice.balance)}`,
    {
      heading: `${invoice.reference} is ${daysLate} days overdue`,
      body: [
        owner.name?.trim() ? `Hi ${escapeHtml(owner.name.trim())},` : "Hi,",
        `${escapeHtml(invoice.reference)} for <strong>${escapeHtml(invoice.unitLabel)}</strong> at <strong>${escapeHtml(invoice.propertyName)}</strong> was due on ${escapeHtml(formatDate(invoice.dueDate))} — ${daysLate} days ago.`,
        `Paid so far: ${escapeHtml(formatCurrencyFull(invoice.paid))} of ${escapeHtml(formatCurrencyFull(invoice.amount))}. <strong>Outstanding: ${escapeHtml(formatCurrencyFull(invoice.balance))}</strong>.`,
        `We've reminded ${escapeHtml(invoice.tenantName)}.${chase}`,
      ],
      action: { label: "Record a payment", href: appUrl(`/leases/${invoice.leaseId}`) },
    }
  );
}

export async function sendInvoiceOverdueToTenant(
  invoice: InvoiceFacts,
  daysLate: number
) {
  // The part-paid case reads as an accusation if it says "you have not paid",
  // so what has been paid is stated before what is owed.
  const sofar =
    invoice.paid > 0
      ? `You have paid ${escapeHtml(formatCurrencyFull(invoice.paid))} of ${escapeHtml(formatCurrencyFull(invoice.amount))}, leaving <strong>${escapeHtml(formatCurrencyFull(invoice.balance))}</strong> outstanding.`
      : `The amount outstanding is <strong>${escapeHtml(formatCurrencyFull(invoice.balance))}</strong>.`;

  await deliver(
    "invoice.overdue",
    invoice.tenantEmail,
    `Rent overdue — ${invoice.unitLabel}, ${invoice.propertyName}`,
    {
      heading: `Your rent is ${daysLate} days overdue`,
      body: [
        `Hi ${escapeHtml(invoice.tenantName)},`,
        `${escapeHtml(invoice.reference)} for <strong>${escapeHtml(invoice.unitLabel)}</strong> at <strong>${escapeHtml(invoice.propertyName)}</strong> was due on ${escapeHtml(formatDate(invoice.dueDate))}.`,
        sofar,
        "If you have already paid, ignore this — it can take a day or two to be recorded. If you can't pay the full amount right now, talk to your landlord: an arrangement agreed in advance is always better than a missed payment.",
      ],
    }
  );
}
