import { authorize } from "@/lib/authz";
import { getLeaseOptions } from "@/lib/leases";

/** Vacant units and Tenant-role members — the only two things a new lease can be built from. */
export async function GET() {
  const auth = await authorize("lease:write");
  if (!auth.ok) return auth.response;

  const options = await getLeaseOptions(auth.context.organizationId);
  return Response.json(options);
}
