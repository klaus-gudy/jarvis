import { z } from "zod";

import { acceptInvitation } from "@/lib/invitations";
import { createSession } from "@/lib/auth/session";
import { optionalTzPhoneSchema } from "@/lib/phone";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Public by design — the token is the credential. It is never logged, and every
 * failure returns the same generic message so this can't be used to probe which
 * tokens exist.
 */
const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(100),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
  email: z
    .literal("")
    .transform(() => undefined)
    .or(z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")))
    .optional(),
  phone: optionalTzPhoneSchema,
});

/**
 * The invite token is a 32-byte random value, so guessing it is hopeless — but
 * this endpoint is public and creates accounts, so it gets a budget for the
 * same reason registration does.
 */
const PER_IP = { limit: 10, windowMs: 10 * 60_000 };

export async function POST(request: Request) {
  const limited = rateLimit(`invite-accept:ip:${clientIp(request)}`, PER_IP);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { token, phone, ...input } = parsed.data;
  const result = await acceptInvitation(token, { ...input, phone: phone ?? undefined });

  if (result.error === "invalid" || result.error === "expired") {
    return Response.json(
      { error: "This invitation is no longer valid" },
      { status: 410 }
    );
  }
  if (result.error === "missing-identifier") {
    return Response.json(
      { error: "Provide an email or phone number to finish signing up" },
      { status: 400 }
    );
  }
  if (result.error === "already-member") {
    return Response.json(
      { error: "You are already a member of this organization — please sign in" },
      { status: 409 }
    );
  }

  // Signs the new member straight in, so accepting lands them in the app.
  await createSession(result.accepted.userId, result.accepted.organizationId);

  return Response.json({ ok: true });
}
