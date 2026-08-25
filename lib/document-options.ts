/**
 * What the upload surfaces and the API need to agree on about *files* — which
 * bytes are acceptable and how big they may be.
 *
 * The document **taxonomy** used to live here too: labels, groupings, which
 * types allow several. That is `FileAssetType` rows now (see
 * `lib/asset-types.ts`), so what is left is the part that is genuinely fixed —
 * a client-safe constants module, like `lib/property-options.ts`.
 */

type FileTypeTable = Record<string, { extension: string; label: string }>;

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
export const ACCEPTED_FILE_TYPES: FileTypeTable = {
  "application/pdf": { extension: ".pdf", label: "PDF" },
  "image/jpeg": { extension: ".jpg", label: "JPEG" },
  "image/png": { extension: ".png", label: "PNG" },
  "image/webp": { extension: ".webp", label: "WebP" },
};

/** For a file input's `accept`. */
export function extensionsOf(table: FileTypeTable) {
  return Object.values(table)
    .map((type) => type.extension)
    .join(",");
}

/** "PDF, JPEG, PNG or WebP" — it ends up mid-sentence in an error message. */
export function labelOf(table: FileTypeTable) {
  const labels = Object.values(table).map((type) => type.label);
  const last = labels[labels.length - 1];
  return labels.length === 1 ? last : `${labels.slice(0, -1).join(", ")} or ${last}`;
}

export const IMAGE_FILE_TYPES: FileTypeTable = Object.fromEntries(
  Object.entries(ACCEPTED_FILE_TYPES).filter(([mime]) => mime.startsWith("image/"))
);

/**
 * What a type will accept. Keyed on the type's own `isPhoto` flag rather than
 * on a list of type names, which is what lets a *custom* photo type get the
 * narrow allowlist without anything here knowing it exists.
 *
 * A PDF filed as a photo would sit in a carousel that cannot draw it.
 */
export function acceptedTypesFor(isPhoto: boolean): FileTypeTable {
  return isPhoto ? IMAGE_FILE_TYPES : ACCEPTED_FILE_TYPES;
}

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

/**
 * One stored document as the client sees it. `createdAt` is a string, not a
 * Date: a server component hands these straight to a client one, and Dates do
 * not survive that boundary.
 *
 * `assetType` is denormalised into the row rather than being an id the client
 * has to look up — every surface that shows a document shows its label, and a
 * second lookup to render a badge is a lookup that will eventually be missing.
 */
export type DocumentView = {
  id: string;
  fileName: string;
  fileType: string;
  sizeBytes: number;
  assetType: { id: string; label: string; isPhoto: boolean };
  /** ISO string. */
  createdAt: string;
  uploadedByName: string | null;
};
