import { authorize } from "@/lib/authz";
import { getMembers } from "@/lib/members";

export async function GET() {
  const auth = await authorize("member:read");
  if (!auth.ok) return auth.response;

  const members = await getMembers(auth.context.organizationId);
  return Response.json({ members });
}
