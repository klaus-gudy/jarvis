import { requireActiveOrg } from "@/lib/api-auth";
import { getTenants } from "@/lib/tenants";
import {
  buildExportWorkbook,
  exportFilename,
  xlsxResponse,
} from "@/lib/xlsx-export";

export async function GET() {
  const auth = await requireActiveOrg();
  if (!auth.ok) return auth.response;

  const tenants = await getTenants(auth.context.organizationId);

  const buffer = await buildExportWorkbook({
    sheetName: "Tenants",
    columns: [
      { header: "Name", width: 26, value: (t) => t.name },
      { header: "Email", width: 26, value: (t) => t.email ?? "" },
      { header: "Phone", width: 18, value: (t) => t.phone ?? "" },
      {
        header: "Joined",
        width: 14,
        format: "yyyy-mm-dd",
        value: (t) => new Date(t.joinedAt),
      },
      { header: "Property", width: 22, value: (t) => t.propertyName ?? "" },
      { header: "Unit", width: 14, value: (t) => t.unitLabel ?? "" },
      { header: "Status", width: 12, value: (t) => t.status },
      {
        header: "Can sign in",
        width: 12,
        value: (t) => (t.canSignIn ? "Yes" : "No"),
      },
    ],
    rows: tenants,
  });

  return xlsxResponse(buffer, exportFilename("tenants"));
}
