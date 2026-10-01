import { revalidatePath } from "next/cache";

import { authorize } from "@/lib/authz";
import { createLeaseTemplateSchema } from "@/lib/lease-template-schemas";
import { createLeaseTemplate, getLeaseTemplates } from "@/lib/lease-templates";

export async function GET() {
  const auth = await authorize(["template:manage", "contract:generate", "lease:write"]);
  if (!auth.ok) return auth.response;

  const templates = await getLeaseTemplates(auth.context.organizationId);
  return Response.json({ templates });
}

export async function POST(request: Request) {
  const auth = await authorize("template:manage");
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createLeaseTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const result = await createLeaseTemplate(
    auth.context.organizationId,
    parsed.data,
    auth.context,
  );
  if ("error" in result) {
    return Response.json(
      { error: "A template with this name already exists" },
      { status: 409 }
    );
  }

  revalidatePath("/settings/lease-templates");
  return Response.json({ template: result.template }, { status: 201 });
}
