import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { requireActiveOrg } from "@/lib/api-auth";
import type { PropertyStatus, PropertyType } from "@/lib/generated/prisma/enums";
import { createProperty, getProperties } from "@/lib/properties";
import { createPropertySchema } from "@/lib/properties-schemas";

export async function GET(request: NextRequest) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const type = params.get("type")?.toUpperCase();
  const status = params.get("status")?.toUpperCase();
  const q = params.get("q")?.trim();

  const properties = await getProperties(auth.context.organizationId, {
    type:
      type === "RESIDENTIAL" || type === "COMMERCIAL"
        ? (type as PropertyType)
        : undefined,
    status:
      status === "ACTIVE" || status === "INACTIVE"
        ? (status as PropertyStatus)
        : undefined,
    q: q || undefined,
  });

  return Response.json({ properties });
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

  const parsed = createPropertySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const property = await createProperty(auth.context.organizationId, parsed.data);
  revalidatePath("/properties");

  return Response.json({ property }, { status: 201 });
}
