import { revalidatePath } from "next/cache";

import { requireActiveOrg } from "@/lib/api-auth";
import { OWNER_REVALIDATE_PATHS, registerAttachment } from "@/lib/attachments";
import { registerAttachmentSchema } from "@/lib/attachments-schemas";
import { formatBytes, MAX_ATTACHMENT_BYTES } from "@/lib/attachment-types";

/**
 * Step two: the upload has landed, record it. The row is only created once the
 * object is confirmed to exist, and its size and type are read off the object
 * rather than trusted from the request.
 */
export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = registerAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await registerAttachment(
    auth.context.organizationId,
    auth.context.userId,
    parsed.data
  );

  if (!result.ok) {
    if (result.reason === "too-large") {
      return Response.json(
        {
          error: `That file is larger than the ${formatBytes(MAX_ATTACHMENT_BYTES)} limit`,
        },
        { status: 413 }
      );
    }
    if (result.reason === "unsupported-type") {
      return Response.json(
        { error: "That file type isn't supported" },
        { status: 415 }
      );
    }
    if (result.reason === "unknown-slot") {
      return Response.json(
        { error: "That isn't a document type this record accepts" },
        { status: 400 }
      );
    }
    if (result.reason === "not-uploaded") {
      return Response.json(
        { error: "That upload didn't finish — try again" },
        { status: 400 }
      );
    }
    return Response.json({ error: "Record not found" }, { status: 404 });
  }

  for (const path of OWNER_REVALIDATE_PATHS[parsed.data.ownerType]) {
    revalidatePath(path);
  }

  return Response.json({ attachment: result.attachment });
}
