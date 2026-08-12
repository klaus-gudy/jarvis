import { requireActiveOrg } from "@/lib/api-auth";
import { presignAttachmentUpload } from "@/lib/attachments";
import { presignAttachmentSchema } from "@/lib/attachments-schemas";

/**
 * Step one of an upload: the browser says what it is about to send, and gets
 * back a URL to PUT it to. The bytes go straight to the bucket from there, so
 * this route is the only part of an upload the app server sees.
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

  const parsed = presignAttachmentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await presignAttachmentUpload(
    auth.context.organizationId,
    parsed.data
  );

  if (!result.ok) {
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
    // "Belongs to another org" and "doesn't exist" are the same answer here.
    return Response.json({ error: "Record not found" }, { status: 404 });
  }

  return Response.json({ url: result.url, key: result.key });
}
