import { requireActiveOrg } from "@/lib/api-auth";
import { getTenants } from "@/lib/tenants";
import {
  buildExportWorkbook,
  exportFilename,
  pickExportRows,
  readExportIds,
  xlsxResponse,
} from "@/lib/xlsx-export";

export async function GET() {
  return exportResponse(null);
}

/** A filtered export: only the rows the table was showing, in its order. */
export async function POST(request: Request) {
  const body = await readExportIds(request);
  if (!body.ok) return body.response;
  return exportResponse(body.ids);
}

async function exportResponse(ids: string[] | null) {
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
    rows: pickExportRows(tenants, ids, (t) => t.membershipId),
  });

  return xlsxResponse(buffer, exportFilename("tenants"));
}
