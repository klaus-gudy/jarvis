import ExcelJS from "exceljs";

/**
 * The export half of the spreadsheet story — `lib/xlsx-import.ts` is the
 * other half (templates in, rows out). Entity-specific parts are just a list
 * of columns and how to read a value off a row; the styling, the file
 * response and the filename all live here once.
 */

export type ExportColumn<T> = {
  header: string;
  width?: number;
  value: (row: T) => string | number | Date | null;
  /** Excel number format, e.g. "#,##0" for money or "yyyy-mm-dd" for a date. */
  format?: string;
};

export async function buildExportWorkbook<T>(opts: {
  sheetName: string;
  columns: ExportColumn<T>[];
  rows: T[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rentops";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(opts.sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = opts.columns.map((column) => ({
    header: column.header,
    width: column.width ?? 20,
    ...(column.format ? { style: { numFmt: column.format } } : {}),
  }));

  // Same header treatment as the import templates, so a downloaded export and
  // a downloaded template read as the same family of file.
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  for (const row of opts.rows) {
    sheet.addRow(opts.columns.map((column) => column.value(row) ?? ""));
  }

  if (opts.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: opts.columns.length },
    };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Turns a name into something safe to put in a Content-Disposition filename. */
export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "export"
  );
}

/** "tenants-2026-09-05.xlsx" — dated so re-downloading the same page doesn't overwrite silently. */
export function exportFilename(base: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slugify(base)}-${stamp}.xlsx`;
}

export function xlsxResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
      // Every export is org data behind auth.
      "Cache-Control": "private, no-store",
    },
  });
}
