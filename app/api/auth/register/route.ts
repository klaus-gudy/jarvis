import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/hash";
import { registerSchema } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
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
    const { user, organization, membership } = await prisma.$transaction(
      async (tx) => {
        const user = await tx.user.create({
          data: { name, email, phone: phone ?? null, passwordHash },
        });
        const organization = await tx.organization.create({
          data: { name: organizationName },
        });
        const ownerRole = await tx.role.create({
          data: { name: "Owner", organizationId: organization.id },
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
      }
    );

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
