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
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT({ orgId: payload.orgId, persist: payload.persist })
    .setSubject(payload.sub)
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
    });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      orgId: (payload.orgId as string | null) ?? null,
      // Tokens minted before the claim existed were all persistent cookies.
      persist: (payload.persist as boolean | undefined) ?? true,
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
