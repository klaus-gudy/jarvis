import { audit, createdBy, snapshot, updatedBy, type Actor } from "@/lib/audit";
import { createHash, randomBytes } from "node:crypto";

import { hashPassword } from "@/lib/auth/hash";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/authz";
import { parsePermissions } from "@/lib/permissions";

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
  ctx: AuthContext,
  input: { name?: string; email?: string; phone?: string; roleId: string }
) {
  const { organizationId } = ctx;
  // The names come back with the role because the invitation email needs both
  // ("X invited you to join Y as Z") and this query already reaches the
  // organization. Fetching them again in the route would be a second round
  // trip for rows that were in hand here.
  const role = await prisma.role.findFirst({
    where: { id: input.roleId, organizationId },
    select: {
      id: true,
      name: true,
      kind: true,
      permissions: true,
      organization: { select: { name: true } },
    },
  });
  if (!role) return { error: "role-not-found" as const };

  // An invitation hands its role over on acceptance, so it is held to the same
  // rule as a role change: only an Owner invites an Owner, and nobody invites
  // into a role holding permissions they lack themselves.
  if (ctx.kind !== "OWNER") {
    if (role.kind === "OWNER") return { error: "forbidden" as const };
    const granted = parsePermissions(role.permissions);
    if (granted.some((p) => !ctx.permissions.has(p))) {
      return { error: "escalation" as const };
    }
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.$transaction(async (tx) => {
    const created = await tx.invitation.create({
      data: {
        tokenHash: hashToken(token),
        name: input.name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        roleId: role.id,
        organizationId,
        expiresAt,
        ...createdBy(ctx),
      },
    });
    await audit(tx, {
      organizationId,
      actor: ctx,
      action: "invitation.created",
      entityType: "Invitation",
      entityId: created.id,
      changes: snapshot(created),
    });
    return { id: created.id };
  });

  // The raw token is returned exactly once, for the link the inviter shares
  // and for the email that carries it.
  return {
    invitation,
    token,
    expiresInDays: INVITE_TTL_DAYS,
    roleName: role.name,
    roleKind: role.kind,
    organizationName: role.organization.name,
  };
}

export async function revokeInvitation(
  organizationId: string,
  id: string,
  actor: Actor
) {
  const invitation = await prisma.invitation.findFirst({
    where: { id, organizationId, status: "PENDING" },
    select: { id: true },
  });
  if (!invitation) return { error: "not-found" as const };

  await prisma.$transaction(async (tx) => {
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "REVOKED", ...updatedBy(actor) },
    });
    await audit(tx, {
      organizationId,
      actor,
      action: "invitation.revoked",
      entityType: "Invitation",
      entityId: invitation.id,
      changes: { status: ["PENDING", "REVOKED"] },
    });
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
 * password to a new or passwordless user and creates the membership.
 *
 * **An account that already exists is never taken over from here.** The
 * inviter chooses the phone on an invitation, and the acceptor can type an
 * email when it has none, so "the invitation names this person" proves
 * nothing about who is holding the link. Matching an existing user used to
 * rewrite their details and sign the link-holder in *as them* — anyone could
 * register an organization, invite a stranger's phone number and walk into
 * their account. So:
 *
 * - an existing user joins only while **signed in as themselves**
 *   (`signedInUserId`), and nothing on their account is changed but the new
 *   membership;
 * - the one exception is the passwordless member *of this organization*
 *   (onboarded by staff), whose activation is what the invitation is for —
 *   and only when the invitation itself named them, never an identifier the
 *   acceptor typed.
 */
export async function acceptInvitation(
  token: string,
  input:
    | { signedInUserId: string }
    | { name: string; password: string; email?: string; phone?: string }
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
      role: { select: { name: true, kind: true } },
      organizationId: true,
      createdById: true,
    },
  });

  if (!invitation || invitation.status !== "PENDING") {
    return { error: "invalid" as const };
  }
  if (invitation.expiresAt < new Date()) return { error: "expired" as const };

  // Only what the inviter recorded identifies an existing account. What the
  // acceptor types is used for a *new* account and nothing else.
  const invitedIdentifiers = [
    ...(invitation.email ? [{ email: invitation.email }] : []),
    ...(invitation.phone ? [{ phone: invitation.phone }] : []),
  ];
  const matches = invitedIdentifiers.length
    ? await prisma.user.findMany({
        where: { OR: invitedIdentifiers },
        select: { id: true, passwordHash: true },
        take: 2,
      })
    : [];
  // The invited email and phone belong to two different people: there is no
  // right answer to pick, so refuse rather than guess.
  if (matches.length > 1) return { error: "identifier-conflict" as const };
  const existingUser = matches[0] ?? null;

  const alreadyMember = existingUser
    ? await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: invitation.organizationId,
          },
        },
        select: { id: true, roleId: true, role: { select: { name: true, kind: true } } },
      })
    : null;

  // The acceptor is the actor: by now they hold the membership in question.
  const markAccepted = (tx: Prisma.TransactionClient, actor: Actor) =>
    acceptedBy(tx, invitation, actor);

  // Whoever sent the invitation is who brought the new member in.
  const joinedBy = { createdById: invitation.createdById, updatedById: invitation.createdById };

  // --- Signed in: join as yourself, or not at all. ---
  if ("signedInUserId" in input) {
    if (!existingUser || existingUser.id !== input.signedInUserId) {
      return { error: "wrong-account" as const };
    }
    if (alreadyMember) {
      await prisma.$transaction((tx) =>
        markAccepted(tx, { membershipId: alreadyMember.id, userId: existingUser.id })
      );
      return { error: "already-member" as const };
    }
    const joined = await prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: {
          userId: existingUser.id,
          organizationId: invitation.organizationId,
          roleId: invitation.roleId,
          ...joinedBy,
        },
      });
      await markAccepted(tx, { membershipId: membership.id, userId: existingUser.id });
      return { userId: existingUser.id, organizationId: invitation.organizationId };
    });
    return { accepted: joined };
  }

  // --- Signed out: a new account, or activating a passwordless member. ---
  if (existingUser && !alreadyMember) {
    // Somebody else's account. Only they can attach it, by signing in.
    return {
      error: existingUser.passwordHash
        ? ("sign-in-required" as const)
        : ("account-exists" as const),
    };
  }

  if (existingUser && alreadyMember) {
    if (existingUser.passwordHash) {
      await prisma.$transaction((tx) =>
        markAccepted(tx, { membershipId: alreadyMember.id, userId: existingUser.id })
      );
      return { error: "already-member" as const };
    }
    return activatePasswordlessMember(invitation, existingUser.id, alreadyMember, input);
  }

  // A brand-new account. The identifiers the invitation left blank may come
  // from the acceptor, but never ones that already belong to someone.
  const email = invitation.email ?? input.email ?? null;
  const phone = invitation.phone ?? input.phone ?? null;
  if (!email && !phone) return { error: "missing-identifier" as const };

  const typedClash =
    (input.email && !invitation.email) || (input.phone && !invitation.phone)
      ? await prisma.user.findFirst({
          where: {
            OR: [
              ...(input.email && !invitation.email ? [{ email: input.email }] : []),
              ...(input.phone && !invitation.phone ? [{ phone: input.phone }] : []),
            ],
          },
          select: { id: true },
        })
      : null;
  if (typedClash) return { error: "sign-in-required" as const };

  const passwordHash = await hashPassword(input.password);
  // Verified only when the invitation carried the address: clicking a link
  // delivered there is the proof. A typed address proves nothing.
  const verifiedAt = invitation.email ? new Date() : null;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email, phone, passwordHash, emailVerifiedAt: verifiedAt },
      select: { id: true },
    });
    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: invitation.organizationId,
        roleId: invitation.roleId,
        ...joinedBy,
      },
    });
    await markAccepted(tx, { membershipId: membership.id, userId: user.id });
    return { userId: user.id, organizationId: invitation.organizationId };
  });

  return { accepted: result };
}

