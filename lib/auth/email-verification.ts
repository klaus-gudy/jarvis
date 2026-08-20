import { checkCode, generateCode, hashCode } from "@/lib/auth/one-time-code";
import { prisma } from "@/lib/prisma";

/**
 * Proving that the address on an account can actually receive mail.
 *
 * Only self-service registrations are held to this: `emailVerificationRequired`
 * is set by `POST /api/auth/register` and by nothing else, so someone who
 * joined through an invitation — vouched for by a member of their
 * organization — is never stopped, and every account that predates the feature
 * keeps the column's `false` default.
 */

export const VERIFICATION_TTL_MINUTES = 30;

/** Everything the gate needs to know, from a user record. */
export type VerificationSubject = {
  email: string | null;
  emailVerifiedAt: Date | null;
  emailVerificationRequired: boolean;
};

/**
 * Whether this account is blocked until it verifies.
 *
 * The `email` check is not belt-and-braces: an account with no address has
 * nothing to verify and no way to receive a code, so gating one would lock it
 * out permanently. Registration always records an email, so a user who is
 * required *and* has none should not exist — but the gate is the wrong place
 * to find that out.
 */
export function needsEmailVerification(user: VerificationSubject) {
  return (
    user.emailVerificationRequired &&
    user.emailVerifiedAt === null &&
    user.email !== null
  );
}

export type IssuedVerification = {
  email: string;
  name: string | null;
  code: string;
  expiresInMinutes: number;
};

/**
 * Issues a code for a user who is already signed in, so unlike a password
 * reset there is nothing to hide: the caller knows exactly whose account this
 * is. Returns null only when there is genuinely nothing to verify.
 */
export async function issueEmailVerification(
  userId: string
): Promise<IssuedVerification | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      emailVerifiedAt: true,
      emailVerificationRequired: true,
    },
  });
  if (!user?.email) return null;
  if (!needsEmailVerification(user)) return null;

  const code = generateCode();
  const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MINUTES * 60_000);

  await prisma.$transaction([
    // At most one live code per user, so "resend" can't leave the previous one
    // working behind it.
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.create({
      data: { userId, codeHash: await hashCode(code), expiresAt },
    }),
  ]);

  return {
    email: user.email,
    name: user.name,
    code,
    expiresInMinutes: VERIFICATION_TTL_MINUTES,
  };
}

export type ConfirmResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "too-many-attempts" | "no-code" };

/**
 * Spends the code and marks the address verified, in one transaction so a
 * confirmed account can never leave a working code behind it.
 */
export async function confirmEmailVerification(
  userId: string,
  code: string
): Promise<ConfirmResult> {
  const token = await prisma.emailVerificationToken.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return { ok: false, reason: "no-code" };

  const check = await checkCode(token, code, {
    incrementAttempts: async () =>
      (
        await prisma.emailVerificationToken.update({
          where: { id: token.id },
          data: { attempts: { increment: 1 } },
          select: { attempts: true },
        })
      ).attempts,
    destroy: () =>
      prisma.emailVerificationToken.delete({ where: { id: token.id } }),
  });
  if (!check.ok) return check;

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
