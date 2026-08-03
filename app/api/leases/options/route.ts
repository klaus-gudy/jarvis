import { requireActiveOrg } from "@/lib/api-auth";
import { getLeaseOptions } from "@/lib/leases";

/** Vacant units and Tenant-role members — the only two things a new lease can be built from. */
export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const options = await getLeaseOptions(auth.context.organizationId);
  return Response.json(options);
}
