import { requireActiveOrg } from "@/lib/api-auth";
import { getPayments, type PaymentRow } from "@/lib/payments";
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

  const payments = await getPayments(auth.context.organizationId);

  const buffer = await buildExportWorkbook<PaymentRow>({
    sheetName: "Payments",
    columns: [
      {
        header: "Date",
        width: 14,
        format: "yyyy-mm-dd",
        value: (p) => new Date(p.paidAt),
      },
      { header: "Tenant", width: 24, value: (p) => p.tenantName },
      { header: "Property", width: 22, value: (p) => p.propertyName },
      { header: "Unit", width: 14, value: (p) => p.unitLabel },
      { header: "Invoice reference", width: 18, value: (p) => p.invoiceReference },
      { header: "Amount", width: 16, format: "#,##0", value: (p) => p.amount },
      { header: "Method", width: 16, value: (p) => p.method ?? "" },
      { header: "Notes", width: 30, value: (p) => p.notes ?? "" },
      { header: "Invoice status", width: 14, value: (p) => p.invoiceStatus },
      {
        header: "Invoice amount",
        width: 16,
        format: "#,##0",
        value: (p) => p.invoiceAmount,
      },
    ],
    rows: pickExportRows(payments, ids),
  });

  return xlsxResponse(buffer, exportFilename("payments"));
}
