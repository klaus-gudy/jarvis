import { randomUUID } from "node:crypto";

import { ACCEPTED_FILE_TYPES, type DocumentSubject } from "@/lib/document-options";
import type { UploadDocumentInput } from "@/lib/documents-schemas";
import type { FileAssetType } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { deleteObject, putObject } from "@/lib/storage";
import { displayName } from "@/lib/user-display";

/**
 * The single door between the app and stored files. Everything that writes a
 * `FileAsset` goes through `createDocument`, which is what makes the
 * cross-organization rule enforceable at all: the subject is resolved against
 * the caller's organization *before* anything is written, so a lease id
 * borrowed from another tenancy resolves to nothing and the upload is refused.
 */

/**
 * The subject's segment in the object key. Plural entity names, so a key reads
 * as a path someone could navigate in the MinIO console:
 *
 *   organizations/<orgId>/members/<membershipId>/<uuid>.pdf
 *   organizations/<orgId>/organization/<uuid>.pdf
 *
 * `members`, not `tenants` — the subject is a Membership, and an Owner has one
 * of those too.
 */
const KEY_SEGMENT: Record<DocumentSubject, string> = {
  organization: "organization",
  property: "properties",
  unit: "units",
  membership: "members",
  lease: "leases",
  invoice: "invoices",
  payment: "payments",
};

/** The `FileAsset` column each subject writes to. */
const SUBJECT_COLUMN: Record<Exclude<DocumentSubject, "organization">, string> = {
  property: "propertyId",
  unit: "unitId",
  membership: "membershipId",
  lease: "leaseId",
  invoice: "invoiceId",
  payment: "paymentId",
};

/**
 * `organizations/<orgId>/<scope>/<scopeId>/<uuid><ext>`.
 *
 * The stored file is named by a fresh uuid, never by what the browser sent:
 * two tenants both uploading `scan.pdf` must not overwrite one another, and an
 * uploaded name can contain anything at all, including `../`. The name the
 * person chose survives in `fileName` and comes back on download.
 *
 * The extension comes from the verified MIME type for the same reason.
 */
export function buildObjectKey(input: {
  organizationId: string;
  subjectType: DocumentSubject;
  subjectId: string | null;
  extension: string;
}) {
  const scope =
    input.subjectType === "organization" || !input.subjectId
      ? KEY_SEGMENT.organization
      : `${KEY_SEGMENT[input.subjectType]}/${input.subjectId}`;

  return `organizations/${input.organizationId}/${scope}/${randomUUID()}${input.extension}`;
}

/**
 * Does this subject exist, and does it belong to this organization? One query
 * per subject rather than a generic one, because the path from each to its
 * organization differs — a Unit reaches it through its Property, a Payment
 * through three hops. Returns false for "not found" and for "found, but
 * someone else's", deliberately: telling the two apart would confirm the
 * existence of another tenancy's records.
 */
async function subjectBelongsToOrg(
  organizationId: string,
  subjectType: DocumentSubject,
  subjectId: string
) {
  const where = {
    property: { id: subjectId, organizationId },
    unit: { id: subjectId, property: { organizationId } },
    membership: { id: subjectId, organizationId },
    lease: { id: subjectId, unit: { property: { organizationId } } },
    invoice: { id: subjectId, lease: { unit: { property: { organizationId } } } },
    payment: {
      id: subjectId,
      invoice: { lease: { unit: { property: { organizationId } } } },
    },
  };

  switch (subjectType) {
    case "organization":
      return true;
    case "property":
      return (await prisma.property.count({ where: where.property })) > 0;
    case "unit":
      return (await prisma.unit.count({ where: where.unit })) > 0;
    case "membership":
      return (await prisma.membership.count({ where: where.membership })) > 0;
    case "lease":
      return (await prisma.lease.count({ where: where.lease })) > 0;
    case "invoice":
      return (await prisma.invoice.count({ where: where.invoice })) > 0;
    case "payment":
      return (await prisma.payment.count({ where: where.payment })) > 0;
  }
}

export type DocumentRow = {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  assetType: FileAssetType;
  createdAt: Date;
  /** Null once the uploader has left the organization — the file outlives them. */
  uploadedByName: string | null;
};

const ROW_SELECT = {
  id: true,
  fileName: true,
  fileType: true,
  sizeBytes: true,
  assetType: true,
  createdAt: true,
  uploadedBy: {
    select: { user: { select: { name: true, email: true, phone: true } } },
  },
} as const;

