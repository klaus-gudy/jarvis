import bcrypt from "bcryptjs";

/**
 * 12 rounds. Hashes made at the old cost of 10 still verify; `needsRehash`
 * lets login upgrade them the next time the plaintext is in hand.
 */
const COST = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Whether a stored hash was made below the current cost. */
export function needsRehash(hash: string) {
  return bcrypt.getRounds(hash) < COST;
}
