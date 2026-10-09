import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { setPropertyStatus } from "@/lib/properties";
import { setTrackingStatusSchema } from "@/lib/properties-schemas";

/** Deactivate or reactivate a property — see `lib/tracking.ts` for what that changes. */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/properties/[id]/status">
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

  const { id } = await ctx.params;
  const result = await setPropertyStatus(
    auth.context.organizationId,
    id,
    parsed.data.status,
    auth.context
  );
  if (result.error === "not-found") {
    return Response.json({ error: "Property not found" }, { status: 404 });
  }

  // The dashboard and every lease picker read the status too.
  revalidatePath("/", "layout");

  return Response.json({ property: result.property });
}
