import { requireActiveOrg } from "@/lib/api-auth";
import { CONTRACT_STEP_LABELS } from "@/lib/contract-steps";
import { describeError, generateAndStoreContract } from "@/lib/contracts";
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
 * Generates the contract and **streams what is happening while it happens**.
 *
 * This one renders inline rather than publishing `lease.created` and returning
 * 202. The queue is still right for the automatic path — a lease must not wait
 * on a browser, and a storage outage must not fail a signing — but it is wrong
 * *here*, because a person is sitting in front of this button waiting to find
 * out whether it worked. A 202 and "refresh in a moment" cannot tell them that
 * Chromium is missing or that MinIO refused the object; it can only tell them
 * the message was accepted, which is the one thing they did not ask.
 *
 * The cost, stated plainly: the web process now needs the browser that
 * `lib/pdf.ts` launches, where before only `worker/contract-worker.ts` did.
 * That is the price of showing the error, and it is worth it for a manual
 * recovery action — but it means `npx playwright install chromium` is now a
 * requirement wherever `next start` runs, not just on the worker host.
 *
 * Server-sent events rather than NDJSON: `text/event-stream` is the one
 * content type proxies and dev servers reliably refuse to buffer, and a
 * progress stream that arrives in one lump at the end is not a progress
 * stream. Read with `fetch` + a reader rather than `EventSource`, which cannot
 * POST.
 */
export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/leases/[id]/contract">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { organizationId } = auth.context;
  const { id } = await ctx.params;

  // Checked *before* the stream opens, so "you cannot do this" stays an
  // ordinary JSON status the client can branch on, rather than an error event
  // inside a 200 response.
  const lease = await prisma.lease.findFirst({
    where: {
      id,
      membership: { organizationId },
      unit: { property: { organizationId } },
    },
    select: { id: true },
  });
  if (!lease) return Response.json({ error: "Lease not found" }, { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        const result = await generateAndStoreContract(
          organizationId,
          lease.id,
          (step) => send({ type: "step", step, label: CONTRACT_STEP_LABELS[step] })
        );

        send(
          result.ok
            ? {
                type: "done",
                documentId: result.documentId,
                fileName: result.fileName,
                // Not an error, but worth saying: a contract with blank fill
                // lines is usually a member record nobody finished.
                missing: result.missing,
              }
            : { type: "error", reason: result.reason, message: result.message }
        );
      } catch (cause) {
        // `generateAndStoreContract` returns its expected failures, so reaching
        // here means something genuinely unhandled — a dead browser, a broken
        // connection. It still has to reach the person waiting.
        send({
          type: "error",
          reason: "unexpected",
          message: describeError(cause),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // `no-transform` matters as much as `no-store`: a proxy that gzips this
      // will also buffer it, and the stream arrives as one lump at the end.
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // nginx's own opt-out, harmless everywhere else.
      "X-Accel-Buffering": "no",
    },
  });
}
