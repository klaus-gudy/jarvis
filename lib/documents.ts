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
 * Is this key one of *this* organization's?
 *
 * The counterpart to `buildObjectKey`, for the one case where a key is not
 * built here but arrives from somewhere else — `document.rendered` carries the
 * key `document-worker` just wrote a PDF to, and a message bus is not a place a
 * prefix can be taken on trust. A key naming another tenancy's folder, or
 * climbing out of one with `..`, is refused rather than recorded.
 */
export function isObjectKeyInOrganization(
  objectKey: string,
  organizationId: string
) {
  return (
    objectKey.startsWith(`organizations/${organizationId}/`) &&
    !objectKey.split("/").includes("..")
  );
}

/**
 * Reads a lease-contract key back into the ids that built it.
 *
 * The exact inverse of `buildObjectKey` for `subjectType: "LEASE"`, and the
 * only reason `document.stored` needs no domain ids on it: the key already
 * carries them, because this app chose it. `organizations/<orgId>/leases/
 * <leaseId>/<uuid>.pdf`.
 *
 * Returns null for anything that is not that shape — a key for a different
 * subject, a malformed one, or one from a producer that does not share this
 * convention. **Parsing is not authorisation:** the ids that come out are
 * claims from a message, and the caller still has to check the lease really
 * belongs to the organization, which `recordDocument` does.
 */
export function parseContractObjectKey(objectKey: string) {
  const parts = objectKey.split("/");

  if (
    parts.length !== 5 ||
    parts[0] !== "organizations" ||
    parts[2] !== KEY_SEGMENT.LEASE ||
    !parts[1] ||
    !parts[3] ||
    !parts[4].endsWith(".pdf") ||
    parts.includes("..")
  ) {
    return null;
  }

  return { organizationId: parts[1], leaseId: parts[3] };
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
  /**
   * Who is filing this. **Null for a document the system generated** — the
   * contract worker is not a person, and inventing a membership for it would
   * put a lie in `uploadedById` that every "uploaded by" line then repeats.
   * The column is already nullable for the same reason.
   */
  userId: string | null,
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
  // Keyed on `allowsMultiple` alone now — an earlier version of this also
  // exempted every `isPhoto` type outright, on the assumption that a photo is
  // always a gallery. `PROFILE_PHOTO` broke that assumption: it is a photo and
  // it is deliberately singular, replaced rather than accumulated. The column
  // already said the right thing for every type that existed — property and
  // unit photos seeded `allowsMultiple: true`, profile photo seeded `false` —
  // so trusting it is both the fix and the simplification.
  if (!assetType.allowsMultiple) {
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
  const uploader = userId
    ? await prisma.membership.findUnique({
        where: { userId_organizationId: { userId, organizationId } },
        select: { id: true },
      })
    : null;

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
 * Records a `FileAsset` for an object **that is already in the bucket**.
 *
 * The counterpart to `createDocument` for the one path where this app does not
 * hold the bytes: `document-worker` renders a contract and uploads it, then
 * says so on `document.rendered`, and this writes the row for what it wrote.
 * Everything that makes `createDocument` the single door is repeated here —
 * the type is resolved against this organization, the subject is checked to
 * belong to it, and the duplicate rule still applies — because the door does
 * not stop being the door because someone else carried the parcel.
 *
 * **The key is re-validated rather than trusted.** It arrived over a message
 * bus, which makes it data, not an instruction to file wherever it says.
 *
 * **Idempotent on `objectKey`**, which is not optional: the worker acks only
 * after its upload succeeds, so a redelivery can announce the same render
 * twice, and `FileAsset.objectKey` is `@unique`. A second arrival returns the
 * row the first one wrote instead of crashing the consumer.
 */
export async function recordDocument(
  organizationId: string,
  input: UploadDocumentInput,
  file: {
    objectKey: string;
    name: string;
    type: string;
    sizeBytes: number;
  }
) {
  if (!isObjectKeyInOrganization(file.objectKey, organizationId)) {
    return { error: "object-key-foreign" as const };
  }

  const assetType = await resolveAssetType(organizationId, input.assetTypeId);
  if (!assetType) return { error: "asset-type-not-found" as const };

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

  // The redelivery case, checked before the duplicate rule: the same object
  // arriving twice is this row again, not a second contract competing with it.
  const already = await prisma.fileAsset.findUnique({
    where: { objectKey: file.objectKey },
    select: ROW_SELECT,
  });
  if (already) return { document: toRow(already), duplicate: true as const };

  if (!assetType.allowsMultiple) {
    const existing = await findExisting(
      organizationId,
      input.subjectType,
      input.subjectId,
      assetType.id
    );
    if (existing) {
      return { error: "duplicate-asset-type" as const, existing, assetType };
    }
  }

  const created = await prisma.fileAsset.create({
    data: {
      objectKey: file.objectKey,
      fileName: file.name,
      fileType: file.type,
      sizeBytes: file.sizeBytes,
      assetTypeId: assetType.id,
      organizationId,
      // Null, always: nothing that reaches this function was filed by a person.
      uploadedById: null,
      ...(input.subjectId
        ? { [SUBJECT_COLUMN[input.subjectType as keyof typeof SUBJECT_COLUMN]]: input.subjectId }
        : {}),
    },
    select: ROW_SELECT,
  });

  return { document: toRow(created), duplicate: false as const };
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
 * Profile photo id, per membership — one query for a whole table or list
 * rather than one per row. Every caller that renders more than a single
 * member (the Tenants and Users tables, the dashboard panels, the sidebar's
 * own row) goes through this rather than `listDocuments` per row, which would
 * turn a page load into N+1 queries.
 *
 * Returns a `Map` rather than an array so a caller can look up by id without
 * building its own index; a membership with no photo simply has no entry.
 */
export async function getProfilePhotoIds(
  organizationId: string,
  membershipIds: string[]
): Promise<Map<string, string>> {
  if (membershipIds.length === 0) return new Map();

  const rows = await prisma.fileAsset.findMany({
    where: {
      organizationId,
      membershipId: { in: membershipIds },
      assetType: { key: "PROFILE_PHOTO" },
    },
    select: { id: true, membershipId: true },
  });

  return new Map(rows.map((row) => [row.membershipId as string, row.id]));
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
