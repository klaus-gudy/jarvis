import { authorizeTenant } from "@/lib/authz";
import { getPortalDocument } from "@/lib/portal";
import { getObjectStream, StorageNotConfiguredError } from "@/lib/storage";

/**
 * A tenant's own file — a contract on one of their leases, or something filed
 * under their membership. `getPortalDocument` pins the lookup to the caller's
 * membership, so another tenant's id reads as not found.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/portal/documents/[id]">) {
  const auth = await authorizeTenant();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const document = await getPortalDocument(auth.context, id);
  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  let body: ReadableStream | null;
  try {
    body = await getObjectStream(document.objectKey);
  } catch (cause) {
    if (cause instanceof StorageNotConfiguredError) {
      console.error(cause.message);
      return Response.json(
        { error: "File storage is not available right now" },
        { status: 503 }
      );
    }
    throw cause;
  }
  if (!body) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.has("download");
  return new Response(body, {
    headers: {
      "Content-Type": document.fileType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${document.fileName.replace(/["\\\r\n]/g, "")}"`,
      "Cache-Control": "private, max-age=0, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
