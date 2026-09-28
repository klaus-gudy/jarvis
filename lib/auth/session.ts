import { cache } from "react";
import { cookies } from "next/headers";

import { parsePermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "./constants";
import {
  SESSION_DURATION_SECONDS,
  signSessionToken,
  verifySessionToken,
} from "./jwt";

export { SESSION_COOKIE };

export async function createSession(
  userId: string,
  orgId: string | null,
  { persist = true }: { persist?: boolean } = {}
) {
  const { sessionVersion: sv } = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { sessionVersion: true },
  });
  const token = await signSessionToken({ sub: userId, orgId, persist, sv });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Without maxAge the cookie dies with the browser — "Remember me" off.
    // The JWT keeps its own 7-day expiry either way.
    ...(persist ? { maxAge: SESSION_DURATION_SECONDS } : {}),
    path: "/",
  });
}

/**
 * Where a server component sends someone whose cookie verifies but no longer
 * names a live session (revoked, or the user deleted). Not `/login` directly:
 * the proxy only checks the signature, so it would bounce a signed cookie from
 * `/login` back to the app, and the app back to `/login`, forever. This route
 * can clear the cookie first; see `app/api/auth/session-expired/route.ts`.
 */
export const SESSION_EXPIRED_PATH = "/api/auth/session-expired";

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
});

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      // Read live, never from the token — same reasoning as `orgId` below.
      // A claim baked into a 7-day cookie would let a user who has since been
      // required to verify keep walking past the gate until it expired.
      emailVerifiedAt: true,
      emailVerificationRequired: true,
      sessionVersion: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        // The role is read live with the membership, never from the token:
        // a demoted or removed member loses access on their next request.
        select: {
          id: true,
          organizationId: true,
          role: { select: { id: true, name: true, kind: true, permissions: true } },
        },
      },
    },
  });
  if (!user) return null;
  // Revoked: the password changed (or was reset) after this token was minted.
  if (user.sessionVersion !== session.sv) return null;

  // The token's orgId is a claim, not a fact: the membership may have been
  // revoked (or the org deleted) since it was signed, and trusting it would
  // let a removed member keep reading that org's data for the token's
  // remaining lifetime. Validate against live memberships on every request,
  // falling back to the oldest remaining one — the same default login uses.
  // Cookies can't be rewritten during render, so the correction is
  // per-request; the cookie itself catches up on the next switch or login.
  const { memberships, ...rest } = user;
  const activeMembership =
    memberships.find((m) => m.organizationId === session.orgId) ??
    memberships[0] ??
    null;

  return {
    ...rest,
    activeOrgId: activeMembership?.organizationId ?? null,
    activeMembership: activeMembership
      ? {
          id: activeMembership.id,
          roleId: activeMembership.role.id,
          roleName: activeMembership.role.name,
          kind: activeMembership.role.kind,
          permissions: parsePermissions(activeMembership.role.permissions),
        }
      : null,
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
