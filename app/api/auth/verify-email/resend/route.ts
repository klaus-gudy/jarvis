import { after } from "next/server";

import { issueEmailVerification } from "@/lib/auth/email-verification";
import { getCurrentUser } from "@/lib/auth/session";
import { sendEmailVerificationEmail } from "@/lib/mail/auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Keyed on the account rather than the IP: the caller is signed in, so the
 * account is known, and it is the mailbox — not the network — that a resend
 * loop would flood.
 */
const PER_USER = { limit: 3, windowMs: 10 * 60_000 };

/** Sends a fresh code, invalidating whatever was outstanding. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(`verify-email-resend:${user.id}`, PER_USER);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  after(async () => {
    // Returns null for an account with nothing to verify — already confirmed,
    // never required, or no address. Silently doing nothing is right: the
    // caller is signed in, so there is no enumeration risk, and any of those
    // states means the gate isn't holding them anyway.
    const issued = await issueEmailVerification(user.id);
    if (!issued) return;

    await sendEmailVerificationEmail({
      to: issued.email,
      name: issued.name,
      code: issued.code,
      expiresInMinutes: issued.expiresInMinutes,
    });
  });

  return Response.json({ ok: true });
}
