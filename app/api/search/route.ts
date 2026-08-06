import { requireActiveOrg } from "@/lib/api-auth";
import { searchOrganization } from "@/lib/search";

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchOrganization(auth.context.organizationId, query);

  return Response.json({ results });
}
