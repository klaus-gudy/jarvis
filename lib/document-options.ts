import type { FileAssetType } from "@/lib/generated/prisma/enums";

/**
 * Everything both the upload form and the API need to agree on: which subject
 * a document may hang off, what it may be called, what may be in it, and how
 * big it may be. A plain constants module like `lib/property-options.ts`, so a
 * client component can import it without dragging the server in.
 */

/**
 * The entity a document is *about*. Mirrors the six nullable subject columns
 * on `FileAsset`, plus the case where there is no subject at all and the file
 * belongs to the organization itself.
 */
export const DOCUMENT_SUBJECTS = [
  "organization",
  "property",
  "unit",
  "membership",
  "lease",
  "invoice",
  "payment",
] as const;

export type DocumentSubject = (typeof DOCUMENT_SUBJECTS)[number];

/**
 * Which subject each type may be filed under. This is the pairing rule the
 * database deliberately does not enforce — a CHECK would have to be rewritten
 * for every value added to the enum, so it lives here, where adding a type
 * means adding one line and the compiler insists on it.
 *
 * Without it a `TITLE_DEED` could hang off an invoice and a `NIDA` off a
 * property: legal rows, unreadable UI.
 */
export const SUBJECT_FOR_ASSET_TYPE: Record<FileAssetType, DocumentSubject> = {
  BUSINESS_DOCUMENT: "organization",

  TITLE_DEED: "property",
  PROPERTY_PERMIT: "property",
  PROPERTY_PHOTO: "property",

  UNIT_DOCUMENT: "unit",
  UNIT_PHOTO: "unit",

  NIDA: "membership",
  PASSPORT: "membership",
  EMPLOYMENT_DOCUMENT: "membership",
  TENANT_DOCUMENT: "membership",

  LEASE_AGREEMENT: "lease",
  LEASE_AMENDMENT: "lease",
  LEASE_RENEWAL: "lease",
  LEASE_TERMINATION: "lease",

  INVOICE_DOCUMENT: "invoice",
  PAYMENT_RECEIPT: "payment",
  PAYMENT_PROOF: "payment",

  /**
   * The one type with no fixed home — it is the "none of the above" for any
   * subject, which is exactly why every other type is pinned.
   */
  OTHER: "organization",
};

/** Human labels, for the type dropdown and the document list. */
export const ASSET_TYPE_LABELS: Record<FileAssetType, string> = {
  BUSINESS_DOCUMENT: "Business document",

  TITLE_DEED: "Title deed",
  PROPERTY_PERMIT: "Permit",
  PROPERTY_PHOTO: "Photo",

  UNIT_DOCUMENT: "Unit document",
  UNIT_PHOTO: "Photo",

  NIDA: "NIDA",
  PASSPORT: "Passport",
  EMPLOYMENT_DOCUMENT: "Employment document",
  TENANT_DOCUMENT: "Other tenant document",

  LEASE_AGREEMENT: "Signed agreement",
  LEASE_AMENDMENT: "Amendment",
  LEASE_RENEWAL: "Renewal",
  LEASE_TERMINATION: "Termination notice",

  INVOICE_DOCUMENT: "Invoice",
  PAYMENT_RECEIPT: "Receipt",
  PAYMENT_PROOF: "Proof of payment",

  OTHER: "Other",
};

/**
 * The types a given subject's page offers, in enum order. Derived from the
 * pairing map rather than listed a second time, so a new type appears in the
 * right dropdown by existing — which is the whole point of the map being
 * `Record<FileAssetType, …>` and not a partial lookup.
 */
export function assetTypesFor(subject: DocumentSubject) {
  return (Object.keys(SUBJECT_FOR_ASSET_TYPE) as FileAssetType[]).filter(
    (type) => SUBJECT_FOR_ASSET_TYPE[type] === subject
  );
}

/**
 * One stored document as the client sees it. `createdAt` is a string, not a
 * Date: a server component hands these straight to a client one, and Dates do
 * not survive that boundary.
 */
export type DocumentView = {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  assetType: FileAssetType;
  /** ISO string. */
  createdAt: string;
  uploadedByName: string | null;
};

export const TENANT_ASSET_TYPES = assetTypesFor("membership");
export const PROPERTY_ASSET_TYPES = assetTypesFor("property");
export const UNIT_ASSET_TYPES = assetTypesFor("unit");

/**
 * Types that are legitimately a collection rather than a single document —
 * a property has many photos, a lease picks up amendments over its life. Every
 * other type is a canonical "the" document for its subject: *the* NIDA, *the*
 * signed agreement, *the* invoice. `createDocument` refuses a second upload of
 * a non-collection type for the same subject rather than silently
 * accumulating NIDA cards nobody asked for; uploading a replacement means
 * deleting the old one first, which keeps "the current NIDA on file"
 * unambiguous without a separate archiving concept.
 *
 * `OTHER` and `TENANT_DOCUMENT` are here for the same reason — both are the
 * declared catch-all for a subject that doesn't fit the named types, and a
 * catch-all that only holds one file isn't one.
 */
