import { requireActiveOrg } from "@/lib/api-auth";
import { getProperties, type PropertySummary } from "@/lib/properties";
import {
  buildExportWorkbook,
  exportFilename,
  xlsxResponse,
} from "@/lib/xlsx-export";

export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const properties = await getProperties(auth.context.organizationId);

  const buffer = await buildExportWorkbook<PropertySummary>({
    sheetName: "Properties",
    columns: [
      { header: "Name", width: 26, value: (p) => p.name },
      {
        header: "Type",
        width: 14,
        value: (p) => (p.type === "COMMERCIAL" ? "Commercial" : "Residential"),
      },
      { header: "Category", width: 16, value: (p) => p.category },
      { header: "Address", width: 30, value: (p) => p.address },
      { header: "Owner", width: 22, value: (p) => p.ownerName },
      {
        header: "Status",
        width: 12,
        value: (p) => (p.status === "ACTIVE" ? "Active" : "Inactive"),
      },
      { header: "Total units", width: 12, value: (p) => p.totalUnits },
      { header: "Occupied units", width: 14, value: (p) => p.occupiedUnits },
      { header: "Vacant units", width: 14, value: (p) => p.vacantUnits },
      {
        header: "Occupancy rate",
        width: 14,
        format: "0%",
        value: (p) => p.occupancyRate / 100,
      },
      {
        header: "Monthly rent roll",
        width: 18,
        format: "#,##0",
        value: (p) => p.monthlyRentRoll,
      },
    ],
    rows: properties,
  });

  return xlsxResponse(buffer, exportFilename("properties"));
}
