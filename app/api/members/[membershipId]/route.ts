import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { removeMember } from "@/lib/members";

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
