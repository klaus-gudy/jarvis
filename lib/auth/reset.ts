import { hashPassword } from "@/lib/auth/hash";
import {
  CODE_LENGTH,
  checkCode,
  generateCode,
  hashCode,
} from "@/lib/auth/one-time-code";
import { normalizeTzPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

/**
 * Password reset by one-time code.
 *
 * The code's shape and guessing defences live in `lib/auth/one-time-code.ts`,
 * shared with email verification. What is specific to a reset is here: who a
 * code may be issued to, and what spending one is allowed to do.
 */

export const RESET_CODE_LENGTH = CODE_LENGTH;
export const RESET_TTL_MINUTES = 10;

/**
 * Resolves "email or phone, as typed" to an account, the same way
 * `POST /api/auth/login` does — stored phones are always the normalized
 * 10-digit local form, so a phone identifier has to be normalized to match.
 */
async function findUserByIdentifier(identifier: string) {
  const isEmail = identifier.includes("@");
  const normalizedPhone = isEmail ? null : normalizeTzPhone(identifier);
  if (!isEmail && !normalizedPhone) return null;

  return prisma.user.findUnique({
    where: isEmail
      ? { email: identifier.trim().toLowerCase() }
      : { phone: normalizedPhone! },
    select: { id: true, name: true, email: true, passwordHash: true },
  });
}

export type ResetRequest = {
  userId: string;
  email: string;
  name: string | null;
  code: string;
  expiresInMinutes: number;
};

/**
 * Issues a code, or returns null when there is nobody to issue one to.
 *
 * **The caller must respond identically either way.** Whether an account
 * exists, whether it has a password, and whether it has an email address are
 * all things this endpoint must not disclose — it is reachable signed out by
 * anyone, so a difference in response is an account-enumeration oracle.
 */
export async function requestPasswordReset(
  identifier: string
): Promise<ResetRequest | null> {
  const user = await findUserByIdentifier(identifier);

  // No account, or one that cannot sign in at all: a tenant onboarded by staff
  // has no password to reset and gains access through an invitation instead,
  // so there is nothing here for a reset to do.
  if (!user?.passwordHash) return null;

  // Delivery is email-only. Someone who signed up with a phone and no email
  // has no channel to receive a code on; nothing is issued, because a code
  // that cannot be delivered is only a row that can be guessed at.
  if (!user.email) return null;

  const code = generateCode();
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000);

  await prisma.$transaction([
    // At most one live code per user: requesting a second invalidates the
    // first, so "send it again" can't leave two working codes behind.
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, codeHash: await hashCode(code), expiresAt },
    }),
  ]);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    code,
    expiresInMinutes: RESET_TTL_MINUTES,
  };
}

export type VerifyResult =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; reason: "invalid" | "expired" | "too-many-attempts" };

/**
 * Checks a code without spending it — `/verify-otp` is a separate step from
 * `/reset-password`, so the token has to survive until the password is
 * actually set. A wrong guess still costs an attempt.
 */
export async function verifyResetCode(
  identifier: string,
  code: string
): Promise<VerifyResult> {
  const user = await findUserByIdentifier(identifier);
  if (!user) return { ok: false, reason: "invalid" };

  const token = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return { ok: false, reason: "invalid" };

  const check = await checkCode(token, code, {
    incrementAttempts: async () =>
      (
        await prisma.passwordResetToken.update({
          where: { id: token.id },
          data: { attempts: { increment: 1 } },
          select: { attempts: true },
        })
      ).attempts,
    destroy: () => prisma.passwordResetToken.delete({ where: { id: token.id } }),
  });
  if (!check.ok) return check;

  return { ok: true, userId: user.id, tokenId: token.id };
}

/**
 * Spends the token and sets the new password, in one transaction so a reset
 * can never leave a used code still working.
 *
 * The token id is re-checked rather than trusted from the ticket alone: the
 * ticket proves the code was verified, but the row it names may have been
 * superseded by a newer request in the meantime.
 */
export async function completePasswordReset(
  userId: string,
  tokenId: string,
  newPassword: string
): Promise<{ ok: true; email: string | null; name: string | null } | { ok: false }> {
  const token = await prisma.passwordResetToken.findFirst({
    where: { id: tokenId, userId, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!token) return { ok: false };

  const passwordHash = await hashPassword(newPassword);

  const [, user] = await prisma.$transaction([
    // Every code for this user, not just the one used: any other outstanding
    // request is now stale, and one of them may be an attacker's.
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { email: true, name: true },
    }),
  ]);

  return { ok: true, email: user.email, name: user.name };
}
