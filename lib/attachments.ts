import { findSlot } from "@/lib/attachment-slots";
import {
  kindForContentType,
  MAX_ATTACHMENT_BYTES,
  type AttachmentOwnerType,
  type AttachmentView,
} from "@/lib/attachment-types";
import { prisma } from "@/lib/prisma";
import {
  buildStorageKey,
  deleteObject,
  headObject,
  keyBelongsToOrg,
  presignDownload,
  presignUpload,
} from "@/lib/storage";

export { MAX_ATTACHMENT_BYTES };

type Owner = { ownerType: AttachmentOwnerType; ownerId: string };

/** How a file is labelled: a named slot from its owner type's list, a title of
 * its own, or both. The schema guarantees at least one is present. */
type Label = { slotKey?: string | null; title?: string | null };

/** The row shape every read path returns, so the four call sites can't select
 * different columns and drift. */
const attachmentSelect = {
  id: true,
  fileName: true,
  contentType: true,
  sizeBytes: true,
  kind: true,
  slotKey: true,
  title: true,
  createdAt: true,
  uploadedBy: { include: { user: { select: { name: true } } } },
} as const;

type AttachmentRow = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: AttachmentView["kind"];
  slotKey: string | null;
  title: string | null;
  createdAt: Date;
  uploadedBy: { user: { name: string | null } } | null;
};

function toView(row: AttachmentRow): AttachmentView {
  return {
    id: row.id,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    kind: row.kind,
    slotKey: row.slotKey,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    uploadedByName: row.uploadedBy?.user.name ?? null,
  };
}

/**
 * Confirms the thing being attached to exists *and* belongs to this
 * organization, scoped exactly the way `getLease` and `orgInvoiceFilter`
 * already scope theirs — through every relation, not just the nearest one, so
 * the known gap where a Lease can join a membership in one org to a unit in
 * another can't be used to park files on someone else's record.
 *
 * Returns false rather than throwing: to a caller who shouldn't see the row,
 * "not yours" and "doesn't exist" must be the same 404.
 */
async function ownerExistsInOrg(
  organizationId: string,
  { ownerType, ownerId }: Owner
): Promise<boolean> {
  const found = await (() => {
    switch (ownerType) {
      case "property":
        return prisma.property.findFirst({
          where: { id: ownerId, organizationId },
          select: { id: true },
        });
      case "unit":
        return prisma.unit.findFirst({
          where: { id: ownerId, property: { organizationId } },
          select: { id: true },
        });
      case "lease":
        return prisma.lease.findFirst({
          where: {
            id: ownerId,
            membership: { organizationId },
            unit: { property: { organizationId } },
          },
          select: { id: true },
        });
      case "membership":
        return prisma.membership.findFirst({
          where: { id: ownerId, organizationId },
          select: { id: true },
        });
      case "payment":
        return prisma.payment.findFirst({
          where: {
            id: ownerId,
            invoice: {
              lease: {
                membership: { organizationId },
                unit: { property: { organizationId } },
              },
            },
          },
          select: { id: true },
        });
    }
  })();

  return found !== null;
}

/** The single owner column, as Prisma expects it. The migration's CHECK
 * constraint enforces that exactly one is set; this is what sets it. */
function ownerColumn({ ownerType, ownerId }: Owner) {
  return { [`${ownerType}Id`]: ownerId } as Record<string, string>;
}

export type PresignResult =
  | { ok: true; url: string; key: string }
  | { ok: false; reason: "owner-not-found" | "unsupported-type" | "unknown-slot" };

/**
 * A slot key only means something in the context of its owner type — `nida`
 * belongs to a membership, `title-deed` to a property. Checked here rather than
 * in the zod schema because that is where both halves are in hand, and an
 * unrecognised key must be refused: stored, it would render as a document type
 * that doesn't exist and no slot would ever claim the file.
 */
function slotIsValid(ownerType: AttachmentOwnerType, label: Label) {
  return !label.slotKey || findSlot(ownerType, label.slotKey) !== null;
}

/**
 * Issues a URL the browser can upload to. Nothing is written to the database
 * here — the row is created afterwards, by `registerAttachment`, once the
 * bytes exist. The other order (write a pending row, then upload) leaves a row
 * describing a file that may never arrive, and every read path then has to
 * filter those out.
 *
 * The trade-off it accepts: an upload that succeeds while the browser dies
 * before registering leaves an object with no row. That is a stray object in a
 * prefix that can be listed, not a broken record in the UI — the cheaper of
 * the two failures.
 */
export async function presignAttachmentUpload(
  organizationId: string,
  input: Owner & Label & { fileName: string; contentType: string }
): Promise<PresignResult> {
  if (!kindForContentType(input.contentType)) {
    return { ok: false, reason: "unsupported-type" };
  }
  if (!slotIsValid(input.ownerType, input)) {
    return { ok: false, reason: "unknown-slot" };
  }
  if (!(await ownerExistsInOrg(organizationId, input))) {
    return { ok: false, reason: "owner-not-found" };
  }

  const key = buildStorageKey({
    organizationId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    fileName: input.fileName,
  });

  return { ok: true, key, url: await presignUpload(key, input.contentType) };
}

