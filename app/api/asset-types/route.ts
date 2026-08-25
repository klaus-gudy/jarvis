import { requireActiveOrg } from "@/lib/api-auth";
import { createAssetType, listAssetTypes } from "@/lib/asset-types";
import { createAssetTypeSchema } from "@/lib/documents-schemas";
import { FileAssetSubject } from "@/lib/generated/prisma/enums";

/**
 * Document types — the list that used to be a Prisma enum.
 *
 * `GET` is scoped to one subject because that is how every caller wants it:
 * a dropdown is always standing on a lease, or a property, or a member.
 *
 * `POST` takes the group as a field rather than asking the person for it. The
 * surface that opens the "add a type" control already knows what it is
 * attached to, so it sends that; nobody is presented with a taxonomy. The same
 * goes for `isPhoto` — added from the Images tab means a photo type, added
 * from the Documents table means it is not.
 */

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const subject = new URL(request.url).searchParams.get("subject");
  if (!subject || !(subject in FileAssetSubject)) {
    return Response.json({ error: "Unknown subject" }, { status: 400 });
  }

  const assetTypes = await listAssetTypes(
    auth.context.organizationId,
    subject as FileAssetSubject
  );

  return Response.json({ assetTypes });
}

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createAssetTypeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await createAssetType(auth.context.organizationId, parsed.data);

  if (result.error === "invalid-label") {
    return Response.json(
      { error: "Give the type a name with letters or numbers in it" },
      { status: 400 }
    );
  }

  if (result.error === "duplicate") {
    // Named rather than a bare conflict: the existing one is very often on a
    // *different* subject, and "already exists" alone would look like a lie to
    // someone staring at a dropdown that does not contain it.
    const where =
      result.existing.subject === parsed.data.subject
        ? "already exists"
        : `already exists under ${result.existing.subject.toLowerCase()}`;
    return Response.json(
      { error: `“${result.existing.label}” ${where}`, assetType: result.existing },
      { status: 409 }
    );
  }

  return Response.json({ assetType: result.assetType }, { status: 201 });
}
