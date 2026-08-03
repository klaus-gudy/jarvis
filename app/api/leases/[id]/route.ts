import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { deleteLease } from "@/lib/leases";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/leases/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const result = await deleteLease(auth.context.organizationId, id);

  if (result.error === "not-found") {
    return Response.json({ error: "Lease not found" }, { status: 404 });
  }

  revalidatePath("/leases");
  revalidatePath("/properties");
  revalidatePath("/tenants");

  return Response.json({ ok: true });
}
