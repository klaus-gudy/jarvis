import { requireActiveOrg } from "@/lib/api-auth";
import { getLeases, leaseReference, type LeaseRow } from "@/lib/leases";
import {
  buildExportWorkbook,
  exportFilename,
  xlsxResponse,
} from "@/lib/xlsx-export";

export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const leases = await getLeases(auth.context.organizationId);

  const buffer = await buildExportWorkbook<LeaseRow>({
    sheetName: "Leases",
    columns: [
      { header: "Reference", width: 14, value: (l) => leaseReference(l.id) },
      { header: "Tenant", width: 24, value: (l) => l.tenantName },
      { header: "Property", width: 22, value: (l) => l.propertyName },
      { header: "Unit", width: 14, value: (l) => l.unitLabel },
      {
        header: "Start date",
        width: 14,
        format: "yyyy-mm-dd",
        value: (l) => new Date(l.startDate),
      },
      {
        header: "End date",
        width: 14,
        format: "yyyy-mm-dd",
        value: (l) => new Date(l.endDate),
      },
      { header: "Duration (months)", width: 16, value: (l) => l.durationMonths },
      {
        header: "Monthly rent",
        width: 16,
        format: "#,##0",
        value: (l) => l.monthlyRent,
      },
      {
        header: "Lease amount",
        width: 16,
        format: "#,##0",
        value: (l) => l.leaseAmount,
      },
      { header: "Status", width: 12, value: (l) => l.status },
      { header: "Invoice status", width: 14, value: (l) => l.invoice?.status ?? "" },
      {
        header: "Invoice amount",
        width: 16,
        format: "#,##0",
        value: (l) => l.invoice?.amount ?? "",
      },
      {
        header: "Invoice paid",
        width: 16,
        format: "#,##0",
        value: (l) => l.invoice?.paid ?? "",
      },
    ],
    rows: leases,
  });

  return xlsxResponse(buffer, exportFilename("leases"));
}
