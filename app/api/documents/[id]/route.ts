import { revalidatePath } from "next/cache";

import { authorizeMember, can } from "@/lib/authz";
import { documentRequirement, subjectOfRow } from "@/lib/document-access";
import { THUMBNAIL_WIDTHS, type ThumbnailWidth } from "@/lib/document-options";
import { deleteDocument, getDocument } from "@/lib/documents";
import { getObjectStream, StorageNotConfiguredError } from "@/lib/storage";
import { getThumbnail } from "@/lib/thumbnails";

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
  const auth = await authorizeMember();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  // Scoped to the organization inside the query, so another tenancy's id is
  // indistinguishable from one that does not exist.
  const document = await getDocument(auth.context.organizationId, id);
  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }
  const required = documentRequirement(
    subjectOfRow(document),
    "read",
    auth.context
  );
  if (required && !can(auth.context, required)) {
    return Response.json({ error: "You don't have permission to do that" }, { status: 403 });
  }

  // `?w=96|192|1280` asks for a resized copy of an image (`lib/thumbnails.ts`).
  // Anything else — no width, an unknown one, or a PDF — gets the original.
  const width = Number(new URL(request.url).searchParams.get("w"));
  const thumbnail =
    document.fileType.startsWith("image/") &&
    THUMBNAIL_WIDTHS.includes(width as ThumbnailWidth)
      ? (width as ThumbnailWidth)
      : null;

  let body: ReadableStream | Uint8Array | null;
  try {
    body = thumbnail
      ? await getThumbnail(document.objectKey, thumbnail)
      : await getObjectStream(document.objectKey);
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

  if (thumbnail) {
    return new Response(body as BodyInit, {
      headers: {
        "Content-Type": "image/webp",
        // Unlike the original, safe to keep for a while: the object behind it
        // is immutable (fresh uuid per upload), and it stays private.
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  return new Response(body as BodyInit, {
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
  const auth = await authorizeMember();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const document = await getDocument(auth.context.organizationId, id);
  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }
  const required = documentRequirement(
    subjectOfRow(document),
    "write",
    auth.context
  );
  if (required && !can(auth.context, required)) {
    return Response.json({ error: "You don't have permission to do that" }, { status: 403 });
  }

  try {
    const result = await deleteDocument(auth.context.organizationId, id, auth.context);
    if (result.error === "not-found") {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }
    if (result.error === "signed") {
      return Response.json(
        { error: "A signed contract is kept on file and can't be deleted" },
        { status: 409 }
      );
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
