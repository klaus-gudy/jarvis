import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { deleteUnit, updateUnit } from "@/lib/units";
import { updateUnitSchema } from "@/lib/units-schemas";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/properties/[id]/units/[unitId]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateUnitSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id, unitId } = await ctx.params;
  const result = await updateUnit(
    auth.context.organizationId,
    id,
    unitId,
    parsed.data
  );

  if (result.error === "not-found") {
    return Response.json({ error: "Unit not found" }, { status: 404 });
  }
  if (result.error === "duplicate-label") {
    return Response.json(
      { error: "A unit with this name already exists in this property" },
      { status: 409 }
    );
  }

  revalidatePath(`/properties/${id}`);
  revalidatePath("/properties");

  return Response.json({ unit: result.unit });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/properties/[id]/units/[unitId]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id, unitId } = await ctx.params;
  const result = await deleteUnit(auth.context.organizationId, id, unitId);

  if (result.error === "not-found") {
    return Response.json({ error: "Unit not found" }, { status: 404 });
  }

  revalidatePath(`/properties/${id}`);
  revalidatePath("/properties");

  return Response.json({ ok: true });
}
