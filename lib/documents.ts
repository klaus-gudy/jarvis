import { randomUUID } from "node:crypto";

import { resolveAssetType } from "@/lib/asset-types";
import { ACCEPTED_FILE_TYPES } from "@/lib/document-options";
import type { UploadDocumentInput } from "@/lib/documents-schemas";
import type { FileAssetSubject } from "@/lib/generated/prisma/enums";
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
const KEY_SEGMENT: Record<FileAssetSubject, string> = {
  ORGANIZATION: "organization",
  PROPERTY: "properties",
  UNIT: "units",
  MEMBERSHIP: "members",
  LEASE: "leases",
  INVOICE: "invoices",
  PAYMENT: "payments",
};

/** The `FileAsset` column each subject writes to. */
const SUBJECT_COLUMN: Record<Exclude<FileAssetSubject, "ORGANIZATION">, string> = {
  PROPERTY: "propertyId",
  UNIT: "unitId",
  MEMBERSHIP: "membershipId",
  LEASE: "leaseId",
  INVOICE: "invoiceId",
  PAYMENT: "paymentId",
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
  subjectType: FileAssetSubject;
  subjectId: string | null;
  extension: string;
}) {
  const scope =
    input.subjectType === "ORGANIZATION" || !input.subjectId
      ? KEY_SEGMENT.ORGANIZATION
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
  subjectType: FileAssetSubject,
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
    case "ORGANIZATION":
      return true;
    case "PROPERTY":
      return (await prisma.property.count({ where: where.property })) > 0;
    case "UNIT":
      return (await prisma.unit.count({ where: where.unit })) > 0;
    case "MEMBERSHIP":
      return (await prisma.membership.count({ where: where.membership })) > 0;
    case "LEASE":
      return (await prisma.lease.count({ where: where.lease })) > 0;
    case "INVOICE":
      return (await prisma.invoice.count({ where: where.invoice })) > 0;
    case "PAYMENT":
      return (await prisma.payment.count({ where: where.payment })) > 0;
  }
}

/**
 * The one already on file for this subject and type, if `allowsMultiple`
 * forbids a second. Scoped by `organizationId` in the same query as the
 * subject column for the same reason `getDocument` is: a check split across
 * two queries is a check someone can forget to keep in sync.
 */
async function findExisting(
  organizationId: string,
  subjectType: FileAssetSubject,
  subjectId: string | null,
  assetTypeId: string
) {
  const column =
    subjectType === "ORGANIZATION" || !subjectId
      ? null
      : SUBJECT_COLUMN[subjectType as keyof typeof SUBJECT_COLUMN];

  return prisma.fileAsset.findFirst({
    where: {
      organizationId,
      assetTypeId,
      ...(column
        ? { [column]: subjectId }
        : {
            propertyId: null,
            unitId: null,
            membershipId: null,
            leaseId: null,
            invoiceId: null,
            paymentId: null,
          }),
    },
    select: { id: true, fileName: true },
  });
}

export type DocumentRow = {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  /**
   * Joined, not just the id: every surface that lists a document renders its
   * label and branches on `isPhoto`, so resolving it per row on the client
   * would be a second lookup that eventually goes missing.
   */
  assetType: { id: string; label: string; isPhoto: boolean };
  createdAt: Date;
  /** Null once the uploader has left the organization — the file outlives them. */
  uploadedByName: string | null;
};

const ROW_SELECT = {
  id: true,
  fileName: true,
  fileType: true,
  sizeBytes: true,
  createdAt: true,
  assetType: { select: { id: true, label: true, isPhoto: true } },
  uploadedBy: {
    select: { user: { select: { name: true, email: true, phone: true } } },
  },
} as const;

type SelectedRow = {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  assetType: { id: string; label: string; isPhoto: boolean };
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
  // The type, resolved against this organization. A custom type belonging to
  // another tenancy resolves to nothing, exactly as a borrowed subject id
  // does — the two are the same class of mistake.
  const assetType = await resolveAssetType(organizationId, input.assetTypeId);
  if (!assetType) return { error: "asset-type-not-found" as const };

  // The pairing rule that used to be a static map: a type declares one subject
  // and may only be filed under it. Checked here rather than in the schema
  // because the type's subject is a column now, and this is the only place
  // that has the row.
  if (assetType.subject !== input.subjectType) {
    return { error: "subject-mismatch" as const, assetType };
  }

  if (input.subjectId) {
    const belongs = await subjectBelongsToOrg(
      organizationId,
      input.subjectType,
      input.subjectId
    );
    if (!belongs) return { error: "subject-not-found" as const };
  }

  // One canonical document per (subject, type) for anything that isn't a
  // declared collection — replacing it means deleting the old one first,
  // rather than the two silently piling up as "which NIDA is current?".
  //
  // Photos are exempt outright, not just by their usual `allowsMultiple`
  // default: a gallery is a collection by definition, and `isPhoto` is
  // enforced here as the actual rule rather than trusted to have been set
  // correctly wherever the row was created.
  if (!assetType.allowsMultiple && !assetType.isPhoto) {
    const existing = await findExisting(
      organizationId,
      input.subjectType,
      input.subjectId,
      assetType.id
    );
    if (existing) {
      return {
        error: "duplicate-asset-type" as const,
        existing,
        assetType,
      };
    }
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
        assetTypeId: assetType.id,
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
  subjectType: FileAssetSubject,
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
