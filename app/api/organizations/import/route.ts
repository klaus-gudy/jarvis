import { authorize } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ForeignAccountError,
  importOrganizationBackup,
  parseOrganizationBackup,
} from "@/lib/organization-import";
import { MAX_IMPORT_BYTES } from "@/lib/xlsx-import";

/**
 * Restores a backup produced by `GET /api/organizations/export` into the
 * caller's active organization. Owner-only, and refuses unless that
 * organization is empty — restoring into one that already has properties or
 * other members would either duplicate data or silently merge two
 * unrelated organizations' histories, neither of which "restore" should mean.
 */
export async function POST(request: Request) {
  const auth = await authorize("org:restore");
  if (!auth.ok) return auth.response;

  const [propertyCount, membershipCount] = await Promise.all([
    prisma.property.count({ where: { organizationId: auth.context.organizationId } }),
    prisma.membership.count({ where: { organizationId: auth.context.organizationId } }),
  ]);
  // membershipCount > 1 rather than > 0: the owner restoring the backup
  // already has exactly one membership, their own, in the organization they
  // just created for this.
  if (propertyCount > 0 || membershipCount > 1) {
    return Response.json(
      {
        error:
          "This organization already has data. Restore a backup only into a freshly created, empty organization.",
      },
      { status: 409 }
    );
  }

  // No header (a chunked body) counts as too large: without it the whole
  // body would be buffered before any size check ran.
  const contentLength = Number(request.headers.get("content-length") ?? Infinity);
  if (contentLength > MAX_IMPORT_BYTES) {
    return Response.json({ error: "That file is too large." }, { status: 413 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return Response.json({ error: "That file is too large." }, { status: 413 });
  }

  const buffer = await file.arrayBuffer();
  const parsed = await parseOrganizationBackup(buffer);
  if (!parsed.ok) {
    return Response.json(
      { error: "This file couldn't be restored.", issues: parsed.errors },
      { status: 422 }
    );
  }

  let summary;
  try {
    summary = await importOrganizationBackup(auth.context.organizationId, parsed.data, {
      actorUserId: auth.context.userId,
    });
  } catch (cause) {
    if (cause instanceof ForeignAccountError) {
      return Response.json(
        {
          error: "This file couldn't be restored.",
          issues: [
            `${cause.contact} already has their own account. Remove them from the Memberships sheet and invite them instead.`,
          ],
        },
        { status: 422 }
      );
    }
    throw cause;
  }

  return Response.json({ ok: true, summary });
}
