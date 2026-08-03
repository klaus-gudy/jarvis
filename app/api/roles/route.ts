import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActiveOrg } from "@/lib/api-auth";
import { createRole, getRoles } from "@/lib/roles";

const createRoleSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(40),
});

export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const roles = await getRoles(auth.context.organizationId);
  return Response.json({ roles });
}

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
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

  const result = await createRole(auth.context.organizationId, parsed.data.name);
  if (result.error === "duplicate") {
    return Response.json(
      { error: "A role with this name already exists" },
      { status: 409 }
    );
  }

  revalidatePath("/users");
  return Response.json({ role: result.role }, { status: 201 });
}
