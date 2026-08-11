import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { deleteLease, updateLease } from "@/lib/leases";
import { updateLeaseSchema } from "@/lib/leases-schemas";
import { formatCurrencyFull } from "@/lib/format";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/leases/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateLeaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const result = await updateLease(auth.context.organizationId, id, parsed.data);

  if (result.error === "not-found") {
    return Response.json({ error: "Lease not found" }, { status: 404 });
  }
  if (result.error === "unit-not-found") {
    return Response.json({ error: "Unit not found" }, { status: 404 });
  }
  if (result.error === "tenant-not-found") {
    return Response.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (result.error === "duration-too-short") {
    return Response.json(
      {
        error: "Validation failed",
        issues: {
          durationMonths: [
            `This unit has a minimum tenure of ${result.minTenureMonths} months`,
          ],
        },
      },
      { status: 400 }
    );
  }
  if (result.error === "amount-below-paid") {
    return Response.json(
      {
        error: "Validation failed",
        issues: {
          durationMonths: [
            `That would make the lease worth ${formatCurrencyFull(result.leaseAmount)}, ` +
              `but ${formatCurrencyFull(result.paid)} has already been paid against it`,
          ],
        },
      },
      { status: 400 }
    );
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
  revalidatePath("/payments");
  revalidatePath("/dashboard");

  return Response.json({ lease: result.lease });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/leases/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const result = await deleteLease(auth.context.organizationId, id);

  if (result.error === "not-found") {
    return Response.json({ error: "Lease not found" }, { status: 404 });
  }

  revalidatePath("/leases");
  revalidatePath("/properties");
  revalidatePath("/tenants");
  // The invoice and its payments cascade with the lease, so the money views
  // move too.
  revalidatePath("/payments");
  revalidatePath("/dashboard");

  return Response.json({ ok: true });
}
