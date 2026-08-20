import { randomInt } from "node:crypto";

import { hashPassword, verifyPassword } from "@/lib/auth/hash";

/**
 * The policy shared by every emailed one-time code — password reset today,
 * email verification alongside it.
 *
 * Only the *policy* is shared. Each purpose keeps its own table and its own
 * queries: one table with a `purpose` column would put an account takeover one
 * forgotten `where` clause away, and that is not a trade worth making to save
 * a few lines.
 */

export const CODE_LENGTH = 6;
/** Wrong guesses before the code is destroyed and a new one must be requested. */
export const MAX_ATTEMPTS = 5;

/**
 * Six digits is a million possibilities, which is not much — so `attempts`,
 * not entropy, is what stops a guess. `randomInt` is CSPRNG-backed;
 * `Math.random` is not, and a predictable code is a free account.
 */
export function generateCode() {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/**
 * bcrypt, not SHA-256 — the opposite of `lib/invitations.ts`, and for the
 * reason that module's own comment gives in reverse. An invite token is 256
 * random bits, so a fast deterministic hash is safe. A six-digit code is one
 * of a million, and a SHA-256 column of those is a lookup table. Affordable
 * because the user is already known, so verifying is one compare, not a scan.
 */
export function hashCode(code: string) {
  return hashPassword(code);
}

/** The minimum a token row has to expose to be checked. */
export type CodeRow = {
  id: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
};

export type CodeCheck =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "too-many-attempts" };

/**
 * Checks a submitted code against a token row, spending an attempt on a miss.
 *
 * The two writes are passed in rather than done here, so each purpose keeps
 * its own Prisma model and this stays unable to touch the wrong table.
 * `destroy` is called for expiry and lockout alike: a dead code should leave
 * no row behind to be guessed at again.
 */
export async function checkCode(
  row: CodeRow,
  code: string,
  writes: {
    /** Bump `attempts` by one and return the new value. */
    incrementAttempts: () => Promise<number>;
    destroy: () => Promise<unknown>;
  }
): Promise<CodeCheck> {
  if (row.expiresAt < new Date()) {
    await writes.destroy();
    return { ok: false, reason: "expired" };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await writes.destroy();
    return { ok: false, reason: "too-many-attempts" };
  }

  if (!(await verifyPassword(code, row.codeHash))) {
    const attempts = await writes.incrementAttempts();
    // Burned on the last allowed guess rather than on the next request, so an
    // attacker gets exactly MAX_ATTEMPTS tries and not one more.
    if (attempts >= MAX_ATTEMPTS) {
      await writes.destroy();
      return { ok: false, reason: "too-many-attempts" };
    }
    return { ok: false, reason: "invalid" };
  }

  return { ok: true };
}

/** The message a failed check should show. Shared so the two flows agree. */
export function codeErrorMessage(reason: "invalid" | "expired" | "too-many-attempts") {
  if (reason === "expired") return "That code has expired. Request a new one.";
  if (reason === "too-many-attempts") {
    return "Too many incorrect attempts. Request a new code.";
  }
  return "That code isn't right.";
}
