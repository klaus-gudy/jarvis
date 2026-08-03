import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { createLease, getLeases } from "@/lib/leases";
import { createLeaseSchema } from "@/lib/leases-schemas";

export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const leases = await getLeases(auth.context.organizationId);
  return Response.json({ leases });
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

  const parsed = createLeaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await createLease(auth.context.organizationId, parsed.data);

  if (result.error === "unit-not-found") {
    return Response.json({ error: "Unit not found" }, { status: 404 });
  }
  if (result.error === "tenant-not-found") {
    return Response.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (result.error === "unit-occupied") {
    return Response.json(
      { error: "This unit already has a lease over that period" },
      { status: 409 }
    );
  }

  revalidatePath("/leases");
  revalidatePath("/properties");
  revalidatePath("/tenants");

  return Response.json({ lease: result.lease }, { status: 201 });
}
