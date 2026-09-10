import { requireActiveOrg } from "@/lib/api-auth";
import { buildContractPlan } from "@/lib/contracts";
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
 * Queues the contract for this lease, and answers 202.
 *
 * **It used to render inline and stream progress over SSE**, so that a person
 * waiting on the button found out whether it actually worked — a 202 can only
 * say the message was accepted, which is the one thing they did not ask. That
 * is gone with the browser: rendering belongs to `document-worker` now, and
 * this process has no way to watch it happen.
 *
 * The honest cost, written down rather than discovered later: a missing
 * template is still reported here (the plan is built before anything is
 * published, so that failure is synchronous), but a render or upload that fails
 * on the other side is invisible from this button, and so is a
 * `document-worker` that is not running. Recovering that needs a job-status row
 * the two processes can both see — see TASKS.md.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/leases/[id]/contract">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { organizationId } = auth.context;
  const { id } = await ctx.params;

  const lease = await prisma.lease.findFirst({
    where: {
      id,
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
    select: { id: true },
  });
  if (!lease) return Response.json({ error: "Lease not found" }, { status: 404 });

  /*
   * Built here rather than in `after()`, deliberately: this is the one caller
   * with a person waiting on the answer, and "this organization has no lease
   * template" is a real, actionable failure that would otherwise vanish into a
   * log. It is the only part of the pipeline this process can still see.
   */
  const plan = await buildContractPlan(organizationId, lease.id);

  if ("error" in plan) {
    return Response.json(
      { error: plan.error.message },
      { status: plan.error.reason === "unexpected" ? 500 : 404 }
    );
  }

  const published = await publishEvent("lease.created", plan.plan.event);

  if (!published.ok) {
    return Response.json(
      { error: `The contract could not be queued: ${published.error}` },
      { status: 502 }
    );
  }

  return Response.json(
    { queued: true, fileName: plan.plan.fileName, missing: plan.plan.missing },
    { status: 202 }
  );
}
