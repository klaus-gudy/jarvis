import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { registerSchema } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { OWNER_ROLE_NAME, TENANT_ROLE_NAME } from "@/lib/roles";

/**
 * Registration isn't guessable, but it is the cheapest way to make the server
 * do bcrypt work and create rows, so it gets a slower budget over a longer
 * window than login.
 */
const PER_IP = { limit: 5, windowMs: 10 * 60_000 };

export async function POST(request: Request) {
  const limited = rateLimit(`register:ip:${clientIp(request)}`, PER_IP);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, phone, password, organizationName } = parsed.data;
  const passwordHash = await hashPassword(password);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // The registration form checks this too (GET
      // /api/organizations/check-name), but only as a courtesy — that check
      // and this create aren't atomic with each other, so two people typing
      // the same name in the same few seconds could both see "available".
      // This is the check that actually prevents the duplicate; it has to
      // run inside the transaction, or it has the identical race itself.
      const nameTaken = await tx.organization.findFirst({
        where: { name: { equals: organizationName, mode: "insensitive" } },
        select: { id: true },
      });
      if (nameTaken) return { error: "duplicate-org-name" as const };

      const user = await tx.user.create({
        data: { name, email, phone: phone ?? null, passwordHash },
      });
      const organization = await tx.organization.create({
        data: { name: organizationName },
      });
      const ownerRole = await tx.role.create({
        data: { name: OWNER_ROLE_NAME, organizationId: organization.id },
      });
      // Created alongside Owner so a fresh org can add its first tenant
      // without `ensureRole` having to lazily create it on the fly.
      await tx.role.create({
        data: { name: TENANT_ROLE_NAME, organizationId: organization.id },
      });
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          roleId: ownerRole.id,
        },
        include: { role: true },
      });
      return { user, organization, membership };
    });

    if ("error" in result) {
      // Surfaced under organizationName so the client can route the user back
      // to the step that field actually lives on.
      return Response.json(
        {
          error: "This organization name is already taken",
          issues: {
            organizationName: ["This organization name is already taken"],
          },
        },
        { status: 409 }
      );
    }

    const { user, organization, membership } = result;

    await createSession(user.id, organization.id);

    return Response.json(
      {
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
        organization: { id: organization.id, name: organization.name },
        role: membership.role.name,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      const field = target.includes("phone") ? "phone number" : "email";
      return Response.json(
        { error: `An account with this ${field} already exists` },
        { status: 409 }
      );
    }
    console.error("Registration failed:", error);
    return Response.json({ error: "Registration failed" }, { status: 500 });
  }
}
