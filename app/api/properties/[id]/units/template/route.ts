import { requireActiveOrg } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildUnitTemplate } from "@/lib/unit-import";

/** Turns a property name into something safe to put in a Content-Disposition filename. */
function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "property"
  );
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/properties/[id]/units/template">
) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const property = await prisma.property.findFirst({
    where: { id, organizationId: auth.context.organizationId },
    select: { name: true },
  });
  if (!property) {
    return Response.json({ error: "Property not found" }, { status: 404 });
  }

  const workbook = await buildUnitTemplate(property.name);

  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="units-template-${slugify(property.name)}.xlsx"`,
      "Content-Length": String(workbook.byteLength),
      // The template embeds the property name, and it is behind auth.
      "Cache-Control": "private, no-store",
    },
  });
}
