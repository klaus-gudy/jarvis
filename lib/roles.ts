import { prisma } from "@/lib/prisma";

/** Created for the registrant in app/api/auth/register/route.ts. */
export const OWNER_ROLE_NAME = "Owner";
/** Tenants are the members the Tenants page lists. */
export const TENANT_ROLE_NAME = "Tenant";

export async function getRoles(organizationId: string) {
  const roles = await prisma.role.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { memberships: true } } },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    memberCount: role._count.memberships,
  }));
}

/**
 * The Tenant role is created on demand: an org registers with only an Owner
 * role, so the first tenant added has to bring its role into existence.
 */
export async function ensureRole(organizationId: string, name: string) {
  const existing = await prisma.role.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  return prisma.role.create({
    data: { organizationId, name },
    select: { id: true, name: true },
  });
}

export async function createRole(organizationId: string, name: string) {
  const existing = await prisma.role.findFirst({
    where: { organizationId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return { error: "duplicate" as const };

  const role = await prisma.role.create({
    data: { organizationId, name },
    select: { id: true, name: true },
  });
  return { role };
}
