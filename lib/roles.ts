import { prisma } from "@/lib/prisma";
// Imported as well as re-exported: a re-export does not bring a name into this
// module's own scope, and the queries below use both.
import { OWNER_ROLE_NAME, TENANT_ROLE_NAME } from "@/lib/role-constants";

// Re-exported so the modules that import them from here need no change, while
// modules that must stay Prisma-free can reach them directly.
export {
  isOwnerRole,
  OWNER_ROLE_NAME,
  TENANT_ROLE_NAME,
} from "@/lib/role-constants";

export type RoleRow = {
  id: string;
  name: string;
  memberCount: number;
  pendingInviteCount: number;
  /**
   * Owner and Tenant are load-bearing: the sole-Owner guard in `lib/members.ts`
   * and every tenant query match on these names, so the UI marks them as
   * built-in rather than presenting them as ordinary editable rows.
   */
  isSystem: boolean;
};

const SYSTEM_ROLE_NAMES = [OWNER_ROLE_NAME, TENANT_ROLE_NAME].map((name) =>
  name.toLowerCase()
);

export async function getRoles(organizationId: string): Promise<RoleRow[]> {
  const roles = await prisma.role.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          memberships: true,
          // Only invites still outstanding count — accepted and revoked ones
          // say nothing about the role's current use.
          invitations: { where: { status: "PENDING" } },
        },
      },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    memberCount: role._count.memberships,
    pendingInviteCount: role._count.invitations,
    isSystem: SYSTEM_ROLE_NAMES.includes(role.name.toLowerCase()),
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
