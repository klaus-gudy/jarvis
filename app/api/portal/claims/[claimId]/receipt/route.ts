import { revalidatePath } from "next/cache";

import { authorizeTenant } from "@/lib/authz";
import {
  ACCEPTED_FILE_TYPES,
  acceptedTypesFor,
  bytesMatchType,
  labelForAcceptedTypes,
  MAX_FILE_BYTES,
} from "@/lib/document-options";
import { attachClaimReceipt } from "@/lib/payment-claims";
import { StorageNotConfiguredError } from "@/lib/storage";

/**
 * A tenant attaches a receipt (photo or PDF) to a payment they reported. Its
 * own route rather than `POST /api/documents`: that one asks for staff
 * permissions on the invoice, which a tenant never holds — here the check is
 * "your own claim, still pending", made by `attachClaimReceipt`.
 *
 * Same file rules as every other upload: size before buffering, the document
 * allowlist, and the bytes must match the type they claim to be.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/portal/claims/[claimId]/receipt">
) {
  const auth = await authorizeTenant();
  if (!auth.ok) return auth.response;

  const declaredSize = Number(request.headers.get("content-length") ?? Infinity);
  if (declaredSize > MAX_FILE_BYTES) {
    return Response.json({ error: "That file is too large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "No file was uploaded" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "That file is too large" }, { status: 413 });
  }
  const accepted = acceptedTypesFor(false);
  if (!(file.type in accepted)) {
    return Response.json(
      { error: `Upload a ${labelForAcceptedTypes(accepted)} file` },
      { status: 415 }
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return Response.json({ error: "That file is too large" }, { status: 413 });
  }
  if (!bytesMatchType(bytes, file.type)) {
    return Response.json(
      { error: `That file's contents don't match its type (${ACCEPTED_FILE_TYPES[file.type].label})` },
      { status: 415 }
    );
  }

  const { claimId } = await ctx.params;
  try {
    const result = await attachClaimReceipt(auth.context, claimId, {
      name: file.name.slice(0, 255),
      type: file.type,
      bytes,
    });
    if (result.error === "not-found") {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }
    if (result.error === "reviewed") {
      return Response.json({ error: "This payment was already reviewed" }, { status: 409 });
    }
    if (result.error === "already-attached") {
      return Response.json({ error: "A receipt is already attached" }, { status: 409 });
    }
    if (result.error) {
      return Response.json({ error: "Could not store that file" }, { status: 500 });
    }

    revalidatePath("/portal/payments", "layout");
    revalidatePath("/leases", "layout");
    return Response.json({ receiptId: result.receiptId }, { status: 201 });
  } catch (cause) {
    if (cause instanceof StorageNotConfiguredError) {
      console.error(cause.message);
      return Response.json({ error: "File storage is not available right now" }, { status: 503 });
    }
    console.error("Receipt upload failed", cause);
    return Response.json({ error: "Could not store that file" }, { status: 500 });
  }
}
