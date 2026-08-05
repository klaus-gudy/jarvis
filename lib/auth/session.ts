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
  const token = await signSessionToken({ sub: userId, orgId });
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
    select: { id: true, email: true, phone: true, name: true },
  });
  if (!user) return null;

  return { ...user, activeOrgId: session.orgId };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
