import { after } from "next/server";
import { z } from "zod";

import { requestPasswordReset } from "@/lib/auth/reset";
import { sendPasswordResetCodeEmail } from "@/lib/mail/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone"),
});

/** Issuing a code costs a bcrypt hash and an email, so the budget is tight. */
const PER_IP = { limit: 5, windowMs: 15 * 60_000 };
/**
 * And tighter per account, so one address can't be mailbombed by someone
 * repeatedly "forgetting" its password.
 */
const PER_IDENTIFIER = { limit: 3, windowMs: 15 * 60_000 };

/**
 * Starts a password reset.
 *
 * **Always answers `{ ok: true }`.** Whether the account exists, whether it
 * has a password, and whether it has an email address are all invisible from
 * out here — anything else turns this endpoint into an account-enumeration
 * oracle, and it is reachable by anyone, signed out.
 */
export async function POST(request: Request) {
  const limited = rateLimit(`forgot:ip:${clientIp(request)}`, PER_IP);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { identifier } = parsed.data;

  const byIdentifier = rateLimit(
    `forgot:id:${identifier.toLowerCase()}`,
    PER_IDENTIFIER
  );

  // A rejected per-identifier budget still answers ok: telling the caller
  // "too many requests for that account" would confirm the account exists.
  if (byIdentifier.ok) {
    after(async () => {
      const issued = await requestPasswordReset(identifier);
      if (!issued) return;

      await sendPasswordResetCodeEmail({
        to: issued.email,
        name: issued.name,
        code: issued.code,
        expiresInMinutes: issued.expiresInMinutes,
      });
    });
  }

  return Response.json({ ok: true });
}
