import { can, type AuthContext } from "@/lib/authz";
import type { RoleKind } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Who may change a given member. Editing someone's email or phone is one
 * password reset away from taking over their account, so this is stricter
 * than "may use the Users page":
 *
 * - yourself — always (the profile editor goes through the same routes);
 * - an Owner — only another Owner;
 * - staff — `member:write`;
 * - a tenant — `tenant:write` or `member:write`.
 */
export function canManageMember(
  ctx: AuthContext,
  target: { id: string; kind: RoleKind }
) {
  if (target.id === ctx.membershipId) return true;
  if (target.kind === "OWNER") return ctx.kind === "OWNER";
  if (target.kind === "STAFF") return can(ctx, "member:write");
  return can(ctx, ["tenant:write", "member:write"]);
}

export async function findMemberTarget(organizationId: string, membershipId: string) {
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { id: true, userId: true, role: { select: { kind: true } } },
  });
  return membership
    ? { id: membership.id, userId: membership.userId, kind: membership.role.kind }
    : null;
}

/** 404 for a stranger, 403 for a member the caller may not manage. */
export async function authorizeMemberTarget(ctx: AuthContext, membershipId: string) {
  const target = await findMemberTarget(ctx.organizationId, membershipId);
  if (!target) {
    return {
      ok: false as const,
      response: Response.json({ error: "Member not found" }, { status: 404 }),
    };
  }
  if (!canManageMember(ctx, target)) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "You don't have permission to change this member" },
        { status: 403 }
      ),
    };
  }
  return { ok: true as const, target };
}
