import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { createTenant, getTenants } from "@/lib/tenants";
import { createTenantSchema } from "@/lib/tenants-schemas";

export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const tenants = await getTenants(auth.context.organizationId);
  return Response.json({ tenants });
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

  const parsed = createTenantSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await createTenant(auth.context.organizationId, parsed.data);
  if (result.error === "already-member") {
    return Response.json(
      { error: "Someone with this phone or email is already in this organization" },
      { status: 409 }
    );
  }

  revalidatePath("/tenants");
  revalidatePath("/users");

  return Response.json({ membership: result.membership }, { status: 201 });
}
