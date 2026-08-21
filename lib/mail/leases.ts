import { formatCurrencyFull } from "@/lib/format";
import { MAIL_SERVICE_NAME, type MailRoutingKey } from "@/lib/mail/config";
import { appUrl, escapeHtml, renderEmail, type EmailParts } from "@/lib/mail/layout";
import { publishMail } from "@/lib/mail/queue";

/**
 * Section C of the catalogue — leases: `lease.created`, `lease.renewed` and
 * `lease.expiring`.
 *
 * Both audiences get the same facts and a different point. The landlord is
 * reading a record of their portfolio; the tenant is reading about the roof
 * over their head. Sending one message to both would serve neither.
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

export type LeaseFacts = {
  leaseId: string;
  reference: string;
  tenantName: string;
  tenantEmail: string | null;
  propertyName: string;
  unitLabel: string;
  startDate: Date;
  endDate: Date;
  durationMonths: number;
  monthlyRent: number;
  leaseAmount: number;
  invoiceReference: string;
  invoiceDueDate: Date;
};

/** The terms table both `lease.created` emails repeat, so they can't diverge. */
function termsLines(lease: LeaseFacts) {
  return [
    `Term: <strong>${escapeHtml(formatDate(lease.startDate))}</strong> to <strong>${escapeHtml(formatDate(lease.endDate))}</strong> (${lease.durationMonths} months).`,
    `Rent: <strong>${escapeHtml(formatCurrencyFull(lease.monthlyRent))}</strong> a month — ${escapeHtml(formatCurrencyFull(lease.leaseAmount))} over the full term.`,
  ];
}

/* ------------------------------------------------------------------ *
 * lease.created — POST /api/leases
 * ------------------------------------------------------------------ */

export async function sendLeaseCreatedToOwner(
  lease: LeaseFacts,
  owner: { email: string | null; name: string | null }
) {
  await deliver(
    "lease.created",
    owner.email,
    `New lease — ${lease.unitLabel}, ${lease.propertyName}`,
    {
      heading: `${lease.unitLabel} is let to ${lease.tenantName}`,
      body: [
        owner.name?.trim() ? `Hi ${escapeHtml(owner.name.trim())},` : "Hi,",
        `<strong>${escapeHtml(lease.tenantName)}</strong> is now on a lease for <strong>${escapeHtml(lease.unitLabel)}</strong> at <strong>${escapeHtml(lease.propertyName)}</strong> (${escapeHtml(lease.reference)}).`,
        ...termsLines(lease),
        `Invoice ${escapeHtml(lease.invoiceReference)} has been raised for the whole term, due ${escapeHtml(formatDate(lease.invoiceDueDate))}.`,
      ],
      action: { label: "Open the lease", href: appUrl(`/leases/${lease.leaseId}`) },
    }
  );
}

export async function sendLeaseCreatedToTenant(lease: LeaseFacts) {
  await deliver(
    "lease.created",
    lease.tenantEmail,
    `Your lease for ${lease.unitLabel} at ${lease.propertyName}`,
    {
      heading: "Your lease is confirmed",
      body: [
        `Hi ${escapeHtml(lease.tenantName)},`,
        `Your lease for <strong>${escapeHtml(lease.unitLabel)}</strong> at <strong>${escapeHtml(lease.propertyName)}</strong> is confirmed. Reference ${escapeHtml(lease.reference)}.`,
        ...termsLines(lease),
        `Rent for the term is due on <strong>${escapeHtml(formatDate(lease.invoiceDueDate))}</strong>, under invoice ${escapeHtml(lease.invoiceReference)}. Your landlord will tell you where to pay.`,
        "Keep this email — it is your record of the terms.",
      ],
    }
  );
}

/* ------------------------------------------------------------------ *
 * lease.renewed — the auto-renewal sweep in lib/lease-renewal.ts
 * ------------------------------------------------------------------ */

