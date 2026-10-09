import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { setTrackingStatusSchema } from "@/lib/properties-schemas";
import { setUnitStatus } from "@/lib/units";

/** Deactivate or reactivate a unit — see `lib/tracking.ts` for what that changes. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/properties/[id]/units/[unitId]/status">
) {
  const auth = await authorize("property:write");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = setTrackingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id, unitId } = await ctx.params;
  const result = await setUnitStatus(
    auth.context.organizationId,
    id,
    unitId,
    parsed.data.status,
    auth.context
  );
  if (result.error === "not-found") {
    return Response.json({ error: "Unit not found" }, { status: 404 });
  }
  if (result.error === "has-live-leases") {
    return Response.json(
      { error: "This unit has a lease running or about to start — end it first" },
      { status: 409 }
    );
  }

  // The dashboard and every lease picker read the status too.
  revalidatePath("/", "layout");

  return Response.json({ unit: result.unit });
}
