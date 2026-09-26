import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { createRole, getRoles } from "@/lib/roles";
import { createRoleSchema } from "@/lib/roles-schemas";

/** Also read by the invite dialog and the member role picker. */
export async function GET() {
  const auth = await authorize(["role:manage", "member:invite", "member:write"]);
  if (!auth.ok) return auth.response;

  const roles = await getRoles(auth.context.organizationId);
  return Response.json({ roles });
}

export async function POST(request: Request) {
  const auth = await authorize("role:manage");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await createRole(auth.context, parsed.data);
  if (result.error === "duplicate") {
    return Response.json(
      { error: "A role with this name already exists" },
      { status: 409 }
    );
  }
  if (result.error === "escalation") {
    return Response.json(
      { error: "You can't grant permissions you don't hold yourself" },
      { status: 403 }
    );
  }

  // Both pages read roles: /roles lists them, /users uses them for the invite
  // dialog and the role filter.
  revalidatePath("/roles");
  revalidatePath("/users");
  return Response.json({ role: result.role }, { status: 201 });
}
