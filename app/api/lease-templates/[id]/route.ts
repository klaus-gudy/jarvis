import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { updateLeaseTemplateSchema } from "@/lib/lease-template-schemas";
import {
  deleteLeaseTemplate,
  getLeaseTemplate,
  updateLeaseTemplate,
} from "@/lib/lease-templates";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/lease-templates/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const template = await getLeaseTemplate(auth.context.organizationId, id);
  // Scoped lookup, so another org's id is indistinguishable from a missing one.
  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  return Response.json({ template });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/lease-templates/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateLeaseTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const result = await updateLeaseTemplate(
    auth.context.organizationId,
    id,
    parsed.data
  );

  if ("error" in result) {
    return result.error === "not-found"
      ? Response.json({ error: "Template not found" }, { status: 404 })
      : Response.json(
          { error: "A template with this name already exists" },
          { status: 409 }
        );
  }

  revalidatePath("/settings/lease-templates");
  revalidatePath(`/settings/lease-templates/${id}`);
  return Response.json({ template: result.template });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/lease-templates/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const result = await deleteLeaseTemplate(auth.context.organizationId, id);
  if ("error" in result) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  revalidatePath("/settings/lease-templates");
  return Response.json({ ok: true });
}
