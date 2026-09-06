import { requireActiveOrg } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  importOrganizationBackup,
  parseOrganizationBackup,
} from "@/lib/organization-import";
import { OWNER_ROLE_NAME } from "@/lib/roles";
import { MAX_IMPORT_BYTES } from "@/lib/xlsx-import";

/**
 * Restores a backup produced by `GET /api/organizations/export` into the
 * caller's active organization. Owner-only, and refuses unless that
 * organization is empty — restoring into one that already has properties or
 * other members would either duplicate data or silently merge two
 * unrelated organizations' histories, neither of which "restore" should mean.
 */
export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const membership = await prisma.membership.findFirst({
    where: {
      userId: auth.context.userId,
      organizationId: auth.context.organizationId,
    },
    select: { role: { select: { name: true } } },
  });
  const isOwner =
    membership?.role.name.toLowerCase() === OWNER_ROLE_NAME.toLowerCase();
  if (!isOwner) {
    return Response.json(
      { error: "Only the organization's owner can restore a backup" },
      { status: 403 }
    );
  }

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

  const contentLength = Number(request.headers.get("content-length") ?? 0);
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

  const summary = await importOrganizationBackup(
    auth.context.organizationId,
    parsed.data
  );

  return Response.json({ ok: true, summary });
}
