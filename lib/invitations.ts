import { createHash, randomBytes } from "node:crypto";

import { hashPassword } from "@/lib/auth/hash";
import { prisma } from "@/lib/prisma";

const INVITE_TTL_DAYS = 14;

/**
 * SHA-256 rather than bcrypt: the token is 256 bits of randomness, so it isn't
 * brute-forceable and needs a fast deterministic lookup. Only the hash is
 * stored, so a database leak doesn't yield working invite links.
 */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type InvitationRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  roleName: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
};

export async function getInvitations(
  organizationId: string
): Promise<InvitationRow[]> {
  const now = new Date();
  const invitations = await prisma.invitation.findMany({
    where: { organizationId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: { role: { select: { name: true } } },
  });

  return invitations.map((invitation) => ({
    id: invitation.id,
    name: invitation.name,
    email: invitation.email,
    phone: invitation.phone,
    roleName: invitation.role.name,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    isExpired: invitation.expiresAt < now,
  }));
}

export async function createInvitation(
  organizationId: string,
  input: { name?: string; email?: string; phone?: string; roleId: string }
) {
  const role = await prisma.role.findFirst({
    where: { id: input.roleId, organizationId },
    select: { id: true },
  });
  if (!role) return { error: "role-not-found" as const };

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      tokenHash: hashToken(token),
      name: input.name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      roleId: role.id,
      organizationId,
      expiresAt,
    },
    select: { id: true },
  });

  // The raw token is returned exactly once, for the link the inviter shares.
  return { invitation, token };
}

export async function revokeInvitation(organizationId: string, id: string) {
  const invitation = await prisma.invitation.findFirst({
    where: { id, organizationId, status: "PENDING" },
    select: { id: true },
  });
  if (!invitation) return { error: "not-found" as const };

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "REVOKED" },
  });
  return { ok: true as const };
}

/** Public: looks up an invite by raw token for the accept page. */
export async function getInvitationByToken(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      role: { select: { name: true } },
      organization: { select: { name: true } },
    },
  });

  if (!invitation) return null;
  if (invitation.status !== "PENDING") return null;
  if (invitation.expiresAt < new Date()) return null;

  return {
    id: invitation.id,
    name: invitation.name,
    email: invitation.email,
    phone: invitation.phone,
    roleName: invitation.role.name,
    organizationName: invitation.organization.name,
  };
}

/**
 * Accepting is the only way a tenant gains sign-in access: it attaches a
 * password to a new or existing user and creates the membership.
 */
export async function acceptInvitation(
  token: string,
  input: { name: string; password: string; email?: string; phone?: string }
) {
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      email: true,
      phone: true,
      roleId: true,
      organizationId: true,
    },
  });

  if (!invitation || invitation.status !== "PENDING") {
    return { error: "invalid" as const };
  }
  if (invitation.expiresAt < new Date()) return { error: "expired" as const };

  // Prefer the identifiers the inviter recorded; fall back to what the
  // recipient supplies so an invite with neither still works.
  const email = invitation.email ?? input.email ?? null;
  const phone = invitation.phone ?? input.phone ?? null;
  if (!email && !phone) return { error: "missing-identifier" as const };

  const passwordHash = await hashPassword(input.password);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
    },
    select: { id: true, passwordHash: true },
  });

  const alreadyMember = existingUser
    ? await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: invitation.organizationId,
          },
        },
        select: { id: true },
      })
    : null;

  if (existingUser && alreadyMember) {
    // Someone onboarded by staff already has a membership but no password.
    // Inviting them is how they gain sign-in, so set the password rather than
    // refusing. If they can already sign in, the invite is redundant.
    if (existingUser.passwordHash) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      return { error: "already-member" as const };
    }

    const activated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name: input.name,
          passwordHash,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      return {
        userId: existingUser.id,
        organizationId: invitation.organizationId,
      };
    });

    return { accepted: activated };
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: input.name,
            // Don't overwrite a working password on an existing account.
            ...(existingUser.passwordHash ? {} : { passwordHash }),
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {}),
          },
          select: { id: true },
        })
      : await tx.user.create({
          data: { name: input.name, email, phone, passwordHash },
          select: { id: true },
        });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        roleId: invitation.roleId,
      },
    });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    return { userId: user.id, organizationId: invitation.organizationId };
  });

  return { accepted: result };
}
