import { after } from "next/server";
import { z } from "zod";

import { acceptInvitation, announceInvitationAccepted } from "@/lib/invitations";
import { createSession, getSession } from "@/lib/auth/session";
import { optionalTzPhoneSchema } from "@/lib/phone";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Public by design — the token is the credential. It is never logged, and every
 * failure returns the same generic message so this can't be used to probe which
 * tokens exist.
 */
const newAccountSchema = z.object({
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

/** Joining with the account you are signed in as — nothing else is sent. */
const signedInSchema = z.object({
  token: z.string().min(1),
  asSignedIn: z.literal(true),
});

/**
 * The invite token is a 32-byte random value, so guessing it is hopeless — but
 * this endpoint is public and creates accounts, so it gets a budget for the
 * same reason registration does.
 */
const PER_IP = { limit: 10, windowMs: 10 * 60_000 };

const REFUSALS = {
  invalid: [410, "This invitation is no longer valid"],
  expired: [410, "This invitation is no longer valid"],
  "missing-identifier": [400, "Provide an email or phone number to finish signing up"],
  "already-member": [409, "You are already a member of this organization — please sign in"],
  "sign-in-required": [
    409,
    "An account already uses these details. Sign in to it, then open this invitation again to join.",
  ],
  "account-exists": [
    409,
    "An account already uses these details. Ask whoever invited you to check the phone number or email on the invitation.",
  ],
  "wrong-account": [
    403,
    "This invitation was sent to different contact details than the account you are signed in as.",
  ],
  "identifier-conflict": [
    409,
    "The email and phone on this invitation belong to two different accounts. Ask whoever invited you to fix it.",
  ],
} as const;

export async function POST(request: Request) {
  const limited = rateLimit(`invite-accept:ip:${clientIp(request)}`, PER_IP);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let token: string;
  let result: Awaited<ReturnType<typeof acceptInvitation>>;

  const signedIn = signedInSchema.safeParse(body);
  if (signedIn.success) {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Sign in first", reason: "sign-in-required" }, { status: 401 });
    }
    token = signedIn.data.token;
    result = await acceptInvitation(token, { signedInUserId: session.sub });
  } else {
    const parsed = newAccountSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { phone, ...input } = parsed.data;
    token = input.token;
    result = await acceptInvitation(token, { ...input, phone: phone ?? undefined });
  }

  if ("error" in result && result.error) {
    const [status, error] = REFUSALS[result.error];
    return Response.json({ error, reason: result.error }, { status });
  }

  // Either a new account, a passwordless member activating, or the signed-in
  // user themselves — never someone else's existing account.
  await createSession(result.accepted.userId, result.accepted.organizationId);
  const { userId, organizationId } = result.accepted;
  after(() => announceInvitationAccepted(userId, organizationId));

  return Response.json({ ok: true });
}
