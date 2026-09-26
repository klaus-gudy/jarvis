import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { deleteRole, updateRole } from "@/lib/roles";
import { updateRoleSchema } from "@/lib/roles-schemas";

const REFUSALS = {
  "not-found": [404, "Role not found"],
  forbidden: [403, "Only an Owner can change the Owner role"],
  "built-in": [400, "Owner and Tenant are built in — their permissions are fixed and they can't be deleted"],
  escalation: [403, "You can't grant or remove permissions you don't hold yourself"],
  duplicate: [409, "A role with this name already exists"],
  "in-use": [409, "Move this role's members and pending invitations to another role first"],
} as const;

function refuse(error: keyof typeof REFUSALS) {
  const [status, message] = REFUSALS[error];
  return Response.json({ error: message }, { status });
}

function revalidate() {
  revalidatePath("/roles");
  revalidatePath("/users");
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/roles/[id]">) {
  const auth = await authorize("role:manage");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const result = await updateRole(auth.context, id, parsed.data);
  if ("error" in result && result.error) return refuse(result.error);

  revalidate();
  return Response.json({ role: result.role });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/roles/[id]">) {
  const auth = await authorize("role:manage");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const result = await deleteRole(auth.context, id);
  if ("error" in result && result.error) return refuse(result.error);

  revalidate();
  return Response.json({ ok: true });
}
