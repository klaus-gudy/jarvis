import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { requireActiveOrg } from "@/lib/api-auth";
import { buildContractPlan } from "@/lib/contracts";
import { publishEvent } from "@/lib/events/publisher";
import { announceLeaseCreated, createLease, getLeases } from "@/lib/leases";
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

  // After the response: the lease and its invoice are committed either way,
  // and a broker round trip has no business delaying the redirect.
  const { organizationId } = auth.context;
  const leaseId = result.lease.id;
  after(() => announceLeaseCreated(organizationId, leaseId));

  /**
   * The domain event, separate from the emails above. `announceLeaseCreated`
   * says "tell these people"; this says "a lease now exists, and here is the
   * contract to make from it" — the filled HTML and the object key the PDF is
   * to be stored under, which is everything `document-worker` needs to render
   * and file it without reading a database or resolving a template.
   *
   * Both halves are decided here, while the lease is fresh, so the wording
   * filed is the wording in force at signing rather than whatever the template
   * says by the time the queue is drained.
   *
   * Inside `after()`, so a template read and a broker round trip stay off the
   * request path. Neither step can fail the lease: `buildContractPlan` returns
   * its failures rather than throwing, and `publishEvent` swallows its own — a
   * broker outage means the contract is generated late (or from the Contract
   * tab by hand), not that signing a lease fails.
   */
  after(async () => {
    const plan = await buildContractPlan(organizationId, leaseId);

    if ("error" in plan) {
      console.warn(
        `[leases] no contract queued for ${leaseId}: ${plan.error.message}`
      );
      return;
    }

    await publishEvent("lease.created", plan.plan.event);
  });

  revalidatePath("/leases");
  revalidatePath("/properties");
  revalidatePath("/tenants");

  return Response.json({ lease: result.lease }, { status: 201 });
}
