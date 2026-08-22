import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { deleteOrganization } from "@/lib/organizations";

/**
 * Deletes an organization and every record under it. Irreversible.
 *
 * The id in the path must be the caller's *active* organization. Deleting a
 * different one you happen to own would be a cross-org write driven entirely
 * by a URL, and the confirmation the user just typed described the org they
 * were looking at — not whatever id arrived here.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/organizations/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (id !== auth.context.organizationId) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const result = await deleteOrganization(auth.context.userId, id);

  if ("error" in result) {
    if (result.error === "not-owner") {
      return Response.json(
        { error: "Only the organization's owner can delete it" },
        { status: 403 }
      );
    }
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  // Every page is org-scoped, so the whole tree is stale — including the
  // sidebar's switcher, which lives in the layout.
  revalidatePath("/", "layout");

  return Response.json({ ok: true });
}
