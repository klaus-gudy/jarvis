import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { removeMember, updateMember } from "@/lib/members";
import { updateMemberSchema } from "@/lib/members-schemas";

/** Serves both the Users and Tenants pages — a tenant is just a member. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/members/[membershipId]">
) {
  const auth = await requireActiveOrg();
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
  const result = await updateMember(
    auth.context.organizationId,
    membershipId,
    parsed.data
  );

  if (result.error === "not-found") {
    return Response.json({ error: "Member not found" }, { status: 404 });
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
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { membershipId } = await ctx.params;
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
