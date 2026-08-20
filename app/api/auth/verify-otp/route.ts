import { z } from "zod";

import { setResetTicket } from "@/lib/auth/reset-ticket";
import { RESET_CODE_LENGTH, verifyResetCode } from "@/lib/auth/reset";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const verifyOtpSchema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or phone"),
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`), "Enter the 6-digit code"),
});

/**
 * Tight, because this is the one endpoint where guessing pays. The per-code
 * attempt counter in `verifyResetCode` is the real limit — this stops an
 * attacker burning through fresh codes to reset it.
 */
const PER_IP = { limit: 10, windowMs: 10 * 60_000 };

/**
 * Checks a reset code and, on success, issues the reset ticket that
 * `POST /api/auth/reset-password` requires.
 *
 * The code is deliberately *not* spent here: `/verify-otp` and
 * `/reset-password` are two screens, and the token has to survive between
 * them. The ticket is what carries the proof forward — an httpOnly cookie, so
 * the code itself never appears in a URL.
 */
export async function POST(request: Request) {
  const limited = rateLimit(`verify-otp:ip:${clientIp(request)}`, PER_IP);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await verifyResetCode(parsed.data.identifier, parsed.data.code);

  if (!result.ok) {
    // One message for "wrong" and "no such account", so a wrong code and an
    // unknown identifier are indistinguishable. Expiry and lockout say what
    // happened, because both are dead ends the user has to act on and neither
    // reveals whether the account exists — you only reach them by having had
    // a code issued.
    const message =
      result.reason === "expired"
        ? "That code has expired. Request a new one."
        : result.reason === "too-many-attempts"
          ? "Too many incorrect attempts. Request a new code."
          : "That code isn't right.";

    return Response.json({ error: message, reason: result.reason }, { status: 400 });
  }

  await setResetTicket({ sub: result.userId, tokenId: result.tokenId });

  return Response.json({ ok: true });
}
