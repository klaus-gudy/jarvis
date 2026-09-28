import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { authorizeMemberTarget } from "@/lib/member-access";
import {
  changeMemberRole,
  checkIdentifierEdit,
  removeMember,
  updateMember,
} from "@/lib/members";
import { updateMemberSchema } from "@/lib/members-schemas";

const SELF_MANAGED =
  "This person manages their own sign-in details, so their phone and email can't be changed here.";

/**
 * Serves the Users and Tenants pages and the profile editor — a tenant is just
 * a member. Which permission it takes depends on whose record it is
 * (`canManageMember`): yourself always, others by their role's kind.
 */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/members/[membershipId]">
) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { membershipId } = await ctx.params;
  const access = await authorizeMemberTarget(auth.context, membershipId);
  if (!access.ok) return access.response;

  const { roleId, ...details } = parsed.data;

  // Checked before anything is written, so a refused identifier edit can't
  // leave a role change behind it.
  const identifiers = await checkIdentifierEdit(
    auth.context.organizationId,
    membershipId,
    auth.context.userId,
    details
  );
  if ("error" in identifiers && identifiers.error === "self-managed") {
    return Response.json({ error: SELF_MANAGED, reason: "self-managed" }, { status: 409 });
  }

  // The role change goes next: it is the guarded part, and a refusal must
  // leave nothing half-saved.
  if (roleId) {
    const changed = await changeMemberRole(auth.context, access.target, roleId);
    if ("error" in changed && changed.error) {
      const refusal = {
        self: [400, "You cannot change your own role"],
        forbidden: [403, "You don't have permission to change this member's role"],
        escalation: [403, "That role has permissions you don't hold yourself"],
        "role-not-found": [404, "Role not found"],
        "last-owner": [409, "This is the only Owner — the organization would be left unmanaged"],
      } as const;
      const [status, error] = refusal[changed.error];
      return Response.json({ error }, { status });
    }
  }

  const result = await updateMember(
    auth.context.organizationId,
    membershipId,
    auth.context.userId,
    details
  );

  if (result.error === "not-found") {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }
  if (result.error === "self-managed") {
    return Response.json({ error: SELF_MANAGED, reason: "self-managed" }, { status: 409 });
  }
  if (result.error === "duplicate") {
    return Response.json(
      {
        error: "Validation failed",
        issues: {
          [result.field]: [
            `Another account already uses this ${result.field}`,
          ],
        },
      },
      { status: 409 }
    );
  }

  revalidatePath("/users");
  revalidatePath("/tenants");

  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/members/[membershipId]">
) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const { membershipId } = await ctx.params;
  const access = await authorizeMemberTarget(auth.context, membershipId);
  if (!access.ok) return access.response;

  const result = await removeMember(
    auth.context.organizationId,
    membershipId,
    auth.context.userId
  );

  if (result.error === "not-found") {
    return Response.json({ error: "Member not found" }, { status: 404 });
  }
  if (result.error === "self") {
    return Response.json(
      { error: "You cannot remove yourself from the organization" },
      { status: 400 }
    );
  }
  if (result.error === "last-owner") {
    return Response.json(
      { error: "This is the only Owner — the organization would be left unmanaged" },
      { status: 409 }
    );
  }

  revalidatePath("/users");
  revalidatePath("/tenants");

  return Response.json({ ok: true, removedLeases: result.removedLeases });
}
