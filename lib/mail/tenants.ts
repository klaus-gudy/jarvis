import { lastDayOf } from "@/lib/dates";
import { formatCurrencyFull } from "@/lib/format";
import { MAIL_SERVICE_NAME, type MailRoutingKey } from "@/lib/mail/config";
import type { LeaseFacts } from "@/lib/mail/leases";
import { appUrl, escapeHtml, renderEmail, type EmailParts } from "@/lib/mail/layout";
import { publishMail } from "@/lib/mail/queue";
import type { Recipient } from "@/lib/notifications/recipients";

/**
 * The tenant's side of the catalogue, since 2026-10-08. Everything here goes
 * only to a **verified** address (`getTenantRecipient`): landlords type tenants'
 * emails in for them, and a lease or a payment is not something to tell a
 * stranger about.
 *
 * Written to the person living there, not the person who owns it — the facts
 * are the landlord emails' facts, the point is "what this means for you".
 * Every link goes to the tenant portal; the staff app would bounce them.
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
  to: Recipient,
  subject: string,
  parts: Omit<EmailParts, "body"> & { body: string[] }
) {
  if (!to.email) return;
  await publishMail(routingKey, {
    email: to.email,
    subject,
    content: renderEmail({
      ...parts,
      body: [greeting(to), ...parts.body],
    }),
    service_name: MAIL_SERVICE_NAME,
  });
}

function greeting(to: Recipient) {
  return to.name?.trim() ? `Hi ${escapeHtml(to.name.trim())},` : "Hi,";
}

function termLine(lease: Pick<LeaseFacts, "startDate" | "endDate" | "durationMonths" | "monthlyRent">) {
  return `Term: <strong>${escapeHtml(formatDate(lease.startDate))}</strong> to <strong>${escapeHtml(formatDate(lastDayOf(lease.endDate)))}</strong> (${lease.durationMonths} months), at ${escapeHtml(formatCurrencyFull(lease.monthlyRent))} a month.`;
}

/* lease.created */
export async function sendLeaseCreatedToTenant(lease: LeaseFacts, tenant: Recipient) {
  await deliver("lease.created", tenant, `Your lease for ${lease.unitLabel}, ${lease.propertyName}`, {
    heading: `Your lease for ${lease.unitLabel} is set up`,
    body: [
      `Your landlord has recorded your lease for <strong>${escapeHtml(lease.unitLabel)}</strong> at <strong>${escapeHtml(lease.propertyName)}</strong> (${escapeHtml(lease.reference)}).`,
      termLine(lease),
      `The full term comes to ${escapeHtml(formatCurrencyFull(lease.leaseAmount))}. You can see what is paid and what is due in your portal at any time.`,
    ],
    action: { label: "View your lease", href: appUrl("/portal/lease") },
  });
}

/* lease.renewed */
export async function sendLeaseRenewedToTenant(
  lease: LeaseFacts,
  previousEndDate: Date,
  tenant: Recipient
) {
  await deliver("lease.renewed", tenant, `Your lease for ${lease.unitLabel} has been renewed`, {
    heading: `Renewed for ${lease.durationMonths} more months`,
    body: [
      `Your lease on <strong>${escapeHtml(lease.unitLabel)}</strong> at <strong>${escapeHtml(lease.propertyName)}</strong> ended on ${escapeHtml(formatDate(lastDayOf(previousEndDate)))} and has renewed automatically.`,
      termLine(lease),
      "Your rent is unchanged. Speak to your landlord if you were planning to move out.",
    ],
    action: { label: "View your lease", href: appUrl("/portal/lease") },
  });
}

