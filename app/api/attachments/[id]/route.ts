import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import {
  deleteAttachment,
  getAttachmentUrl,
  OWNER_REVALIDATE_PATHS,
} from "@/lib/attachments";

/**
 * Hands out one file. The bucket is private, so this is the only way bytes
 * leave it: the org is checked here, then the browser is redirected to a
 * presigned URL that expires in minutes.
 *
 * A stable app URL rather than a presigned one in the page means an `<img>`
 * src or a copied link keeps working after the signature would have expired —
 * the permission is re-checked on each request instead of being baked into a
 * link that outlives the checking.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/attachments/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const download = new URL(request.url).searchParams.get("download") === "1";

  const url = await getAttachmentUrl(auth.context.organizationId, id, download);
  if (!url) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      // The redirect target carries a signature that expires and is scoped to
      // this org — it must never be served to the next request from a cache.
      "Cache-Control": "no-store, private",
    },
  });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/attachments/[id]">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const deleted = await deleteAttachment(auth.context.organizationId, id);

  if (!deleted) {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  for (const path of OWNER_REVALIDATE_PATHS[deleted.ownerType]) {
    revalidatePath(path);
  }

  return Response.json({ ok: true });
}
