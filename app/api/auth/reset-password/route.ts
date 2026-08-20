import { after } from "next/server";
import { z } from "zod";

import { completePasswordReset } from "@/lib/auth/reset";
import { clearResetTicket, getResetTicket } from "@/lib/auth/reset-ticket";
import { sendPasswordResetCompletedEmail } from "@/lib/mail/auth";

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

/**
 * Sets the new password. Authorised entirely by the reset ticket cookie — the
 * caller proved they hold the code at `/verify-otp`, and nothing about the
 * account is passed in here.
 */
export async function POST(request: Request) {
  const ticket = await getResetTicket();
  if (!ticket) {
    return Response.json(
      { error: "Your reset session has expired. Start again." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await completePasswordReset(
    ticket.sub,
    ticket.tokenId,
    parsed.data.password
  );

  if (!result.ok) {
    // The ticket verified but its token row is gone — expired, or superseded
    // by a newer request since. Clear the cookie so the retry starts clean.
    await clearResetTicket();
    return Response.json(
      { error: "Your reset session has expired. Start again." },
      { status: 401 }
    );
  }

  await clearResetTicket();

  // No session is issued: the password changed, so signing in with it is the
  // proof that it worked, and it is the one step an attacker who got this far
  // could not fake to themselves.
  after(() =>
    sendPasswordResetCompletedEmail({
      to: result.email,
      name: result.name,
      resetAt: new Date(),
    })
  );

  return Response.json({ ok: true });
}
