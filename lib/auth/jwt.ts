import { SignJWT, jwtVerify } from "jose";

export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  sub: string;
  orgId: string | null;
  /**
   * Whether the cookie was issued with a maxAge ("Remember me"). Carried in
   * the token so re-issuing it — e.g. on an organization switch — can keep the
   * same persistence instead of silently upgrading a session-only cookie.
   */
  persist: boolean;
  /** `User.sessionVersion` when minted; a bump there revokes this token. */
  sv: number;
};

/**
 * Both token types share `AUTH_SECRET`, so the audience is what keeps them
 * apart: without it a reset ticket (minted the moment a 6-digit code checks
 * out) verified as a session, signing the code-holder in without the password
 * ever being changed — and without the "password reset" email that would have
 * told the owner.
 */
const SESSION_AUDIENCE = "session";
const RESET_AUDIENCE = "reset";

/** HS256 is only as strong as its key; a short one is guessable offline. */
const MIN_SECRET_BYTES = 32;

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const key = new TextEncoder().encode(secret);
  if (key.byteLength < MIN_SECRET_BYTES) {
    throw new Error(`AUTH_SECRET must be at least ${MIN_SECRET_BYTES} bytes`);
  }
  return key;
}

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT({ orgId: payload.orgId, persist: payload.persist, sv: payload.sv })
    .setSubject(payload.sub)
    .setAudience(SESSION_AUDIENCE)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      audience: SESSION_AUDIENCE,
    });
    // Every token carrying the session audience was minted with `sv`; one
    // without it is not ours to trust.
    if (!payload.sub || typeof payload.sv !== "number") return null;
    return {
      sub: payload.sub,
      orgId: (payload.orgId as string | null) ?? null,
      persist: payload.persist === true,
      sv: payload.sv,
    };
  } catch {
    return null;
  }
}

/**
 * Proof that a reset code was entered correctly, good for one password change.
 *
 * Short-lived and narrow: it names the token row it was minted from, so
 * `completePasswordReset` can confirm that row is still the live one rather
 * than trusting the ticket on its own. Signed with the same secret as the
 * session, but it is not a session — it grants exactly one action.
 */
export const RESET_TICKET_DURATION_SECONDS = 10 * 60;

export type ResetTicketPayload = { sub: string; tokenId: string };

export async function signResetTicket(payload: ResetTicketPayload) {
  return new SignJWT({ tokenId: payload.tokenId, kind: "reset" })
    .setSubject(payload.sub)
    .setAudience(RESET_AUDIENCE)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${RESET_TICKET_DURATION_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyResetTicket(
  token: string
): Promise<ResetTicketPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      audience: RESET_AUDIENCE,
    });
    // `kind` keeps a session cookie from being replayed as a reset ticket:
    // both are signed with AUTH_SECRET, so without it a stolen session token
    // would authorise a password change without knowing the old password.
    if (payload.kind !== "reset") return null;
    if (!payload.sub || typeof payload.tokenId !== "string") return null;
    return { sub: payload.sub, tokenId: payload.tokenId };
  } catch {
    return null;
  }
}
