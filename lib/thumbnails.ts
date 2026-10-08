import sharp from "sharp";

import { THUMBNAIL_WIDTHS, type ThumbnailWidth } from "@/lib/document-options";
import { deleteObject, getObjectBytes, getObjectStream, putObject } from "@/lib/storage";

/**
 * Resized copies of stored images, so an avatar or a strip of tiles stops
 * downloading full-size phone photos.
 *
 * Made on first request and kept in the bucket beside the original
 * (`<objectKey>.w<width>.webp`, so it shares the organization prefix). An
 * object key is never reused — every upload gets a fresh uuid — so a stored
 * thumbnail can never go stale, and photos uploaded before this existed need
 * no backfill: they get theirs the first time someone looks.
 */

export function thumbnailKey(objectKey: string, width: ThumbnailWidth) {
  return `${objectKey}.w${width}.webp`;
}

/** A stored thumbnail, or a freshly made (and stored) one; null if the original is gone. */
export async function getThumbnail(
  objectKey: string,
  width: ThumbnailWidth
): Promise<ReadableStream | Uint8Array | null> {
  const key = thumbnailKey(objectKey, width);
  const cached = await getObjectStream(key);
  if (cached) return cached;

  const original = await getObjectBytes(objectKey);
  if (!original) return null;

  const resized = await sharp(original)
    .rotate() // honour EXIF orientation before it is stripped
    .resize({ width, height: width, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  const bytes = new Uint8Array(resized);

  // Best effort: a failed write only means the next request resizes again.
  await putObject(key, bytes, "image/webp").catch((cause) =>
    console.error(`thumbnail ${key} not stored`, cause)
  );
  return bytes;
}

/** Removes every size; called with the original's delete. Missing keys are fine. */
export async function deleteThumbnails(objectKey: string) {
  await Promise.all(
    THUMBNAIL_WIDTHS.map((width) => deleteObject(thumbnailKey(objectKey, width)))
  );
}
