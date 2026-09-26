import { requireActiveOrg } from "@/lib/api-auth";
import { getProperty } from "@/lib/properties";
import {
  buildExportWorkbook,
  pickExportRows,
  readExportIds,
  slugify,
  xlsxResponse,
} from "@/lib/xlsx-export";

type UnitExportRow = NonNullable<
  Awaited<ReturnType<typeof getProperty>>
>["units"][number];

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/properties/[id]/units/export">
) {
  const { id } = await ctx.params;
  return exportResponse(id, null);
}

/** A filtered export: only the rows the table was showing, in its order. */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/properties/[id]/units/export">
) {
  const body = await readExportIds(request);
  if (!body.ok) return body.response;
  const { id } = await ctx.params;
  return exportResponse(id, body.ids);
}

async function exportResponse(id: string, ids: string[] | null) {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const property = await getProperty(auth.context.organizationId, id);
  if (!property) {
    return Response.json({ error: "Property not found" }, { status: 404 });
  }

  const buffer = await buildExportWorkbook<UnitExportRow>({
    sheetName: "Units",
    columns: [
      { header: "Unit", width: 14, value: (u) => u.label },
      { header: "Type", width: 16, value: (u) => u.unitType ?? "" },
      { header: "Floor", width: 12, value: (u) => u.floor ?? "" },
      { header: "Block", width: 12, value: (u) => u.block ?? "" },
      { header: "Size (sqm)", width: 12, value: (u) => u.sizeSqm ?? "" },
      { header: "Rent (TZS)", width: 16, format: "#,##0", value: (u) => u.rentAmount },
      {
        header: "Min tenure (months)",
        width: 16,
        value: (u) => u.minTenureMonths ?? "",
      },
      {
        header: "Auto-renew",
        width: 12,
        value: (u) => (u.autoRenew ? "Yes" : "No"),
      },
      {
        header: "Status",
        width: 12,
        value: (u) => (u.isOccupied ? "Occupied" : "Vacant"),
      },
      { header: "Tenant", width: 24, value: (u) => u.tenantName ?? "" },
      {
        header: "Lease start",
        width: 14,
        format: "yyyy-mm-dd",
        value: (u) => u.leaseStart ?? "",
      },
      { header: "Amenities", width: 30, value: (u) => u.amenities.join(", ") },
    ],
    rows: pickExportRows(property.units, ids),
  });

  return xlsxResponse(buffer, `units-${slugify(property.name)}-${exportStamp()}.xlsx`);
}

function exportStamp() {
  return new Date().toISOString().slice(0, 10);
}
