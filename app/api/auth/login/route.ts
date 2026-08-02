import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { loginSchema } from "@/lib/auth/schemas";
import { createSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { identifier, password } = parsed.data;
  const isEmail = identifier.includes("@");

  const user = await prisma.user.findUnique({
    where: isEmail
      ? { email: identifier.toLowerCase() }
      : { phone: identifier },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        include: { organization: true, role: true },
      },
    },
  });

  // Hash even when the user is unknown so response timing doesn't reveal
  // which identifiers exist.
  if (!user) {
    await hashPassword(password);
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const activeMembership = user.memberships[0] ?? null;
  await createSession(user.id, activeMembership?.organizationId ?? null);

  return Response.json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone },
    organization: activeMembership
      ? {
          id: activeMembership.organization.id,
          name: activeMembership.organization.name,
        }
      : null,
    role: activeMembership?.role.name ?? null,
  });
}
