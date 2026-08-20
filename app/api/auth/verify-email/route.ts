import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { confirmEmailVerification } from "@/lib/auth/email-verification";
import { CODE_LENGTH, codeErrorMessage } from "@/lib/auth/one-time-code";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

const verifyEmailSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), `Enter the ${CODE_LENGTH}-digit code`),
});

/** The per-code attempt cap is the real limit; this stops an attacker cycling
 * fresh codes to reset it. */
const PER_IP = { limit: 20, windowMs: 10 * 60_000 };

/**
 * Confirms the address on the signed-in account.
 *
 * Not part of `requireVerifiedUser`'s gate, obviously — this is the way
 * through it — so it authenticates with `getCurrentUser` directly.
 */
export async function POST(request: Request) {
  const limited = rateLimit(`verify-email:ip:${clientIp(request)}`, PER_IP);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await confirmEmailVerification(user.id, parsed.data.code);

  if (!result.ok) {
    const error =
      result.reason === "no-code"
        ? "No code is outstanding. Send yourself a new one."
        : codeErrorMessage(result.reason);
    return Response.json({ error, reason: result.reason }, { status: 400 });
  }

  return Response.json({ ok: true });
}
