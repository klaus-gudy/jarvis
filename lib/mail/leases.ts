import { formatCurrencyFull } from "@/lib/format";
import { MAIL_SERVICE_NAME, type MailRoutingKey } from "@/lib/mail/config";
import { appUrl, escapeHtml, renderEmail, type EmailParts } from "@/lib/mail/layout";
import { publishMail } from "@/lib/mail/queue";

/**
 * Section C of the catalogue — leases. Only `lease.expiring` is wired.
 *
 * Both audiences get the same facts and a different point. The landlord is
 * being told to *decide*; the tenant is being told what happens to them if
 * nobody does. Sending one message to both would serve neither.
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
