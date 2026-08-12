import { randomUUID } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { AttachmentOwnerType } from "@/lib/attachment-types";

/**
 * Object storage, spoken as S3. Locally that is MinIO from `docker-compose.yml`;
 * in production it is Cloudflare R2. Nothing below is provider-specific — the
 * four STORAGE_* variables are the whole difference, which is the point: the
 * upload path is exercised for real in dev rather than only being tried after
 * a deploy.
 *
 * Bytes never pass through this server. The browser is handed a short-lived
 * presigned URL and talks to the bucket directly, so a 10 MB upload doesn't
 * occupy a Next.js route handler (or hit Railway's request size limits) for its
 * duration. The server's job is deciding *whether* a URL should be issued.
 */

function config() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

  // Named individually rather than as one "storage is not configured": on a
  // fresh deploy the missing one is usually a single typo'd variable.
  const missing = Object.entries({
    STORAGE_ENDPOINT: endpoint,
    STORAGE_BUCKET: bucket,
    STORAGE_ACCESS_KEY_ID: accessKeyId,
    STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`File storage is not configured: ${missing.join(", ")}`);
  }

  return {
    endpoint: endpoint!,
    bucket: bucket!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
  };
}

const createClient = () => {
  const { endpoint, accessKeyId, secretAccessKey } = config();
  return new S3Client({
    endpoint,
    // R2 ignores the region but the SDK insists on one; "auto" is what
    // Cloudflare's own docs use, and MinIO accepts anything.
    region: process.env.STORAGE_REGION ?? "auto",
    // Bucket in the path, not the hostname. Required for MinIO on localhost,
    // which has no wildcard DNS to resolve `bucket.localhost`, and supported
    // by R2 — so one setting serves both.
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
};

// Same reason as the Prisma singleton: a new client per hot reload leaks
// sockets until the dev server is restarted.
const globalForStorage = globalThis as unknown as { storage?: S3Client };

const client = globalForStorage.storage ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForStorage.storage = client;
}

/** Presigned URLs are used within seconds of being issued. Five minutes covers
 * a slow phone on a bad connection without leaving a usable link lying around. */
const URL_TTL_SECONDS = 5 * 60;

/**
 * Keeps only what is safe from the uploaded name: a short, lowercase, ASCII
 * extension. The rest of the filename is stored in the database column, never
 * in the key — a key built from user input is how you get `../` out of a
 * prefix, or an object that can't be addressed because of a stray `#`.
 */
function extensionFor(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  const raw = fileName.slice(dot + 1).toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9]/g, "");
  return cleaned.length > 0 && cleaned.length <= 8 ? `.${cleaned}` : "";
}

/**
 * `org/<orgId>/<ownerType>/<ownerId>/<random><ext>`.
 *
 * The organization prefix is what makes a tenant's files listable — and
 * purgeable — without touching another's, and it means a leaked key still
 * names the org it belongs to rather than being an opaque object anywhere in
 * the bucket. The random segment (not the filename) is the identity, so two
 * people uploading `lease.pdf` don't collide.
 */
export function buildStorageKey(input: {
  organizationId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  fileName: string;
}) {
  const { organizationId, ownerType, ownerId, fileName } = input;
  return `org/${organizationId}/${ownerType}/${ownerId}/${randomUUID()}${extensionFor(fileName)}`;
}

/** True when the key sits under this organization's prefix. The guard against
 * a client naming someone else's object at the registration step. */
export function keyBelongsToOrg(key: string, organizationId: string) {
  return key.startsWith(`org/${organizationId}/`);
}

/**
 * A URL the browser can PUT to. The content type is part of the signature, so
 * the request must send exactly this `Content-Type` — a client that lies about
 * the type on the way in produces a 403 from the bucket, not a mislabelled
 * object.
 */
export async function presignUpload(key: string, contentType: string) {
  const { bucket } = config();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: URL_TTL_SECONDS }
  );
}

/**
 * A URL the browser can GET. `download: true` forces a save dialog with the
 * original filename; otherwise the object renders inline, which is what makes
 * an image preview possible without the bucket being public.
 */
export async function presignDownload(
  key: string,
  options: { fileName: string; download: boolean }
) {
  const { bucket } = config();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: contentDisposition(
        options.fileName,
        options.download
      ),
    }),
    { expiresIn: URL_TTL_SECONDS }
  );
}

/**
 * Filenames here are Tanzanian tenants' documents, so non-ASCII is ordinary,
 * not an edge case. RFC 5987's `filename*` carries it; the plain `filename`
 * stays as an ASCII fallback with quotes and backslashes stripped so it can't
 * break out of the quoted string.
 */
function contentDisposition(fileName: string, download: boolean) {
  const type = download ? "attachment" : "inline";
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * What actually landed in the bucket. The size reported here is the one worth
 * trusting: the browser's `file.size` is a claim made before the upload, and a
 * presigned PUT can't be constrained to a byte count without signing
 * `Content-Length`, which browsers won't let a fetch set. So the cap is
 * enforced after the fact, against this — and an object that busts it is
 * deleted rather than recorded.
 */
export async function headObject(key: string) {
  const { bucket } = config();
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
    return {
      sizeBytes: head.ContentLength ?? 0,
      contentType: head.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function deleteObject(key: string) {
  const { bucket } = config();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** S3 reports a missing object as 404/NotFound/NoSuchKey depending on the verb
 * and the provider; all three mean the same thing here. */
function isNotFound(error: unknown) {
  const err = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    err?.$metadata?.httpStatusCode === 404 ||
    err?.name === "NotFound" ||
    err?.name === "NoSuchKey"
  );
}
