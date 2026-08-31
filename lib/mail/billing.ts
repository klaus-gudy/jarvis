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
        // Was "We've reminded <tenant>" — untrue since tenants stopped being
        // emailed, and a landlord who believes a chase already went out is
        // exactly the person who then doesn't make one.
        `No reminder has been sent to ${escapeHtml(invoice.tenantName)} — chasing this is yours to do.${chase}`,
      ],
      action: { label: "Record a payment", href: appUrl(`/leases/${invoice.leaseId}`) },
    }
  );
}
