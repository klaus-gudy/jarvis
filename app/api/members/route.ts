import { requireActiveOrg } from "@/lib/api-auth";
import { getMembers } from "@/lib/members";

export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const members = await getMembers(auth.context.organizationId);
  return Response.json({ members });
}
