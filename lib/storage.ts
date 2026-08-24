import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Object storage, spoken as S3. Locally that is the MinIO in
 * `docker-compose.yml`; in production it is Cloudflare R2. Nothing below is
 * provider-specific — the four `STORAGE_*` variables are the entire
 * difference, which is the point: the upload path is exercised for real in
 * development rather than being tried for the first time after a deploy.
 *
 * The bucket is private and stays private. Nothing here hands a URL to a
 * browser; reads are streamed back through `GET /api/documents/[id]`, which
 * has already checked that the caller's organization owns the row. A presigned
 * URL would be cheaper on the server and is the obvious next step for large
 * files, but it is also a bearer token in a query string — worth doing
 * deliberately, not by default.
 */

function config() {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

  // Named individually rather than as one "storage is not configured": on a
  // fresh deploy the cause is almost always a single mistyped variable, and
  // the message is the only thing anyone will have to go on.
  const missing = Object.entries({
    STORAGE_ENDPOINT: endpoint,
    STORAGE_BUCKET: bucket,
    STORAGE_ACCESS_KEY_ID: accessKeyId,
    STORAGE_SECRET_ACCESS_KEY: secretAccessKey,
  })
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new StorageNotConfiguredError(missing);
  }

  return {
    endpoint: endpoint as string,
    bucket: bucket as string,
    accessKeyId: accessKeyId as string,
    secretAccessKey: secretAccessKey as string,
  };
}

/**
 * Thrown rather than returned: a missing variable is an operator mistake, not
 * something a caller can handle. The routes turn it into a 503, since the
 * request would succeed unchanged once the deploy is fixed.
 */
export class StorageNotConfiguredError extends Error {
  constructor(readonly missing: string[]) {
    super(`File storage is not configured: ${missing.join(", ")}`);
    this.name = "StorageNotConfiguredError";
  }
}

/**
 * One client per process, for the same reason `lib/prisma.ts` keeps one
 * PrismaClient: each `new S3Client()` builds its own connection pool, and a
 * hot reload would otherwise leave a trail of them behind.
 */
const globalForStorage = globalThis as unknown as { s3?: S3Client };

function client() {
  if (globalForStorage.s3) return globalForStorage.s3;

  const { endpoint, accessKeyId, secretAccessKey } = config();
  const s3 = new S3Client({
    endpoint,
    // R2 ignores the region and MinIO has none, but the SDK refuses to build a
    // request without one. "auto" is what Cloudflare's own documentation uses.
    region: "auto",
    // MinIO serves buckets as a path (`localhost:9000/jarvis-files/key`), not
    // as a subdomain — virtual-host style would resolve to a hostname that
    // does not exist locally.
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  globalForStorage.s3 = s3;
  return s3;
}

export async function putObject(
  objectKey: string,
  body: Uint8Array,
  contentType: string
) {
  const { bucket } = config();
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentType: contentType,
    })
  );
}

/**
 * The object's bytes as a web stream, for piping straight into a `Response`.
 * Returns null when the key is not in the bucket — which should not happen,
 * but does whenever a row outlives its object, and a 404 reads better than a
 * 500 for a file someone deleted out from under the app.
 */
export async function getObjectStream(objectKey: string) {
  const { bucket } = config();
  try {
    const result = await client().send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey })
    );
    return (result.Body?.transformToWebStream() ?? null) as ReadableStream | null;
  } catch (cause) {
    if (
      cause instanceof Error &&
      (cause.name === "NoSuchKey" || cause.name === "NotFound")
    ) {
      return null;
    }
    throw cause;
  }
}

/**
 * Deleting a key that isn't there is a success in S3, which is what makes this
 * safe to call after the row has already gone.
 */
export async function deleteObject(objectKey: string) {
  const { bucket } = config();
  await client().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })
  );
}
