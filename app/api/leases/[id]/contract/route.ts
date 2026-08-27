import { requireActiveOrg } from "@/lib/api-auth";
import { publishEvent } from "@/lib/events/publisher";
import { generateLeaseContract } from "@/lib/lease-templates";
import { prisma } from "@/lib/prisma";

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

/**
 * Asks for the contract to be generated and filed — the same request the
 * `lease.created` event makes, for a lease that has none.
 *
 * Publishes rather than rendering here, so **Chromium stays out of the web
 * process**: `lib/pdf.ts` needs a browser, and the only thing that should have
 * to have one installed is `worker/contract-worker.ts`. 202, not 201: nothing
 * has been created yet, and saying otherwise would be a lie the Contract tab
 * then has to explain.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/leases/[id]/contract">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { organizationId } = auth.context;
  const { id } = await ctx.params;

  // Scoped through both relations, matching `getLease` — the worker would
  // refuse a borrowed id anyway, but a 404 here says so immediately instead of
  // accepting the request and silently doing nothing.
  const lease = await prisma.lease.findFirst({
    where: {
      id,
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
    select: { id: true },
  });
  if (!lease) return Response.json({ error: "Lease not found" }, { status: 404 });

  const published = await publishEvent("lease.created", {
    organizationId,
    leaseId: lease.id,
    occurredAt: new Date().toISOString(),
  });

  if (!published.ok) {
    return Response.json(
      { error: "Could not queue the contract. Is the message broker running?" },
      { status: 503 }
    );
  }

  return Response.json({ queued: true }, { status: 202 });
}
