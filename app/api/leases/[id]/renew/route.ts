import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { authorize } from "@/lib/authz";
import { queueContractsForRenewals } from "@/lib/lease-lifecycle";
import { announceLeaseRenewals, renewLease } from "@/lib/leases";
import { renewLeaseSchema } from "@/lib/leases-schemas";

/** A hand-made renewal: a successor lease on the same unit, for the same tenant. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/leases/[id]/renew">
) {
  const auth = await authorize("lease:write");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = renewLeaseSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { id } = await ctx.params;
  const result = await renewLease(auth.context.organizationId, id, parsed.data, auth.context);

  if (result.error === "not-found") {
    return Response.json({ error: "Lease not found" }, { status: 404 });
  }
  if (result.error === "already-renewed") {
    return Response.json({ error: "This lease has already been renewed" }, { status: 409 });
  }
  if (result.error === "not-ended") {
    return Response.json(
      { error: "Only a lease that has ended can be renewed" },
      { status: 409 }
    );
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
  if (result.error === "unit-occupied") {
    return Response.json(
      { error: "This unit already has a lease over that period" },
      { status: 409 }
    );
  }

  // The same mail and contract the automatic renewal sends, after the
  // response: both swallow their own failures and the lease stands without them.
  const { organizationId } = auth.context;
  const renewals = [{ leaseId: result.lease.id, previousEndDate: result.previousEndDate }];
  after(async () => {
    await announceLeaseRenewals(organizationId, renewals);
    await queueContractsForRenewals(organizationId, renewals);
  });

  revalidatePath("/leases");
  revalidatePath("/properties");
  revalidatePath("/tenants");
  revalidatePath("/members");

  return Response.json({ lease: result.lease }, { status: 201 });
}
