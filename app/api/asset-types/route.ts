import { requireActiveOrg } from "@/lib/api-auth";
import { createAssetType, listAssetTypes } from "@/lib/asset-types";
import { createAssetTypeSchema } from "@/lib/documents-schemas";
import { FileAssetSubject } from "@/lib/generated/prisma/enums";

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