type SelectedRow = {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  assetType: FileAssetType;
  createdAt: Date;
  uploadedBy: {
    user: { name: string | null; email: string | null; phone: string | null };
  } | null;
};

function toRow(row: SelectedRow): DocumentRow {
  return {
    id: row.id,
    fileName: row.fileName,
    fileType: row.fileType,
    sizeBytes: row.sizeBytes,
    assetType: row.assetType,
    createdAt: row.createdAt,
    uploadedByName: row.uploadedBy ? displayName(row.uploadedBy.user) : null,
  };
}

/**
 * Bytes to the bucket, then a row. That order, not the reverse: a row written
 * before a failed upload points at nothing and shows in the UI as a document
 * that will not open, whereas an object written before a failed insert is
 * invisible and merely wasteful. The insert is wrapped so that failure best-
 * effort removes the object it just wrote — which closes the common case, not
 * the one where this process dies in between.
 */
export async function createDocument(
  organizationId: string,
  userId: string,
  input: UploadDocumentInput,
  file: { name: string; type: string; bytes: Uint8Array }
) {
  if (input.subjectId) {
    const belongs = await subjectBelongsToOrg(
      organizationId,
      input.subjectType,
      input.subjectId
    );
    if (!belongs) return { error: "subject-not-found" as const };
  }

  // Who is uploading, as a Membership rather than a User — `FileAsset` records
  // the membership so an uploader is scoped to the organization they did it in.
  const uploader = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { id: true },
  });

  const { extension } = ACCEPTED_FILE_TYPES[file.type];
  const objectKey = buildObjectKey({
    organizationId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    extension,
  });

  await putObject(objectKey, file.bytes, file.type);

  try {
    const created = await prisma.fileAsset.create({
      data: {
        objectKey,
        fileName: file.name,
        fileType: file.type,
        sizeBytes: file.bytes.byteLength,
        assetType: input.assetType,
        organizationId,
        uploadedById: uploader?.id ?? null,
        ...(input.subjectId
          ? { [SUBJECT_COLUMN[input.subjectType as keyof typeof SUBJECT_COLUMN]]: input.subjectId }
          : {}),
      },
      select: ROW_SELECT,
    });

    return { document: toRow(created) };
  } catch (cause) {
    await deleteObject(objectKey).catch(() => {
      // Already failing; an orphaned object is the lesser problem and the
      // reaper described in TASKS.md Phase 67 is what actually solves it.
    });
    throw cause;
  }
}

/**
 * Newest first — a documents list is read as "what came in recently", and the
 * `FileAsset_organizationId_createdAt_idx` index is ordered for it.
 */
export async function listDocuments(
  organizationId: string,
  subjectType: DocumentSubject,
  subjectId: string | null
): Promise<DocumentRow[]> {
  const rows = await prisma.fileAsset.findMany({
    where: {
      organizationId,
      ...(subjectId
        ? { [SUBJECT_COLUMN[subjectType as keyof typeof SUBJECT_COLUMN]]: subjectId }
        : {
            // Organization-level means *no* subject, not "any" — without all
            // six nulls this would return every file in the organization.
            propertyId: null,
            unitId: null,
            membershipId: null,
            leaseId: null,
            invoiceId: null,
            paymentId: null,
          }),
    },
    orderBy: { createdAt: "desc" },
    select: ROW_SELECT,
  });

  return rows.map(toRow);
}

/**
 * Scoped by `organizationId` in the same query as the id, never checked
 * afterwards: a `findUnique` on the id alone would fetch another tenancy's row
 * into this process, and the only thing standing between that and the response
 * would be an `if` someone can forget.
 */
export async function getDocument(organizationId: string, id: string) {
  return prisma.fileAsset.findFirst({
    where: { id, organizationId },
    select: { id: true, objectKey: true, fileName: true, fileType: true },
  });
}

/**
 * Row first, then object. A row whose object is gone renders as a document
 * that will not open; an object whose row is gone is invisible. Given one of
 * the two has to happen when the second call fails, the invisible one is the
 * better failure.
 */
export async function deleteDocument(organizationId: string, id: string) {
  const document = await getDocument(organizationId, id);
  if (!document) return { error: "not-found" as const };

  await prisma.fileAsset.delete({ where: { id: document.id } });
  await deleteObject(document.objectKey);

  return { ok: true as const };
}
