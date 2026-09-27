import { authorizeMember } from "@/lib/authz";
import { searchOrganization } from "@/lib/search";

export async function GET(request: Request) {
  // Any member: every result type is filtered by permission in
  // `searchOrganization`, so a role with none simply gets nothing back.
  const auth = await authorizeMember();
  if (!auth.ok) return auth.response;

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchOrganization(auth.context, query);

  return Response.json({ results });
}
