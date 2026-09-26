import { authorize } from "@/lib/authz";
import { searchOrganization } from "@/lib/search";

export async function GET(request: Request) {
  const auth = await authorize();
  if (!auth.ok) return auth.response;

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchOrganization(auth.context, query);

  return Response.json({ results });
}
