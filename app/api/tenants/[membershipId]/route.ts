import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { removeTenant } from "@/lib/tenants";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/tenants/[membershipId]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { membershipId } = await ctx.params;
  const result = await removeTenant(auth.context.organizationId, membershipId);

  if (result.error === "not-found") {
    return Response.json({ error: "Tenant not found" }, { status: 404 });
  }

  revalidatePath("/tenants");
  revalidatePath("/users");

  return Response.json({ ok: true, removedLeases: result.removedLeases });
}
