/**
 * Client-safe half of the attachments module: types, constants and pure
 * helpers only, no Prisma or AWS SDK import. The upload dialog needs the size
 * cap and the accepted-type list as *runtime* values, and importing them from
 * `lib/attachments.ts` would pull the driver into the browser bundle and fail
 * the build on `pg`'s `require('dns')` — same split, same reason, as
 * `lib/invoice-types.ts` and `lib/search-types.ts`.
 */

/** Mirrors the `AttachmentKind` enum in the schema. Restated rather than
 * imported so this module stays free of the generated client. */
export type AttachmentKind = "IMAGE" | "DOCUMENT";

/**
 * What an attachment can hang off. Every one is a real foreign key on
 * `Attachment`, and the migration's CHECK constraint allows exactly one to be
 * set — so this union is the whole vocabulary, not a convention.
 */
export const ATTACHMENT_OWNER_TYPES = [
  "property",
  "unit",
  "lease",
  "membership",
  "payment",
] as const;

export type AttachmentOwnerType = (typeof ATTACHMENT_OWNER_TYPES)[number];

/**
 * 10 MB. Large enough for a scanned lease or a phone photo, small enough that
 * a full free-tier bucket still holds ~1,000 of them. Enforced in the browser
 * (so the user hears about it before waiting for an upload), and again on the
 * server against the object's *real* size once it has landed — the browser
 * figure is a claim, not a fact.
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * A closed list, for the same reason `lib/payment-options.ts` is one: an open
 * set produces values nothing downstream can render. Every type here either
 * displays inline in the browser or downloads cleanly.
 *
 * Deliberately excluded: `image/heic`. iPhones produce it by default, but no
 * browser renders it in an `<img>`, so accepting it would mean storing files
 * whose preview is permanently broken. Converting on upload is the real fix.
 */
export const ACCEPTED_CONTENT_TYPES: Record<string, AttachmentKind> = {
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "application/pdf": "DOCUMENT",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "DOCUMENT",
  "text/plain": "DOCUMENT",
  "text/csv": "DOCUMENT",
};

/** The `accept` attribute for a file input, built from the same list the
 * server validates against so the two can't drift. */
export const ATTACHMENT_ACCEPT = Object.keys(ACCEPTED_CONTENT_TYPES).join(",");

/**
 * Extension fallback for the same list. Browsers report an empty `File.type`
 * for some drag-and-drop sources — the unit importer already documents hitting
 * this — and an empty type would otherwise be rejected as unsupported even
 * when the file is fine.
 */
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  csv: "text/csv",
};

/**
 * The content type to upload a file as. What the browser reported wins; the
 * extension only fills a gap. Whatever this returns is what gets signed *and*
 * what the PUT must send — the two are the same value by construction, because
 * a mismatch is a 403 from the bucket.
 */
export function resolveContentType(fileName: string, reported: string) {
  if (reported && reported.toLowerCase() in ACCEPTED_CONTENT_TYPES) {
    return reported.toLowerCase();
  }
  const extension = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
  return EXTENSION_CONTENT_TYPES[extension] ?? reported.toLowerCase();
}

/**
 * Returns the kind for a content type, or null if it isn't accepted. Null is
 * the rejection signal — callers must not fall back to DOCUMENT, or the closed
 * list stops being closed.
 */
export function kindForContentType(
  contentType: string
): AttachmentKind | null {
  return ACCEPTED_CONTENT_TYPES[contentType.toLowerCase()] ?? null;
}

/** "1.4 MB" — file sizes are read at a glance, so one decimal is plenty. */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** What the UI shows for an attachment row. Dates are ISO strings because
 * this crosses the server/client boundary. */
export type AttachmentView = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  /** The named document this file is, from the owner type's slot list. Null
   * for an ad-hoc upload, which carries a `title` instead. */
  slotKey: string | null;
  title: string | null;
  createdAt: string;
  uploadedByName: string | null;
};

/**
 * Whether the browser can show this inline. Images and PDFs render natively;
 * plain text and CSV are small enough to fetch and print. Word and Excel can
 * only be downloaded — no browser renders them, and pretending otherwise with
 * a viewer that silently fails is worse than saying so.
 */
export function previewModeFor(
  attachment: Pick<AttachmentView, "kind" | "contentType">
): "image" | "pdf" | "text" | "none" {
  if (attachment.kind === "IMAGE") return "image";
  if (attachment.contentType === "application/pdf") return "pdf";
  if (
    attachment.contentType === "text/plain" ||
    attachment.contentType === "text/csv"
  ) {
    return "text";
  }
  return "none";
}
