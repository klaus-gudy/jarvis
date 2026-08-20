import { after } from "next/server";

import { changePasswordSchema } from "@/lib/account-schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { sendPasswordChangedEmail } from "@/lib/mail/auth";
import { prisma } from "@/lib/prisma";

/**
 * Changes the signed-in user's own password. Not org-scoped — a password
 * belongs to the User, not to a membership — so this uses `getCurrentUser`
 * rather than `requireActiveOrg`, and an org-less user can still use it.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  // A member onboarded by staff has no password to change; sending them
  // through here would let anyone with their session set one without proving
  // anything. They activate through an invitation instead.
  if (!record?.passwordHash) {
    return Response.json(
      { error: "This account has no password yet. Accept an invitation to set one." },
      { status: 409 }
    );
  }

  const valid = await verifyPassword(
    parsed.data.currentPassword,
    record.passwordHash
  );
  if (!valid) {
    return Response.json(
      {
        error: "Validation failed",
        issues: { currentPassword: ["That is not your current password"] },
      },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  // A password change is the one account event worth telling someone about
  // even when they made it themselves — it is how an unauthorised change gets
  // noticed at all.
  after(() =>
    sendPasswordChangedEmail({
      to: user.email,
      name: user.name,
      changedAt: new Date(),
    })
  );

  // The session cookie is deliberately left alone: signing the user out of the
  // tab they just used would look like the change failed. Sessions elsewhere
  // stay valid too — revoking them needs a token version on the JWT, which is
  // a separate change.
  return Response.json({ ok: true });
}
