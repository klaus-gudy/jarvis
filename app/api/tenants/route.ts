import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { createTenant, getTenants } from "@/lib/tenants";
import { createTenantSchema } from "@/lib/tenants-schemas";

export async function GET() {
  const auth = await authorize("tenant:read");
  if (!auth.ok) return auth.response;

  const tenants = await getTenants(auth.context.organizationId);
  return Response.json({ tenants });
}

export async function POST(request: Request) {
  const auth = await authorize("tenant:write");
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

  const result = await createTenant(auth.context.organizationId, parsed.data, auth.context);
  if (result.error === "account-exists") {
    return Response.json(
      {
        error:
          "This phone or email already belongs to an account. Invite them from the Users page instead — they'll accept it themselves.",
      },
      { status: 409 }
    );
  }
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
