import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { revokeInvitation } from "@/lib/invitations";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/invitations/[id]">
) {
  const auth = await authorize("member:invite");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const result = await revokeInvitation(auth.context.organizationId, id);

  if (result.error === "not-found") {
    return Response.json({ error: "Invitation not found" }, { status: 404 });
  }

  revalidatePath("/users");
  return Response.json({ ok: true });
}