const MULTIPLE_ALLOWED: ReadonlySet<FileAssetType> = new Set([
  "BUSINESS_DOCUMENT",
  "PROPERTY_PERMIT",
  "PROPERTY_PHOTO",
  "UNIT_DOCUMENT",
  "UNIT_PHOTO",
  "TENANT_DOCUMENT",
  "LEASE_AMENDMENT",
  "LEASE_RENEWAL",
  "OTHER",
]);

export function allowsMultiple(assetType: FileAssetType) {
  return MULTIPLE_ALLOWED.has(assetType);
}

/**
 * An **allowlist**, not a blocklist, and matched on the MIME type rather than
 * the file extension. Both matter: `image/svg+xml` and `text/html` are images
 * and documents in the everyday sense but are scripts as far as a browser is
 * concerned, and a file served back from this app's own origin runs on this
 * app's own origin. Anything not listed here is refused rather than stored and
 * worried about later.
 *
 * The extension is taken from this table too, never from the uploaded name —
 * a file name is whatever the client felt like sending.
 */
export const ACCEPTED_FILE_TYPES: Record<string, { extension: string; label: string }> = {
  "application/pdf": { extension: ".pdf", label: "PDF" },
  "image/jpeg": { extension: ".jpg", label: "JPEG" },
  "image/png": { extension: ".png", label: "PNG" },
  "image/webp": { extension: ".webp", label: "WebP" },
};

type FileTypeTable = Record<string, { extension: string; label: string }>;

/** For a file input's `accept`. */
function extensionsOf(table: FileTypeTable) {
  return Object.values(table)
    .map((type) => type.extension)
    .join(",");
}

/** "PDF, JPEG, PNG or WebP" — it ends up mid-sentence in an error message. */
function labelOf(table: FileTypeTable) {
  const labels = Object.values(table).map((type) => type.label);
  const last = labels[labels.length - 1];
  return labels.length === 1 ? last : `${labels.slice(0, -1).join(", ")} or ${last}`;
}

/**
 * A photo is an image, and only an image. A PDF filed as `PROPERTY_PHOTO`
 * would sit in a carousel that cannot render it — so the narrower table is
 * enforced per type rather than left to the person choosing correctly.
 */
const PHOTO_ASSET_TYPES: ReadonlySet<FileAssetType> = new Set([
  "PROPERTY_PHOTO",
  "UNIT_PHOTO",
]);

export function isPhotoType(assetType: FileAssetType) {
  return PHOTO_ASSET_TYPES.has(assetType);
}

export const IMAGE_FILE_TYPES: FileTypeTable = Object.fromEntries(
  Object.entries(ACCEPTED_FILE_TYPES).filter(([mime]) => mime.startsWith("image/"))
);

/**
 * What this particular type will accept. The upload dialogs use it for their
 * `accept` attribute and their hint; `POST /api/documents` uses it as the
 * check that actually counts.
 */
export function acceptedTypesFor(assetType: FileAssetType): FileTypeTable {
  return isPhotoType(assetType) ? IMAGE_FILE_TYPES : ACCEPTED_FILE_TYPES;
}

/**
 * The non-photo types for a subject. Photos have their own surface — a
 * carousel and a multi-file picker — so offering them in the documents table's
 * type dropdown would mean two routes to the same place, one of which drops
 * the file somewhere the person wasn't looking.
 */
export function documentTypesFor(subject: DocumentSubject) {
  return assetTypesFor(subject).filter((type) => !isPhotoType(type));
}

export const PROPERTY_DOCUMENT_TYPES = documentTypesFor("property");
export const UNIT_DOCUMENT_TYPES = documentTypesFor("unit");

/** The same sentence fragment as the constants below, for a table chosen at runtime. */
export const labelForAcceptedTypes = labelOf;

export const ACCEPTED_FILE_EXTENSIONS = extensionsOf(ACCEPTED_FILE_TYPES);
export const ACCEPTED_FILE_LABEL = labelOf(ACCEPTED_FILE_TYPES);
export const IMAGE_FILE_EXTENSIONS = extensionsOf(IMAGE_FILE_TYPES);
export const IMAGE_FILE_LABEL = labelOf(IMAGE_FILE_TYPES);

/**
 * 10 MB. A phone photograph of a NIDA card is one or two; a scanned lease is a
 * few. Past this it is a video, and the route buffers the whole body in memory
 * before forwarding it — the ceiling is as much about this process as about
 * the bucket.
 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * "2.4 MB" — sizes are read at a glance, so one decimal is plenty, and the
 * decimal is dropped when it adds nothing: the limit reads "10 MB", not
 * "10.0 MB". Same reasoning as `formatMoney` in `lib/format.ts`.
 */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes % 1 === 0 ? megabytes : megabytes.toFixed(1)} MB`;
}
