import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { clearSession } from "@/lib/auth/session";
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

  // The session's `activeOrgId` now points at nothing. `getCurrentUser`
  // already falls back to another membership if one exists (Phase 24), which
  // would silently drop the caller into a *different* organization's
  // dashboard right after they asked to delete this one — surprising, and it
  // means "delete" doesn't reliably end the session the way the confirmation
  // implied. Clearing the cookie here, in the same request as the delete,
  // makes the two atomic: there is no request in between where the org is
  // gone but the cookie still verifies. The client redirects to `/`, which
  // `proxy.ts` serves as the public landing page once it sees no session.
  await clearSession();

  return Response.json({ ok: true });
}
