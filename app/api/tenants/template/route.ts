import { requireActiveOrg } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildTenantTemplate } from "@/lib/tenant-import";

/** Turns an organization name into something safe for a Content-Disposition filename. */
function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "organization"
  );
}

export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const organization = await prisma.organization.findUnique({
    where: { id: auth.context.organizationId },
    select: { name: true },
  });
  if (!organization) {
    return Response.json({ error: "Organization not found" }, { status: 404 });
  }

  const workbook = await buildTenantTemplate(organization.name);

  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tenants-template-${slugify(organization.name)}.xlsx"`,
      "Content-Length": String(workbook.byteLength),
      // The template embeds the organization name, and it is behind auth.
      "Cache-Control": "private, no-store",
    },
  });
}
