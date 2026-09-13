import { MAIL_SERVICE_NAME, type MailRoutingKey } from "@/lib/mail/config";
import {
  appUrl,
  escapeHtml,
  renderEmail,
  type EmailParts,
} from "@/lib/mail/layout";
import { publishMail } from "@/lib/mail/queue";
import { SITE_NAME } from "@/lib/site";

/**
 * Section B of the email catalogue — invitations.
 *
 * **The one message in the product addressed to someone who is not a member
 * yet.** That is worth stating because 2026-08-31 settled the opposite rule for
 * everything else: domain email goes to owners, and the tenant-facing senders
 * were deleted outright. An invitation is the deliberate exception, and it is
 * not really an exception at all — nobody is being mailed about a tenancy they
 * never asked to hear about. A member of the organization typed this address in
 * and asked us to contact it, and the message contains exactly one thing: the
 * link they were promised.
 *
 * Same rules as `lib/mail/auth.ts`: renders a finished email and hands it to
 * the queue, never throws, and is called inside `after()` so a slow broker
 * cannot delay the response or fail the invitation that triggered it.
 */

/** "Hi Amina," — or a plain greeting when we only ever got a phone number. */
function greeting(name: string | null | undefined) {
  return name?.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi,";
}

async function deliver(
  routingKey: MailRoutingKey,
  to: string | null | undefined,
  subject: string,
  parts: EmailParts,
) {
  // An invitation may carry a phone and no email — phone is the mandatory
  // identifier, email is optional — so "no address" is an ordinary state, not
  // a failure. The link still exists; the inviter shares it by hand.
  if (!to) {
    console.warn(
      `[mail] skipped ${routingKey}: invitation has no email address`,
    );
    return;
  }

  await publishMail(routingKey, {
    email: to,
    subject,
    content: renderEmail(parts),
    service_name: MAIL_SERVICE_NAME,
  });
}

/* ------------------------------------------------------------------ *
 * invitation.sent — POST /api/invitations
 * ------------------------------------------------------------------ */

export async function sendInvitationEmail(input: {
  to: string | null;
  /** The invitee's name, if whoever invited them typed one. */
  name: string | null;
  /** The organization they are being invited to join. */
  organizationName: string;
  /** The role they will hold — "Owner", "Tenant", "Caretaker". */
  roleName: string;
  /** Who sent it, for "X invited you". Null when the inviter has no name set. */
  invitedByName: string | null;
  /** The raw token. Returned exactly once by `createInvitation`. */
  token: string;
  expiresInDays: number;
}) {
  const org = escapeHtml(input.organizationName);
  const role = escapeHtml(input.roleName);
  const inviter = input.invitedByName?.trim()
    ? escapeHtml(input.invitedByName.trim())
    : null;

  // Subject built from the raw values, not the escaped ones: it is a header,
  // not HTML, and `&amp;` in a subject line is a bug a reader can see.
  const subject = input.invitedByName?.trim()
    ? `${input.invitedByName.trim()} invited you to join ${input.organizationName} on ${SITE_NAME}`
    : `You've been invited to join ${input.organizationName} on ${SITE_NAME}`;

  await deliver("invitation.sent", input.to, subject, {
    heading: `Join ${org} on ${SITE_NAME}`,
    body: [
      greeting(input.name),
      inviter
        ? `<strong>${inviter}</strong> has invited you to join <strong>${org}</strong> as <strong>${role}</strong>.`
        : `You have been invited to join <strong>${org}</strong> as <strong>${role}</strong>.`,
      "Use the button below to accept and set a password. The link is personal to you — anyone who has it can accept in your place, so don't forward it.",
    ],
    /*
     * `appUrl`, not the browser's origin. The dialog builds its copyable link
     * from `window.location.origin`, which is right there and wrong here: an
     * email is rendered on the server, often by a background job, and a link
     * pointing at `localhost:3347` is the kind of thing that only fails in
     * production. `NEXT_PUBLIC_SITE_URL` is the address this app actually
     * answers on.
     */
    action: {
      label: "Accept the invitation",
      href: appUrl(`/invite/${input.token}`),
    },
    footnote: `The invitation expires in ${input.expiresInDays} days and can be used once. If you weren't expecting it, ignore this email — nothing is created until you accept.`,
  });
}
