import { audit, createdBy, diff, snapshot, updatedBy } from "@/lib/audit";
import type { AuthContext } from "@/lib/authz";
import {
  parsePermissions,
  type Permission,
  type RoleKind,
} from "@/lib/permissions";
import { getProfilePhotoIds } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
// Imported as well as re-exported: a re-export does not bring a name into this
// module's own scope, and the queries below use it.
import { TENANT_ROLE_NAME } from "@/lib/role-constants";

// Re-exported so the modules that import them from here need no change, while
// modules that must stay Prisma-free can reach them directly.
export {
  isOwnerRole,
  OWNER_ROLE_NAME,
  TENANT_ROLE_NAME,
} from "@/lib/role-constants";

/** Shown for a built-in role until an owner writes their own. */
const DEFAULT_DESCRIPTIONS: Record<RoleKind, string | null> = {
  OWNER: "Full access to everything, including roles, backups and deleting the organization.",
  TENANT: "Tenant portal only: their own leases, invoices, payments and documents.",
  STAFF: null,
};

function describe(kind: RoleKind, description: string | null) {
  return description?.trim() || DEFAULT_DESCRIPTIONS[kind];
}

export type RoleRow = {
  id: string;
  name: string;
  /** Null for a custom role nobody has described yet. */
  description: string | null;
  kind: RoleKind;
  /** Effective: every permission for an Owner, none for a Tenant. */
  permissions: Permission[];
  memberCount: number;
  pendingInviteCount: number;
  /**
   * Owner and Tenant are built in (`Role.kind`): they can be renamed but never
   * deleted, and their permissions are fixed.
   */
  isSystem: boolean;
};

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
    description: describe(role.kind, role.description),
    kind: role.kind,
    permissions: parsePermissions(role.permissions),
    memberCount: role._count.memberships,
    pendingInviteCount: role._count.invitations,
    isSystem: role.kind !== "STAFF",
  }));
}

/**
 * The Tenant role is created on demand for organizations that predate it being
 * seeded (`createOrganizationForUser` still creates only Owner). Looked up by
 * kind, never by name — the role may have been renamed.
 */
export async function ensureTenantRole(organizationId: string) {
  const existing = await prisma.role.findFirst({
    where: { organizationId, kind: "TENANT" },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  return prisma.role.create({
    data: { organizationId, name: TENANT_ROLE_NAME, kind: "TENANT" },
    select: { id: true, name: true },
  });
}

async function nameTaken(organizationId: string, name: string, exceptId?: string) {
  const existing = await prisma.role.findFirst({
    where: {
      organizationId,
      name: { equals: name, mode: "insensitive" },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}

/** A non-Owner may only hand out permissions they hold themselves. */
function exceedsActor(ctx: AuthContext, permissions: Permission[]) {
  return ctx.kind !== "OWNER" && permissions.some((p) => !ctx.permissions.has(p));
}

export async function createRole(
  ctx: AuthContext,
  input: { name: string; description?: string | null; permissions: string[] }
) {
  const permissions = parsePermissions(input.permissions);
  if (exceedsActor(ctx, permissions)) return { error: "escalation" as const };
  if (await nameTaken(ctx.organizationId, input.name)) {
    return { error: "duplicate" as const };
  }

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: {
        organizationId: ctx.organizationId,
        name: input.name,
        description: input.description ?? null,
        kind: "STAFF",
        permissions,
        ...createdBy(ctx),
      },
    });
    await audit(tx, {
      organizationId: ctx.organizationId,
      actor: ctx,
      action: "role.created",
      entityType: "Role",
      entityId: created.id,
      changes: snapshot(created),
    });
    return { id: created.id, name: created.name };
  });
  return { role };
}

/**
 * Renames any role and changes any role's permissions — built-ins included.
 * Only an Owner may touch the Owner role. Owner and Tenant still can't be
 * deleted (`deleteRole`).
 */
export async function updateRole(
  ctx: AuthContext,
  roleId: string,
  input: { name?: string; description?: string | null; permissions?: string[] }
) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, organizationId: ctx.organizationId },
  });
  if (!role) return { error: "not-found" as const };
  if (role.kind === "OWNER" && ctx.kind !== "OWNER") return { error: "forbidden" as const };

  let permissions: Permission[] | undefined;
  if (input.permissions) {
    permissions = parsePermissions(input.permissions);
    // Both directions: a non-Owner can neither add a permission they lack nor
    // strip one they lack from a role that holds it (they could not add it back).
    const before = parsePermissions(role.permissions);
    const changed = [
      ...permissions.filter((p) => !before.includes(p)),
      ...before.filter((p) => !permissions!.includes(p)),
    ];
    if (exceedsActor(ctx, changed)) return { error: "escalation" as const };
  }

  if (input.name && (await nameTaken(ctx.organizationId, input.name, role.id))) {
    return { error: "duplicate" as const };
  }

  const changes = {
    ...(input.name ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(permissions ? { permissions } : {}),
  };
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.role.update({
      where: { id: role.id },
      data: { ...changes, ...updatedBy(ctx) },
      select: { id: true, name: true },
    });
    await audit(tx, {
      organizationId: ctx.organizationId,
      actor: ctx,
      action: "role.updated",
      entityType: "Role",
      entityId: role.id,
      changes: diff(role, changes),
    });
    return saved;
  });
  return { role: updated };
}