/* lease.expiring — from the sweep, for leases that will not renew themselves */
export async function sendLeaseEndingToTenant(
  lease: { reference: string; unitLabel: string; propertyName: string; endDate: Date; daysLeft: number },
  tenant: Recipient
) {
  const when =
    lease.daysLeft <= 0
      ? "today"
      : `in ${lease.daysLeft} day${lease.daysLeft === 1 ? "" : "s"}`;
  await deliver("lease.expiring", tenant, `Your lease for ${lease.unitLabel} ends ${when}`, {
    heading: `Your lease ends ${when}`,
    body: [
      `Your lease (${escapeHtml(lease.reference)}) on <strong>${escapeHtml(lease.unitLabel)}</strong> at <strong>${escapeHtml(lease.propertyName)}</strong> ends on <strong>${escapeHtml(formatDate(lastDayOf(lease.endDate)))}</strong>.`,
      "It does not renew by itself. If you want to stay, talk to your landlord about a renewal before then.",
    ],
    action: { label: "View your lease", href: appUrl("/portal/lease") },
  });
}

/* payment.recorded — any payment the landlord records, a confirmed claim included */
export async function sendPaymentReceivedToTenant(
  payment: {
    amount: number;
    paidAt: Date;
    invoiceReference: string;
    balance: number;
    unitLabel: string;
    propertyName: string;
    /** True when it came from a payment the tenant reported. */
    fromClaim: boolean;
  },
  tenant: Recipient
) {
  await deliver(
    "payment.recorded",
    tenant,
    `Payment of ${formatCurrencyFull(payment.amount)} received`,
    {
      heading: payment.fromClaim ? "Your payment is confirmed" : "Payment received",
      body: [
        `${payment.fromClaim ? "Your landlord confirmed the payment you reported" : "Your landlord recorded a payment"} of <strong>${escapeHtml(formatCurrencyFull(payment.amount))}</strong>, paid on ${escapeHtml(formatDate(payment.paidAt))}, against ${escapeHtml(payment.invoiceReference)} — ${escapeHtml(payment.unitLabel)} at ${escapeHtml(payment.propertyName)}.`,
        payment.balance > 0
          ? `Still to pay on this lease: <strong>${escapeHtml(formatCurrencyFull(payment.balance))}</strong>.`
          : "Your lease is now paid in full. Thank you.",
      ],
      action: { label: "View your payments", href: appUrl("/portal/payments") },
    }
  );
}

/* payment_claim.rejected */
export async function sendClaimRejectedToTenant(
  claim: { amount: number; paidAt: Date; reason: string; unitLabel: string },
  tenant: Recipient
) {
  await deliver(
    "payment_claim.rejected",
    tenant,
    `Your reported payment of ${formatCurrencyFull(claim.amount)} wasn't confirmed`,
    {
      heading: "Your landlord couldn't confirm a payment",
      body: [
        `The payment of <strong>${escapeHtml(formatCurrencyFull(claim.amount))}</strong> you reported for ${escapeHtml(formatDate(claim.paidAt))} (${escapeHtml(claim.unitLabel)}) was not confirmed.`,
        `Your landlord's reason: <em>${escapeHtml(claim.reason)}</em>`,
        "Nothing has been added to your balance. If you did pay, contact your landlord with the receipt, or report it again with the right details.",
      ],
      action: { label: "View your payments", href: appUrl("/portal/payments") },
    }
  );
}

/* contract.ready — a contract version was filed */
export async function sendContractReadyToTenant(
  contract: { reference: string; unitLabel: string; propertyName: string; tenantSigned: boolean },
  tenant: Recipient
) {
  await deliver(
    "contract.ready",
    tenant,
    contract.tenantSigned
      ? `Your signed contract for ${contract.unitLabel} is ready`
      : `Your contract for ${contract.unitLabel} is ready to sign`,
    {
      heading: contract.tenantSigned ? "Your signed contract is ready" : "Your contract is ready",
      body: [
        `A new copy of your lease contract (${escapeHtml(contract.reference)}) for <strong>${escapeHtml(contract.unitLabel)}</strong> at <strong>${escapeHtml(contract.propertyName)}</strong> is in your portal.`,
        contract.tenantSigned
          ? "It carries your signature. Download it to keep a copy."
          : "To sign it, draw your signature on your profile page and ask your landlord for a new copy — it will carry your signature.",
      ],
      action: contract.tenantSigned
        ? { label: "Open your documents", href: appUrl("/portal/documents") }
        : { label: "Add your signature", href: appUrl("/portal/profile") },
    }
  );
}
