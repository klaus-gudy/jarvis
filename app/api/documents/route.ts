import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { resolveAssetType } from "@/lib/asset-types";
import {
  acceptedTypesFor,
  labelForAcceptedTypes,
  MAX_FILE_BYTES,
} from "@/lib/document-options";
import { createDocument, listDocuments } from "@/lib/documents";
import { uploadDocumentSchema } from "@/lib/documents-schemas";
import { FileAssetSubject } from "@/lib/generated/prisma/enums";
import { StorageNotConfiguredError } from "@/lib/storage";

/**
 * Upload and list, for every kind of subject — a document is the same object
 * whether it is a NIDA card or a signed lease, so one endpoint serves all of
 * them and `subjectType` says which. The tenant documents UI is simply its
 * first caller.
 *
 * The bytes pass through this handler on their way to the bucket. That costs a
 * route handler for the duration of the upload, which is why `MAX_FILE_BYTES`
 * is 10 MB — the alternative, handing the browser a presigned URL and letting
 * it talk to the bucket directly, is noted in `lib/storage.ts` and is the right
 * move when files get big enough to matter.
 */

/** Both handlers turn a missing STORAGE_* variable into the same 503. */
function storageUnavailable(cause: unknown) {
  if (cause instanceof StorageNotConfiguredError) {
    console.error(cause.message);
    return Response.json(
      { error: "File storage is not available right now" },
      { status: 503 }
    );
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const subjectType = params.get("subjectType") ?? "ORGANIZATION";
  if (!(subjectType in FileAssetSubject)) {
    return Response.json({ error: "Unknown subject" }, { status: 400 });
  }

  const documents = await listDocuments(
    auth.context.organizationId,
    subjectType as FileAssetSubject,
    params.get("subjectId") || null
  );

  return Response.json({ documents });
}

export async function POST(request: Request) {
  // 1. Authenticate — session, verified email, and an active organization.
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  // Cheap rejection before the body is buffered into memory. The header is a
  // claim, not a fact, so the real check is on the file below — but it costs
  // nothing and saves reading 200 MB to discover it was 200 MB.
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_FILE_BYTES) {
    return Response.json({ error: "That file is too large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }

  const parsed = uploadDocumentSchema.safeParse({
    assetTypeId: form.get("assetTypeId"),
    subjectType: form.get("subjectType"),
    subjectId: form.get("subjectId"),
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // 2. Validate the file itself.
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file was uploaded" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "That file is empty" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "That file is too large" }, { status: 413 });
  }
  // The type has to be resolved before the file can be judged: whether a PDF
  // is acceptable depends on the type's `isPhoto`, which is a column now.
  // `createDocument` resolves it again as the authority — this lookup exists
  // only so a wrong MIME gets a 415 naming what *would* have been accepted,
  // rather than a generic rejection.
  const assetType = await resolveAssetType(
    auth.context.organizationId,
    parsed.data.assetTypeId
  );
  if (!assetType) {
    return Response.json(
      { error: "That document type was not found" },
      { status: 404 }
    );
  }

  // Narrower for photo types than for documents: a PDF filed as a photo would
  // land in a carousel that cannot draw it. `acceptedTypesFor` is the same
  // table the upload dialog builds its `accept` from, so the two cannot drift.
  const accepted = acceptedTypesFor(assetType.isPhoto);
  if (!(file.type in accepted)) {
    return Response.json(
      { error: `Upload a ${labelForAcceptedTypes(accepted)} file` },
      { status: 415 }
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // `file.size` is what the client said; this is what actually arrived.
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return Response.json({ error: "That file is too large" }, { status: 413 });
  }

  try {
    // 3, 4, 5 — the object key, the upload and the row, in that order and in
    // one place, because the cross-organization check has to happen before any
    // of them.
    const result = await createDocument(
      auth.context.organizationId,
      auth.context.userId,
      parsed.data,
      {
        // Long file names are a display problem, not a storage one — the
        // stored object is named by a uuid regardless.
        name: file.name.slice(0, 255),
        type: file.type,
        bytes,
      }
    );

    if (result.error === "asset-type-not-found") {
      return Response.json(
        { error: "That document type was not found" },
        { status: 404 }
      );
    }

    if (result.error === "subject-mismatch") {
      return Response.json(
        {
          error: `“${result.assetType.label}” belongs to a ${result.assetType.subject.toLowerCase()}, not a ${parsed.data.subjectType.toLowerCase()}`,
        },
        { status: 400 }
      );
    }

    if (result.error === "subject-not-found") {
      return Response.json(
        { error: "That record was not found in this organization" },
        { status: 404 }
      );
    }

    if (result.error === "duplicate-asset-type") {
      return Response.json(
        {
          error: `A ${result.assetType.label} is already on file (${result.existing.fileName}) — delete it before uploading another`,
        },
        { status: 409 }
      );
    }

    // Next's dynamic client cache holds a rendered segment for 30s
    // (next.config.ts), so the page the upload came from needs evicting or the
    // new row won't be there when the user navigates back to it.
    const { subjectType, subjectId } = parsed.data;
    if (subjectId) {
      if (subjectType === "MEMBERSHIP") revalidatePath(`/members/${subjectId}`);
      if (subjectType === "PROPERTY") revalidatePath(`/properties/${subjectId}`);
      // A unit is rendered inside its property's page and the request carries
      // no property id, so the segment is revalidated rather than fetching the
      // parent purely to name one path.
      if (subjectType === "UNIT") revalidatePath("/properties", "layout");
    }

    return Response.json({ document: result.document }, { status: 201 });
  } catch (cause) {
    const configured = storageUnavailable(cause);
    if (configured) return configured;

    // The bucket refusing the write, or the insert failing after it accepted —
    // either way the caller can only retry, but the reason must not vanish.
    console.error("Document upload failed", cause);
    return Response.json({ error: "Could not store that file" }, { status: 500 });
  }
}
