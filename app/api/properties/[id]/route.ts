import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { deleteProperty, getProperty, updateProperty } from "@/lib/properties";
import { updatePropertySchema } from "@/lib/properties-schemas";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/properties/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const property = await getProperty(auth.context.organizationId, id);
  // Scoped lookup, so another org's id is indistinguishable from a missing one.
  if (!property) {
    return Response.json({ error: "Property not found" }, { status: 404 });
  }

  return Response.json({ property });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/properties/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updatePropertySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const property = await updateProperty(
    auth.context.organizationId,
    id,
    parsed.data
  );
  if (!property) {
    return Response.json({ error: "Property not found" }, { status: 404 });
  }

  revalidatePath("/properties");
  revalidatePath(`/properties/${id}`);

  return Response.json({ property });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/properties/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const deleted = await deleteProperty(auth.context.organizationId, id);
  if (!deleted) {
    return Response.json({ error: "Property not found" }, { status: 404 });
  }

  revalidatePath("/properties");

  return Response.json({ ok: true });
}