export async function sendLeaseRenewedToOwner(
  lease: LeaseFacts,
  previousEndDate: Date,
  owner: { email: string | null; name: string | null }
) {
  await deliver(
    "lease.renewed",
    owner.email,
    `Auto-renewed — ${lease.unitLabel}, ${lease.propertyName}`,
    {
      heading: `${lease.unitLabel} renewed for ${lease.durationMonths} more months`,
      body: [
        owner.name?.trim() ? `Hi ${escapeHtml(owner.name.trim())},` : "Hi,",
        `<strong>${escapeHtml(lease.tenantName)}</strong>'s lease on <strong>${escapeHtml(lease.unitLabel)}</strong> at <strong>${escapeHtml(lease.propertyName)}</strong> ended on ${escapeHtml(formatDate(previousEndDate))} and renewed automatically, because the unit is set to auto-renew.`,
        ...termsLines(lease),
        // Stated because it is the one thing about a renewal that surprises
        // people: the agreed rate carries forward, and a unit whose asking
        // rent has since risen does not quietly catch up.
        `The rate was carried forward from the previous lease, not repriced to the unit's current asking rent. Edit the lease if you want to change it.`,
        `Invoice ${escapeHtml(lease.invoiceReference)} has been raised, due ${escapeHtml(formatDate(lease.invoiceDueDate))}.`,
      ],
      action: { label: "Open the lease", href: appUrl(`/leases/${lease.leaseId}`) },
    }
  );
}

export async function sendLeaseRenewedToTenant(
  lease: LeaseFacts,
  previousEndDate: Date
) {
  await deliver(
    "lease.renewed",
    lease.tenantEmail,
    `Your lease at ${lease.propertyName} has been renewed`,
    {
      heading: "Your lease has renewed",
      body: [
        `Hi ${escapeHtml(lease.tenantName)},`,
        `Your lease for <strong>${escapeHtml(lease.unitLabel)}</strong> at <strong>${escapeHtml(lease.propertyName)}</strong> ended on ${escapeHtml(formatDate(previousEndDate))} and has renewed automatically. You don't need to do anything to stay.`,
        ...termsLines(lease),
        `Your rent is unchanged from the previous term. Invoice ${escapeHtml(lease.invoiceReference)} is due ${escapeHtml(formatDate(lease.invoiceDueDate))}.`,
      ],
    }
  );
}

export type ExpiringLease = {
  leaseId: string;
  reference: string;
  tenantName: string;
  tenantEmail: string | null;
  propertyName: string;
  unitLabel: string;
  endDate: Date;
  daysLeft: number;
  monthlyRent: number;
};

/** To the landlord: a decision is due, and here is the deadline for it. */
export async function sendLeaseExpiringToOwner(
  lease: ExpiringLease,
  owner: { email: string | null; name: string | null }
) {
  const days = `${lease.daysLeft} day${lease.daysLeft === 1 ? "" : "s"}`;

  await deliver(
    "lease.expiring",
    owner.email,
    `${days} left on ${lease.tenantName}'s lease — ${lease.unitLabel}`,
    {
      heading: `${lease.unitLabel} at ${lease.propertyName} — ${days} left`,
      body: [
        owner.name?.trim() ? `Hi ${escapeHtml(owner.name.trim())},` : "Hi,",
        `<strong>${escapeHtml(lease.tenantName)}</strong>'s lease (${escapeHtml(lease.reference)}) ends on <strong>${escapeHtml(formatDate(lease.endDate))}</strong>.`,
        // Said plainly because the alternative — the landlord assuming it is
        // handled — is how a unit ends up empty on the first of the month.
        `This unit isn't set to renew automatically, so nothing happens unless you act: renew at ${escapeHtml(formatCurrencyFull(lease.monthlyRent))} a month, agree a new rate, or start looking for the next tenant.`,
      ],
      action: { label: "Open the lease", href: appUrl(`/leases/${lease.leaseId}`) },
    }
  );
}

/** To the tenant: your lease ends, and nothing renews it for you. */
export async function sendLeaseExpiringToTenant(lease: ExpiringLease) {
  const days = `${lease.daysLeft} day${lease.daysLeft === 1 ? "" : "s"}`;

  await deliver(
    "lease.expiring",
    lease.tenantEmail,
    `Your lease at ${lease.propertyName} ends in ${days}`,
    {
      heading: `Your lease ends on ${formatDate(lease.endDate)}`,
      body: [
        `Hi ${escapeHtml(lease.tenantName)},`,
        `Your lease for <strong>${escapeHtml(lease.unitLabel)}</strong> at <strong>${escapeHtml(lease.propertyName)}</strong> ends in ${days}, on ${escapeHtml(formatDate(lease.endDate))}.`,
        "It won't renew on its own. If you'd like to stay, speak to your landlord now — agreeing a new term early is a good deal easier than agreeing one late.",
      ],
    }
  );
}
