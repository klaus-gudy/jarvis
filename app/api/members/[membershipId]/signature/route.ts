import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import {
  SIGNATURE_MAX_BYTES,
  findSignatureSubject,
  isPng,
  readSignature,
  removeSignature,
  saveSignature,
} from "@/lib/signatures";
import { StorageNotConfiguredError } from "@/lib/storage";

type Context = RouteContext<"/api/members/[membershipId]/signature">;

const STORAGE_DOWN = () =>
  Response.json(
    { error: "File storage is not available right now" },
    { status: 503 }
  );

/**
 * A member's signature image. Anyone in the organization may see it — it is
 * printed on their contracts — but only the member themself may add, replace
 * or remove it.
 *
 * That ownership check is new here: every other member route only asks
 * whether the membership is in your organization. A signature is the one
 * thing that must not be set on someone's behalf, so writes also ask whether
 * the membership is *yours*.
 */
export async function GET(_request: Request, ctx: Context) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { membershipId } = await ctx.params;
  const member = await findSignatureSubject(auth.context.organizationId, membershipId);
  const objectKey = member?.profile?.signatureKey;
  if (!objectKey) {
    return Response.json({ error: "No signature on file" }, { status: 404 });
  }

  let body: ReadableStream | null;
  try {
    body = await readSignature(auth.context.organizationId, objectKey);
  } catch (cause) {
    if (cause instanceof StorageNotConfiguredError) {
      console.error(cause.message);
      return STORAGE_DOWN();
    }
    throw cause;
  }
  if (!body) {
    console.error(`[signature] ${membershipId} points at missing ${objectKey}`);
    return Response.json({ error: "No signature on file" }, { status: 404 });
  }

  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'inline; filename="signature.png"',
      // Same stance as documents: correct only for this signed-in member.
      // The page busts it with `?v=<key>` after a replace instead.
      "Cache-Control": "private, max-age=0, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** The caller's own membership, or the response that refuses them. */
async function ownMembership(ctx: Context) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return { ok: false as const, response: auth.response };

  const { membershipId } = await ctx.params;
  const member = await findSignatureSubject(auth.context.organizationId, membershipId);
  if (!member) {
    return {
      ok: false as const,
      response: Response.json({ error: "Member not found" }, { status: 404 }),
    };
  }
  if (member.userId !== auth.context.userId) {
    return {
      ok: false as const,
      response: Response.json(
        { error: "Only this member can change their own signature" },
        { status: 403 }
      ),
    };
  }
  return { ok: true as const, organizationId: auth.context.organizationId, membershipId };
}

function revalidate(membershipId: string) {
  revalidatePath(`/members/${membershipId}`);
  revalidatePath("/profile");
}

export async function PUT(request: Request, ctx: Context) {
  const own = await ownMembership(ctx);
  if (!own.ok) return own.response;

  // Cheap early refusal; the real check is on the bytes below.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > SIGNATURE_MAX_BYTES + 64 * 1024) {
    return Response.json({ error: "Signature image is too large" }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Expected a multipart form" }, { status: 400 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Draw a signature first" }, { status: 400 });
  }
  if (file.size > SIGNATURE_MAX_BYTES) {
    return Response.json({ error: "Signature image is too large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type !== "image/png" || !isPng(bytes)) {
    return Response.json({ error: "A signature must be a PNG image" }, { status: 415 });
  }

  try {
    await saveSignature(own.organizationId, own.membershipId, bytes);
  } catch (cause) {
    if (cause instanceof StorageNotConfiguredError) {
      console.error(cause.message);
      return STORAGE_DOWN();
    }
    throw cause;
  }

  revalidate(own.membershipId);
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: Context) {
  const own = await ownMembership(ctx);
  if (!own.ok) return own.response;

  await removeSignature(own.membershipId);
  revalidate(own.membershipId);
  return Response.json({ ok: true });
}
