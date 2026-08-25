import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { deleteDocument, getDocument } from "@/lib/documents";
import { getObjectStream, StorageNotConfiguredError } from "@/lib/storage";

/**
 * Read and delete one document.
 *
 * The bytes are streamed back through this handler rather than the browser
 * being sent to the bucket. The bucket stays private that way, and every read
 * passes the same organization check as every other route — a presigned URL
 * would be a credential in a query string that keeps working after the person
 * loses access.
 */

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  // Scoped to the organization inside the query, so another tenancy's id is
  // indistinguishable from one that does not exist.
  const document = await getDocument(auth.context.organizationId, id);
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

  // The row outlived its object. Not supposed to happen; does happen when a
  // delete half-failed, and a 404 is more honest than a 500.
  if (!body) {
    console.error(`FileAsset ${document.id} has no object at ${document.objectKey}`);
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  // `?download` forces the save dialog; without it a PDF or an image opens in
  // the tab, which is what someone clicking a document expects.
  const download = new URL(request.url).searchParams.has("download");
  const disposition = download ? "attachment" : "inline";

  return new Response(body, {
    headers: {
      "Content-Type": document.fileType,
      // The uploaded name is echoed back here, so it is quoted and stripped of
      // the two characters that would let it break out of the header.
      "Content-Disposition": `${disposition}; filename="${document.fileName.replace(/["\\\r\n]/g, "")}"`,
      // Private: this response is only correct for the signed-in member who
      // asked for it, and a shared cache must not serve it to anyone else.
      "Cache-Control": "private, max-age=0, no-store",
      // The file is attacker-supplied and served from this app's origin. The
      // MIME allowlist is the real defence; this is the belt to its braces.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/documents/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  try {
    const result = await deleteDocument(auth.context.organizationId, id);
    if (result.error === "not-found") {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }
  } catch (cause) {
    if (cause instanceof StorageNotConfiguredError) {
      console.error(cause.message);
      return Response.json(
        { error: "File storage is not available right now" },
        { status: 503 }
      );
    }
    console.error("Document delete failed", cause);
    return Response.json({ error: "Could not delete that file" }, { status: 500 });
  }

  // The row could have hung off any subject and the response no longer knows
  // which, so both segments that render documents are evicted. Cheap: it drops
  // cached renders, it does not re-run anything eagerly.
  revalidatePath("/members", "layout");
  revalidatePath("/properties", "layout");

  return Response.json({ ok: true });
}
