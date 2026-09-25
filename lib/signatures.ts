import { buildObjectKey, isObjectKeyInOrganization } from "@/lib/documents";
import { prisma } from "@/lib/prisma";
import { deleteObject, getObjectStream, putObject } from "@/lib/storage";

/**
 * A member's drawn signature: a PNG in `STORAGE_BUCKET`, located by
 * `MemberProfile.signatureKey`.
 *
 * Deliberately not a `FileAsset`. There is exactly one per member, it is part
 * of who the member is rather than a document filed against them, and — unlike
 * every document — **only the member themself may set or remove it**. The
 * route checks that; everything here assumes it has been checked.
 *
 * Writes follow the documents rule: write the object, then the row, then
 * delete what the row used to point at. A crash between steps leaves an
 * invisible orphan in the bucket, never a row pointing at nothing.
 */

/** A drawn, trimmed signature is a few KB; this only stops abuse. */
export const SIGNATURE_MAX_BYTES = 512 * 1024;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Checked on the bytes, not the reported type: whatever is stored here is
 * later inlined into contracts as `data:image/png`, so it has to actually be
 * one.
 */
export function isPng(bytes: Uint8Array) {
  return PNG_MAGIC.every((byte, index) => bytes[index] === byte);
}

/** The membership, only if it is in this organization. */
export async function findSignatureSubject(
  organizationId: string,
  membershipId: string
) {
  return prisma.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { id: true, userId: true, profile: { select: { signatureKey: true } } },
  });
}

export async function saveSignature(
  organizationId: string,
  membershipId: string,
  bytes: Uint8Array
) {
  const previous = await prisma.memberProfile.findUnique({
    where: { membershipId },
    select: { signatureKey: true },
  });

  const objectKey = buildObjectKey({
    organizationId,
    subjectType: "MEMBERSHIP",
    subjectId: membershipId,
    extension: ".png",
  });
  await putObject(objectKey, bytes, "image/png");

  try {
    await prisma.memberProfile.upsert({
      where: { membershipId },
      create: { membershipId, signatureKey: objectKey },
      update: { signatureKey: objectKey },
    });
  } catch (cause) {
    // The row never pointed at it, so nothing can reference it.
    await deleteObject(objectKey).catch(() => {});
    throw cause;
  }

  if (previous?.signatureKey) await discard(previous.signatureKey);
  return objectKey;
}

export async function removeSignature(membershipId: string) {
  const profile = await prisma.memberProfile.findUnique({
    where: { membershipId },
    select: { signatureKey: true },
  });
  if (!profile?.signatureKey) return;

  await prisma.memberProfile.update({
    where: { membershipId },
    data: { signatureKey: null },
  });
  await discard(profile.signatureKey);
}

/** The old object is already unreferenced; failing to delete it is logged, not fatal. */
async function discard(objectKey: string) {
  try {
    await deleteObject(objectKey);
  } catch (cause) {
    console.error(`[signature] could not delete ${objectKey}`, cause);
  }
}

/**
 * The stored bytes, refusing any key outside the organization's prefix — the
 * column is only ever written by `saveSignature`, but a key is a path, and a
 * read should not trust one blindly.
 */
export async function readSignature(organizationId: string, objectKey: string) {
  if (!isObjectKeyInOrganization(objectKey, organizationId)) return null;
  return getObjectStream(objectKey);
}

/**
 * The signature as a `data:image/png;base64,…` URI, for contracts: the PDF
 * worker refuses every remote URL and the preview iframe has no cookies, so an
 * inlined image is the only form that renders everywhere.
 *
 * Null rather than a thrown error when storage is down or the object is gone:
 * a contract with a blank signing line is still a contract.
 */
export async function signatureDataUri(
  organizationId: string,
  objectKey: string | null | undefined
) {
  if (!objectKey) return null;
  try {
    const stream = await readSignature(organizationId, objectKey);
    if (!stream) return null;
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    if (!isPng(bytes)) return null;
    return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  } catch (cause) {
    console.error(`[signature] could not read ${objectKey}`, cause);
    return null;
  }
}
