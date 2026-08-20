import { randomInt } from "node:crypto";

import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { normalizeTzPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

/**
 * Password reset by one-time code.
 *
 * The code is six digits because `/verify-otp` asks for six and a person has
 * to retype it from an email — which also makes it only a million
 * possibilities, so the guessing defence is `attempts`, not entropy. Three
 * separate limits apply: five wrong guesses burns the code, the code expires
 * in ten minutes, and the endpoints are IP rate-limited on top.
 *
 * Only the bcrypt hash is stored. SHA-256 would be wrong here for the reason
 * it is *right* in `lib/invitations.ts`: an invite token is 256 random bits, a
 * six-digit code is not, and a fast hash of a million-value space is a lookup
 * table.
 */

export const RESET_CODE_LENGTH = 6;
export const RESET_TTL_MINUTES = 10;
/** Wrong guesses before the code is destroyed and a new one must be requested. */
const MAX_ATTEMPTS = 5;

function generateCode() {
  // `randomInt` is CSPRNG-backed; `Math.random` is not, and a predictable
  // reset code is a full account takeover.
  return String(randomInt(0, 10 ** RESET_CODE_LENGTH)).padStart(
    RESET_CODE_LENGTH,
    "0"
  );
}

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
      data: { userId: user.id, codeHash: await hashPassword(code), expiresAt },
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

  if (token.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: token.id } });
    return { ok: false, reason: "expired" };
  }

  if (token.attempts >= MAX_ATTEMPTS) {
    await prisma.passwordResetToken.delete({ where: { id: token.id } });
    return { ok: false, reason: "too-many-attempts" };
  }

  if (!(await verifyPassword(code, token.codeHash))) {
    const { attempts } = await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    // Burned on the last allowed guess rather than on the next request, so an
    // attacker gets exactly MAX_ATTEMPTS tries and not one more.
    if (attempts >= MAX_ATTEMPTS) {
      await prisma.passwordResetToken.delete({ where: { id: token.id } });
      return { ok: false, reason: "too-many-attempts" };
    }
    return { ok: false, reason: "invalid" };
  }

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
