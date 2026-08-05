import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSession, getSession, getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const switchSchema = z.object({
  organizationId: z.string().min(1),
});

/**
 * Re-issues the session cookie pointed at another of the caller's
 * organizations. Membership is checked here even though getCurrentUser
 * validates per request: this is the moment the claim is minted, so it must
 * never be minted wrong.
 */
export async function POST(request: Request) {
  const [user, session] = await Promise.all([getCurrentUser(), getSession()]);
  if (!user || !session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = switchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Validation failed" }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: parsed.data.organizationId,
      },
    },
    select: { organization: { select: { id: true, name: true } } },
  });
  // Not a member (any more) — the same shape whether the org never existed or
  // the membership was just revoked, so the endpoint can't be used to probe.
  if (!membership) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  // Keep the remember-me choice the original sign-in made.
  await createSession(user.id, membership.organization.id, {
    persist: session.persist,
  });

  // Every page is org-scoped, so all of them are stale after a switch.
  revalidatePath("/", "layout");

  return Response.json({ organization: membership.organization });
}