export type RegisterResult =
  | { ok: true; attachment: AttachmentView }
  | {
      ok: false;
      reason:
        | "owner-not-found"
        | "not-uploaded"
        | "too-large"
        | "unsupported-type"
        | "unknown-slot";
    };

/**
 * Records an upload that has landed. The size and content type are read back
 * off the object rather than taken from the request: everything the client
 * said before the upload was a claim, and this is the first point where the
 * truth is available.
 *
 * `uploadedById` is the caller's *membership*, not their user, so an upload is
 * attributed within the org it happened in.
 */
export async function registerAttachment(
  organizationId: string,
  userId: string,
  input: Owner & Label & { key: string; fileName: string }
): Promise<RegisterResult> {
  // A key the caller made up can only ever name an object under their own org,
  // and to have one there they must have used a URL this server issued.
  if (!keyBelongsToOrg(input.key, organizationId)) {
    return { ok: false, reason: "not-uploaded" };
  }
  if (!slotIsValid(input.ownerType, input)) {
    return { ok: false, reason: "unknown-slot" };
  }
  if (!(await ownerExistsInOrg(organizationId, input))) {
    return { ok: false, reason: "owner-not-found" };
  }

  const object = await headObject(input.key);
  if (!object) return { ok: false, reason: "not-uploaded" };

  // The cap can only be enforced here — a presigned PUT can't carry a byte
  // limit the browser will honour. An object that busts it doesn't get to
  // stay in the bucket just because it arrived.
  if (object.sizeBytes > MAX_ATTACHMENT_BYTES) {
    await deleteObject(input.key);
    return { ok: false, reason: "too-large" };
  }

  const kind = kindForContentType(object.contentType);
  if (!kind) {
    await deleteObject(input.key);
    return { ok: false, reason: "unsupported-type" };
  }

  const membership = await prisma.membership.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });

  const created = await prisma.attachment.create({
    data: {
      key: input.key,
      fileName: input.fileName,
      contentType: object.contentType,
      sizeBytes: object.sizeBytes,
      kind,
      slotKey: input.slotKey ?? null,
      title: input.title ?? null,
      organizationId,
      uploadedById: membership?.id ?? null,
      ...ownerColumn(input),
    },
    select: attachmentSelect,
  });

  return { ok: true, attachment: toView(created) };
}

/** Everything attached to one record, newest first. Org-scoped on the column
 * as well as the owner, so a stale id from another org returns nothing. */
export async function getAttachments(
  organizationId: string,
  owner: Owner
): Promise<AttachmentView[]> {
  const rows = await prisma.attachment.findMany({
    where: { organizationId, ...ownerColumn(owner) },
    orderBy: { createdAt: "desc" },
    select: attachmentSelect,
  });

  return rows.map(toView);
}

/**
 * A short-lived URL for one attachment, or null if it isn't this org's. The
 * bucket stays private: this is the only way bytes come out of it, and every
 * link expires within minutes of being handed over.
 */
export async function getAttachmentUrl(
  organizationId: string,
  attachmentId: string,
  download: boolean
) {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, organizationId },
    select: { key: true, fileName: true },
  });
  if (!attachment) return null;

  return presignDownload(attachment.key, {
    fileName: attachment.fileName,
    download,
  });
}

/**
 * Removes the row and the object. The row goes first: if the delete of the
 * object fails, the file is already unreachable through the app and what
 * remains is a stray object, whereas the other order can leave a row pointing
 * at bytes that are gone — which is the failure a user actually sees.
 */
export async function deleteAttachment(
  organizationId: string,
  attachmentId: string
): Promise<{ ownerType: AttachmentOwnerType } | null> {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, organizationId },
    select: {
      id: true,
      key: true,
      propertyId: true,
      unitId: true,
      leaseId: true,
      membershipId: true,
      paymentId: true,
    },
  });
  if (!attachment) return null;

  await prisma.attachment.delete({ where: { id: attachment.id } });
  await deleteObject(attachment.key);

  // Reported back so the route knows which pages to revalidate — the caller
  // only ever had an attachment id.
  return { ownerType: ownerTypeOf(attachment) };
}

/** Reads the owner back off the row. Exactly one column is set, guaranteed by
 * the migration's CHECK constraint, so the first match is the answer. */
function ownerTypeOf(row: {
  propertyId: string | null;
  unitId: string | null;
  leaseId: string | null;
  membershipId: string | null;
  paymentId: string | null;
}): AttachmentOwnerType {
  if (row.propertyId) return "property";
  if (row.unitId) return "unit";
  if (row.leaseId) return "lease";
  if (row.membershipId) return "membership";
  return "payment";
}

/**
 * Which list pages show a record's files, so an upload or delete refreshes the
 * right ones. A membership hits both `/tenants` and `/users` because the member
 * detail page is reached from either.
 */
export const OWNER_REVALIDATE_PATHS: Record<AttachmentOwnerType, string[]> = {
  lease: ["/leases"],
  property: ["/properties"],
  unit: ["/properties"],
  membership: ["/tenants", "/users"],
  payment: ["/payments"],
};