/**
 * Someone onboarded by staff already has a membership here but no password.
 * The invitation named them (see `acceptInvitation`), so setting the password
 * is exactly what it is for.
 *
 * **The invited role is applied here**, on acceptance and never on creation:
 * until someone accepts nothing has been agreed. A change that would leave the
 * organization with no Owner is refused, but the activation still completes —
 * the person clicked a link to gain sign-in, and blocking that over a role
 * they did not choose would punish the wrong party.
 */
async function activatePasswordlessMember(
  invitation: {
    id: string;
    email: string | null;
    roleId: string;
    role: { name: string; kind: string };
    organizationId: string;
  },
  userId: string,
  membership: { id: string; roleId: string; role: { name: string; kind: string } },
  input: { name: string; password: string }
) {
  const wouldDemoteLastOwner =
    membership.role.kind === "OWNER" &&
    invitation.role.kind !== "OWNER" &&
    (await prisma.membership.count({
      where: {
        organizationId: invitation.organizationId,
        role: { kind: "OWNER" as const },
      },
    })) <= 1;

  if (wouldDemoteLastOwner) {
    console.warn(
      `[invitations] keeping ${membership.role.name} on membership ${membership.id}: ` +
        `moving it to ${invitation.role.name} would leave the organization with no owner`
    );
  }

  const passwordHash = await hashPassword(input.password);

  const actor: Actor = { membershipId: membership.id, userId };
  const activated = await prisma.$transaction(async (tx) => {
    // Sign-in identifiers are left as the landlord recorded them — the
    // acceptor proves nothing about any other address.
    await tx.user.update({
      where: { id: userId },
      data: {
        name: input.name,
        passwordHash,
        ...(invitation.email ? { emailVerifiedAt: new Date() } : {}),
      },
    });

    if (membership.roleId !== invitation.roleId && !wouldDemoteLastOwner) {
      await tx.membership.update({
        where: { id: membership.id },
        data: { roleId: invitation.roleId, ...updatedBy(actor) },
      });
      await audit(tx, {
        organizationId: invitation.organizationId,
        actor,
        action: "member.role_changed",
        entityType: "Membership",
        entityId: membership.id,
        changes: { roleId: [membership.roleId, invitation.roleId], invitationId: invitation.id },
      });
    }

    await acceptedBy(tx, invitation, actor);
    return { userId, organizationId: invitation.organizationId };
  });

  return { accepted: activated };
}

/** Marks an invitation accepted and logs who accepted it. */
async function acceptedBy(
  tx: Prisma.TransactionClient,
  invitation: { id: string; organizationId: string },
  actor: Actor
) {
  await tx.invitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date(), ...updatedBy(actor) },
  });
  await audit(tx, {
    organizationId: invitation.organizationId,
    actor,
    action: "invitation.accepted",
    entityType: "Invitation",
    entityId: invitation.id,
    changes: { status: ["PENDING", "ACCEPTED"], membershipId: actor.membershipId },
  });
}