/** Built-ins are never deleted; a role still held or invited to is refused. */
export async function deleteRole(ctx: AuthContext, roleId: string) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, organizationId: ctx.organizationId },
    include: {
      _count: {
        select: {
          memberships: true,
          invitations: { where: { status: "PENDING" } },
        },
      },
    },
  });
  if (!role) return { error: "not-found" as const };
  if (role.kind !== "STAFF") return { error: "built-in" as const };
  if (exceedsActor(ctx, parsePermissions(role.permissions))) {
    return { error: "escalation" as const };
  }
  if (role._count.memberships > 0 || role._count.invitations > 0) {
    return { error: "in-use" as const };
  }

  // Accepted/revoked invitations still point at the role (RESTRICT), and say
  // nothing about its current use, so they go with it.
  await prisma.$transaction(async (tx) => {
    await tx.invitation.deleteMany({ where: { roleId: role.id } });
    await tx.role.delete({ where: { id: role.id } });
    await audit(tx, {
      organizationId: ctx.organizationId,
      actor: ctx,
      action: "role.deleted",
      entityType: "Role",
      entityId: role.id,
      changes: snapshot(role),
    });
  });
  return { ok: true as const };
}

export type RoleMember = {
  membershipId: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** ISO string — crosses to the client table. */
  joinedAt: string;
  photoId: string | null;
};

export type RoleDetail = RoleRow & { members: RoleMember[] };

/** One role with the people holding it, for `/roles/[id]`. */
export async function getRole(
  organizationId: string,
  roleId: string
): Promise<RoleDetail | null> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, organizationId },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          createdAt: true,
          user: { select: { name: true, email: true, phone: true } },
        },
      },
      _count: { select: { invitations: { where: { status: "PENDING" } } } },
    },
  });
  if (!role) return null;

  const photoIds = await getProfilePhotoIds(
    organizationId,
    role.memberships.map((m) => m.id)
  );

  return {
    id: role.id,
    name: role.name,
    description: describe(role.kind, role.description),
    kind: role.kind,
    permissions: parsePermissions(role.permissions),
    memberCount: role.memberships.length,
    pendingInviteCount: role._count.invitations,
    isSystem: role.kind !== "STAFF",
    members: role.memberships.map((m) => ({
      membershipId: m.id,
      name: m.user.name ?? m.user.email ?? m.user.phone ?? "Unnamed",
      email: m.user.email,
      phone: m.user.phone,
      joinedAt: m.createdAt.toISOString(),
      photoId: photoIds.get(m.id) ?? null,
    })),
  };
}
