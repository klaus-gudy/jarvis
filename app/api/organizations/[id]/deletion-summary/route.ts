import { requireActiveOrg } from "@/lib/api-auth";
import { getOrganizationDeletionSummary } from "@/lib/organizations";

/**
 * Counts of what deleting the organization would destroy, for the confirm
 * dialog. Fetched when the dialog opens rather than folded into `getProfile`:
 * it is five COUNT queries that every profile page load would otherwise pay
 * for on the chance somebody is about to delete their organization.
 *
 * Same active-org restriction as DELETE on the parent route.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/organizations/[id]/deletion-summary">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (id !== auth.context.organizationId) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const summary = await getOrganizationDeletionSummary(id);
  if (!summary) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  return Response.json({ summary });
}
