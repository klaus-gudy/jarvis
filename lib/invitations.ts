import { createHash, randomBytes } from "node:crypto";

import { hashPassword } from "@/lib/auth/hash";
import { prisma } from "@/lib/prisma";
import { isOwnerRole, OWNER_ROLE_NAME } from "@/lib/role-constants";

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
  // The names come back with the role because the invitation email needs both
  // ("X invited you to join Y as Z") and this query already reaches the
  // organization. Fetching them again in the route would be a second round
  // trip for rows that were in hand here.
  const role = await prisma.role.findFirst({
    where: { id: input.roleId, organizationId },
    select: { id: true, name: true, organization: { select: { name: true } } },
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

  // The raw token is returned exactly once, for the link the inviter shares
  // and for the email that carries it.
  return {
    invitation,
    token,
    expiresInDays: INVITE_TTL_DAYS,
    roleName: role.name,
    organizationName: role.organization.name,
  };
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
      role: { select: { name: true } },
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

  /**
   * Does accepting prove control of this address?
   *
   * **Only when the invitation itself carried the email.** That is the whole
   * argument: the link was delivered *to* that inbox, and clicking it is
   * evidence only the holder of that inbox could produce. An invitation
   * recorded with a phone and no email, where the invitee types an address on
   * the accept form, proves nothing — nothing was ever sent there, and
   * stamping it verified would be recording a check that never happened.
   *
   * Compared case-insensitively because `createInvitationSchema` lowercases on
   * the way in while `input.email` comes off a public form that does not.
   */
  const emailWasInvited =
    Boolean(invitation.email) &&
    invitation.email!.trim().toLowerCase() ===
      (email ?? "").trim().toLowerCase();
  const verifiedAt = emailWasInvited ? new Date() : null;

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
        select: { id: true, roleId: true, role: { select: { name: true } } },
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

    /*
     * **The invited role is applied here, and it used not to be.** This branch
     * set a password and nothing else, so inviting an existing Tenant as an
     * Owner produced an email, an accepted invitation, and a membership still
     * reading "Tenant" — the role on the invitation was silently discarded.
     * The other branch (`membership.create` below) had always honoured it, so
     * the same invitation meant two different things depending on whether the
     * person happened to have a membership already.
     *
     * It is applied on *acceptance*, not when the invite is created: until
     * someone accepts, nothing has been agreed, and granting Owner to a pending
     * invitation would hand out the role before anyone clicked anything.
     */
    const wouldDemoteLastOwner =
      isOwnerRole(alreadyMember.role.name) &&
      !isOwnerRole(invitation.role.name) &&
      (await prisma.membership.count({
        where: {
          organizationId: invitation.organizationId,
          role: { name: { equals: OWNER_ROLE_NAME, mode: "insensitive" } },
        },
      })) <= 1;

    if (wouldDemoteLastOwner) {
      // Refused, but the acceptance carries on: the person clicked a link to
      // gain sign-in, and blocking that over a role they did not choose would
      // punish the wrong party. An organization with no Owner at all is the
      // one outcome worth protecting against — same rule `removeMember`
      // enforces, for the same reason.
      console.warn(
        `[invitations] keeping ${alreadyMember.role.name} on membership ${alreadyMember.id}: ` +
          `moving it to ${invitation.role.name} would leave the organization with no owner`
      );
    }

    const activated = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name: input.name,
          passwordHash,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          // Clicking a link delivered to this address is the proof. Only
          // stamped when the invitation carried the address — see above.
          ...(verifiedAt ? { emailVerifiedAt: verifiedAt } : {}),
        },
      });

      if (alreadyMember.roleId !== invitation.roleId && !wouldDemoteLastOwner) {
        await tx.membership.update({
          where: { id: alreadyMember.id },
          data: { roleId: invitation.roleId },
        });
      }

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
            ...(verifiedAt ? { emailVerifiedAt: verifiedAt } : {}),
          },
          select: { id: true },
        })
      : await tx.user.create({
          data: {
            name: input.name,
            email,
            phone,
            passwordHash,
            emailVerifiedAt: verifiedAt,
          },
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
