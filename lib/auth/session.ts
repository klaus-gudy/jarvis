import { cache } from "react";
import { cookies } from "next/headers";

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
  const token = await signSessionToken({ sub: userId, orgId, persist });
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
      memberships: {
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      },
    },
  });
  if (!user) return null;

  // The token's orgId is a claim, not a fact: the membership may have been
  // revoked (or the org deleted) since it was signed, and trusting it would
  // let a removed member keep reading that org's data for the token's
  // remaining lifetime. Validate against live memberships on every request,
  // falling back to the oldest remaining one — the same default login uses.
  // Cookies can't be rewritten during render, so the correction is
  // per-request; the cookie itself catches up on the next switch or login.
  const { memberships, ...rest } = user;
  const orgIds = memberships.map((m) => m.organizationId);
  const activeOrgId =
    session.orgId && orgIds.includes(session.orgId)
      ? session.orgId
      : orgIds[0] ?? null;

  return { ...rest, activeOrgId };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
