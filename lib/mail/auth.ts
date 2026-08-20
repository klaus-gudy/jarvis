import { MAIL_SERVICE_NAME, type MailRoutingKey } from "@/lib/mail/config";
import { appUrl, escapeHtml, renderEmail, type EmailParts } from "@/lib/mail/layout";
import { publishMail } from "@/lib/mail/queue";
import { SITE_NAME } from "@/lib/site";

/**
 * Section A of the email catalogue — everything addressed to the account
 * holder themselves. Each function renders a finished email and hands it to
 * the queue; the mail service sends exactly what it is given.
 *
 * **None of these throw and none of them are awaited by a request.** Call them
 * inside `after()` from `next/server` so a slow or missing broker can't delay
 * a response, and a failed publish can't fail the operation that triggered it:
 * a registration that succeeded is still a registration when the welcome email
 * doesn't go out.
 */

/** Tanzanian local time — a security notice with a UTC timestamp on it invites
 * exactly the "was that me?" confusion it exists to resolve. */
function formatMoment(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Dar_es_Salaam",
    timeZoneName: "short",
  }).format(date);
}

/** "Hi Amina," — or a plain greeting when we only ever got a phone number. */
function greeting(name: string | null | undefined) {
  return name?.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi,";
}

async function deliver(
  routingKey: MailRoutingKey,
  to: string | null | undefined,
  subject: string,
  parts: EmailParts
) {
  // `User.email` is nullable and tenant onboarding requires phone instead, so
  // "no address" is an ordinary state here, not an error. Nothing is queued
  // and nothing is retried — there is no address to retry to.
  if (!to) {
    console.warn(`[mail] skipped ${routingKey}: recipient has no email address`);
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
 * 1. auth.user.registered — POST /api/auth/register
 * ------------------------------------------------------------------ */

export async function sendWelcomeEmail(input: {
  to: string | null;
  name: string | null;
  organizationName: string;
}) {
  const org = escapeHtml(input.organizationName);

  await deliver("auth.user.registered", input.to, `Welcome to ${SITE_NAME} — ${input.organizationName} is ready`, {
    heading: `${input.organizationName} is ready`,
    body: [
      greeting(input.name),
      `Your account is live and you are the Owner of <strong>${org}</strong>.`,
      "Start by adding a property, then its units, then the tenants already in them. Everything else — leases, invoices, rent collected — follows from those three.",
    ],
    action: { label: "Open your dashboard", href: appUrl("/dashboard") },
    footnote: "You are receiving this because someone created an account with this address.",
  });
}

/* ------------------------------------------------------------------ *
 * 2. auth.email.verification_requested
 *    Not wired: there is no verification-token model yet. Ready for the
 *    endpoint that adds one.
 * ------------------------------------------------------------------ */

export async function sendEmailVerificationEmail(input: {
  to: string;
  name: string | null;
  /** Absolute URL carrying the single-use token. */
  verifyUrl: string;
  expiresAt: Date;
}) {
  await deliver("auth.email.verification_requested", input.to, "Confirm your email address", {
    heading: "Confirm your email address",
    body: [
      greeting(input.name),
      `Confirm <strong>${escapeHtml(input.to)}</strong> so we can send you rent alerts, overdue notices and lease reminders.`,
      `This link works once and expires on ${escapeHtml(formatMoment(input.expiresAt))}.`,
    ],
    action: { label: "Confirm email", href: input.verifyUrl },
    footnote: "Didn't create this account? Ignore this email and nothing happens.",
  });
}

/* ------------------------------------------------------------------ *
 * 3. auth.password.reset_requested
 *    Not wired: POST /api/auth/forgot-password does not exist yet. The
 *    /verify-otp page is already built and expects a 6-digit code.
 * ------------------------------------------------------------------ */

export async function sendPasswordResetCodeEmail(input: {
  to: string;
  name: string | null;
  /** The 6-digit code `/verify-otp` will ask for. */
  code: string;
  expiresInMinutes: number;
}) {
  await deliver("auth.password.reset_requested", input.to, `Your ${SITE_NAME} reset code: ${input.code}`, {
    heading: "Reset your password",
    body: [
      greeting(input.name),
      "Enter this code to set a new password:",
    ],
    code: input.code,
    footnote: `The code expires in ${input.expiresInMinutes} minutes and works once. If you didn't ask for it, your account is untouched — no password has been changed.`,
  });
}

/* ------------------------------------------------------------------ *
 * 4. auth.password.reset_completed
 *    Not wired: the reset endpoint does not exist yet.
 * ------------------------------------------------------------------ */

export async function sendPasswordResetCompletedEmail(input: {
  to: string;
  name: string | null;
  resetAt: Date;
}) {
  await deliver("auth.password.reset_completed", input.to, "Your password has been reset", {
    heading: "Your password has been reset",
    body: [
      greeting(input.name),
      `The password for <strong>${escapeHtml(input.to)}</strong> was reset on ${escapeHtml(formatMoment(input.resetAt))}. You can sign in with it now.`,
    ],
    action: { label: "Sign in", href: appUrl("/login") },
    footnote: "If this wasn't you, someone else has access to this inbox — reset the password again and change your email password too.",
  });
}

/* ------------------------------------------------------------------ *
 * 5. auth.password.changed — POST /api/account/password
 * ------------------------------------------------------------------ */

export async function sendPasswordChangedEmail(input: {
  to: string | null;
  name: string | null;
  changedAt: Date;
}) {
  await deliver("auth.password.changed", input.to, `Your ${SITE_NAME} password was changed`, {
    heading: "Your password was changed",
    body: [
      greeting(input.name),
      `The password on your account was changed on ${escapeHtml(formatMoment(input.changedAt))}.`,
      "If that was you, there is nothing to do — this is just a record of it.",
    ],
    action: { label: "Reset your password", href: appUrl("/forgot-password") },
    footnote: "If it wasn't you, reset the password now. Whoever changed it can currently reach everything in your organization.",
  });
}

/* ------------------------------------------------------------------ *
 * 6. auth.login.locked_out — the per-account limiter in POST /api/auth/login
 * ------------------------------------------------------------------ */

export async function sendAccountLockedEmail(input: {
  to: string | null;
  name: string | null;
  retryAfterSeconds: number;
  /** Best-effort, from `x-forwarded-for` — informational only. */
  ip: string;
  at: Date;
}) {
  const minutes = Math.max(1, Math.ceil(input.retryAfterSeconds / 60));

  await deliver("auth.login.locked_out", input.to, "Sign-in blocked after too many attempts", {
    heading: "Sign-in blocked after too many attempts",
    body: [
      greeting(input.name),
      `We blocked sign-in to your account at ${escapeHtml(formatMoment(input.at))} after too many failed password attempts, from ${escapeHtml(input.ip)}.`,
      `It unlocks by itself in about ${minutes} minute${minutes === 1 ? "" : "s"} — you don't need to do anything.`,
    ],
    footnote: "If that wasn't you, someone is guessing your password. Change it as soon as you are back in.",
  });
}

/* ------------------------------------------------------------------ *
 * 7. org.created — POST /api/organizations
 * ------------------------------------------------------------------ */

export async function sendOrganizationCreatedEmail(input: {
  to: string | null;
  name: string | null;
  organizationName: string;
}) {
  const org = escapeHtml(input.organizationName);

  await deliver("org.created", input.to, `You're now the Owner of ${input.organizationName}`, {
    heading: `${input.organizationName} is set up`,
    body: [
      greeting(input.name),
      `<strong>${org}</strong> has been created and you hold the Owner role in it. It is now the organization you are signed in to.`,
      "Add your properties and units next — tenants and leases hang off those.",
    ],
    action: { label: "Open your dashboard", href: appUrl("/dashboard") },
  });
}
