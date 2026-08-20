import { after } from "next/server";

import { sendAccountLockedEmail } from "@/lib/mail/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { loginSchema } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";
import { normalizeTzPhone } from "@/lib/phone";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/** Generous enough for someone genuinely mistyping, useless for guessing. */
const PER_IP = { limit: 10, windowMs: 60_000 };
/**
 * A second, tighter budget per account. Without it, a spread-out attacker
 * could keep every IP under the limit while still hammering one login.
 */
const PER_ACCOUNT = { limit: 5, windowMs: 60_000 };
/**
 * A second limiter, used purely to cap the lockout *email*.
 *
 * Every request made while an account is locked out is rejected, not just the
 * one that crossed the threshold — so notifying on each rejection would hand
 * an attacker a mail bomb aimed at the victim, triggered by the very defence
 * meant to protect them. `limit: 1` over a long window means at most four
 * notices an hour no matter how hard the account is hammered.
 */
const LOCKOUT_NOTICE = { limit: 1, windowMs: 15 * 60_000 };

export async function POST(request: Request) {
  const ip = clientIp(request);
  const byIp = rateLimit(`login:ip:${ip}`, PER_IP);
  if (!byIp.ok) return tooManyRequests(byIp.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { identifier, password } = parsed.data;

  // Keyed on the identifier as typed, lowercased — close enough to "the
  // account being targeted" without a lookup, and a miss just means the
  // attacker is spreading across spellings, which is slower for them anyway.
  const byAccount = rateLimit(
    `login:id:${identifier.trim().toLowerCase()}`,
    PER_ACCOUNT
  );

  const isEmail = identifier.includes("@");
  // Stored phones are always the normalized 10-digit local form, so a phone
  // identifier has to be normalized the same way before it can match one. An
  // unnormalizable phone just means no user will match — treated as unknown
  // below rather than rejected here, so response timing stays uniform.
  const normalizedPhone = isEmail ? null : normalizeTzPhone(identifier);

  if (!byAccount.ok) {
    const noticeAllowed = rateLimit(
      `lockout-notice:${identifier.trim().toLowerCase()}`,
      LOCKOUT_NOTICE
    );

    // Resolved and sent after the response, so the extra lookup costs the
    // caller nothing and can't make a locked-out identifier that exists take
    // measurably longer than one that doesn't.
    if (noticeAllowed.ok) {
      after(async () => {
        const target =
          isEmail || normalizedPhone
            ? await prisma.user.findUnique({
                where: isEmail
                  ? { email: identifier.toLowerCase() }
                  : { phone: normalizedPhone! },
                select: { email: true, name: true, passwordHash: true },
              })
            : null;

        // No account, or one that can't sign in anyway: nothing was locked
        // out, so there is nothing to warn anyone about.
        if (!target?.passwordHash) return;

        await sendAccountLockedEmail({
          to: target.email,
          name: target.name,
          retryAfterSeconds: byAccount.retryAfterSeconds,
          ip,
          at: new Date(),
        });
      });
    }

    return tooManyRequests(byAccount.retryAfterSeconds);
  }

  const user =
    isEmail || normalizedPhone
      ? await prisma.user.findUnique({
          where: isEmail ? { email: identifier.toLowerCase() } : { phone: normalizedPhone! },
          include: {
            memberships: {
              orderBy: { createdAt: "asc" },
              include: { organization: true, role: true },
            },
          },
        })
      : null;

  // Hash even when the user is unknown, or has no password set, so response
  // timing doesn't reveal which identifiers exist. A null passwordHash means an
  // assisted-onboarding tenant or an unaccepted invitee: no sign-in, and the
  // same generic error so the account's existence isn't disclosed.
  if (!user || !user.passwordHash) {
    await hashPassword(password);
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const activeMembership = user.memberships[0] ?? null;
  await createSession(user.id, activeMembership?.organizationId ?? null, {
    persist: parsed.data.remember ?? true,
  });

  return Response.json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    organization: activeMembership
      ? {
          id: activeMembership.organization.id,
          name: activeMembership.organization.name,
        }
      : null,
    role: activeMembership?.role.name ?? null,
  });
}
