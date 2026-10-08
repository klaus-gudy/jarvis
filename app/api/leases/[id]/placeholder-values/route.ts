import { authorize } from "@/lib/authz";
import { placeholderValues } from "@/lib/lease-placeholders";
import { buildLeaseContext } from "@/lib/lease-templates";

/**
 * Every placeholder resolved against one real lease — for the template
 * editor's "Real lease" preview, which renders the *unsaved* body client-side
 * with these values. Needs `lease:read`: it is that lease's data.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/leases/[id]/placeholder-values">
) {
  const auth = await authorize("lease:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const context = await buildLeaseContext(auth.context.organizationId, id);
  if (!context) return Response.json({ error: "Lease not found" }, { status: 404 });

  return Response.json({ values: placeholderValues(context) });
}
