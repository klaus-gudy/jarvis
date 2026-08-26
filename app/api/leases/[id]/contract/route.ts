import { requireActiveOrg } from "@/lib/api-auth";
import { generateLeaseContract } from "@/lib/lease-templates";

/**
 * A lease template filled in from a real lease — the other half of
 * `/settings/lease-templates`, and what proves a placeholder offered in the
 * editor actually resolves against the database.
 *
 * `?templateId=` picks a template; omitted, the organization's default is used.
 * `?format=html` returns the document itself rather than JSON, which is what a
 * print-to-PDF or an email attachment would read.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/leases/[id]/contract">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const templateId = url.searchParams.get("templateId") ?? undefined;

  const result = await generateLeaseContract(
    auth.context.organizationId,
    id,
    templateId
  );

  if ("error" in result) {
    return result.error === "no-template"
      ? Response.json(
          {
            error:
              "No lease template to generate from. Create one under Settings → Lease templates.",
          },
          { status: 404 }
        )
      : Response.json({ error: "Lease not found" }, { status: 404 });
  }

  if (url.searchParams.get("format") === "html") {
    return new Response(result.contract.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        /**
         * The body is HTML an organization's own member wrote. It is stripped
         * on the way out (`sanitizeTemplateHtml`), but this is the one route
         * that hands it to a browser as a document rather than as data, so the
         * browser is told to treat it as untrusted: no scripts, no origin, no
         * loads of any kind.
         */
        "Content-Security-Policy":
          "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return Response.json({ contract: result.contract });
}
