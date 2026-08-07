import ExcelJS from "exceljs";

import { UNIT_TYPE_OPTIONS } from "@/lib/unit-options";
import { createUnitSchema, type CreateUnitInput } from "@/lib/units-schemas";

const SHEET_UNITS = "Units";
const SHEET_REFERENCE = "Reference";

/** Rows past this are refused outright — a spreadsheet that long is a mistake, not an import. */
export const MAX_IMPORT_ROWS = 500;
/** The template is a few KB; anything approaching this is not one of ours. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

type ColumnKey =
  | "label"
  | "rentAmount"
  | "unitType"
  | "floor"
  | "block"
  | "minTenureMonths";

type TemplateColumn = {
  key: ColumnKey;
  header: string;
  width: number;
  required: boolean;
  /** Shown in the Reference sheet's worked example. */
  example: string;
};

/**
 * The single source of truth for the template's shape. The generator writes
 * these headers and the parser matches against them, so a column can never be
 * added to one side only.
 *
 * Size and amenities are deliberately absent: both are still on the unit form,
 * they just aren't worth a spreadsheet column yet. Adding either back means a
 * row here plus its handling in the parse loop — nothing else.
 */
const COLUMNS: TemplateColumn[] = [
  { key: "label", header: "Unit name", width: 18, required: true, example: "A1" },
  {
    key: "rentAmount",
    header: "Monthly rate (TZS)",
    width: 20,
    required: true,
    example: "450000",
  },
  { key: "unitType", header: "Unit type", width: 16, required: false, example: "2 Bedroom" },
  { key: "floor", header: "Floor", width: 12, required: false, example: "Ground" },
  { key: "block", header: "Block", width: 12, required: false, example: "B" },
  {
    key: "minTenureMonths",
    header: "Minimum tenure (months)",
    width: 24,
    required: false,
    example: "6",
  },
];

/** A row after parsing: either ready to create, or carrying the reasons it isn't. */
export type ParsedUnitRow = {
  /** 1-based row number in the sheet, so an error points at a row the user can see. */
  rowNumber: number;
  /** Best-effort label for display, even when the row is invalid. */
  label: string;
  /** Present only when `errors` is empty. */
  data: CreateUnitInput | null;
  errors: string[];
};

export type ParseResult = {
  rows: ParsedUnitRow[];
  /** Set when the file itself is unusable — no rows are returned. */
  fatal?: string;
};

/** Excel hands back plain values, rich text, formula results or errors — flatten them all. */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if ("formula" in value) return cellText(value.result ?? "");
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("error" in value) return "";
  }
  return String(value).trim();
}

/** Headers are matched loosely so a renamed-but-recognisable column still lands. */
function normalizeHeader(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Accepts what people actually type into a money column: "450000", "450,000",
 * "TZS 450 000". Returns null when nothing numeric is left.
 */
function toNumber(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Case- and spacing-insensitive lookup against a fixed option list. */
function matchOption<T extends readonly string[]>(
  text: string,
  options: T
): T[number] | undefined {
  const needle = text.toLowerCase().replace(/\s+/g, " ").trim();
  return options.find((option) => option.toLowerCase() === needle);
}

export async function buildUnitTemplate(propertyName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rentops";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(SHEET_UNITS, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  // A note on each header carries the rules without stealing a visible row.
  COLUMNS.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    const note = column.required
      ? "Required."
      : "Optional — leave blank to skip.";
    cell.note = `${note}\n\nExample: ${column.example}`;
  });

  // Dropdowns beat free text: a picked unit type can't fail validation later.
  const unitTypeColumn = COLUMNS.findIndex((c) => c.key === "unitType") + 1;
  for (let row = 2; row <= MAX_IMPORT_ROWS + 1; row++) {
    sheet.getCell(row, unitTypeColumn).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${UNIT_TYPE_OPTIONS.join(",")}"`],
    };
  }

  const reference = workbook.addWorksheet(SHEET_REFERENCE);
  reference.columns = [{ width: 30 }, { width: 46 }];

  const heading = (text: string) => {
    const row = reference.addRow([text]);
    row.font = { bold: true, size: 12 };
    return row;
  };

  heading(`Import units into ${propertyName}`);
  reference.addRow([
    "Fill in the Units sheet, then upload it back. This sheet is ignored on import.",
  ]);
  reference.addRow([]);

  heading("Worked example");
  reference.addRow(COLUMNS.map((column) => column.header)).font = { bold: true };
  reference.addRow(COLUMNS.map((column) => column.example));
  reference.addRow([]);

  heading("Valid unit types");
  reference.addRow(["Pick from the dropdown in the Units sheet."]);
  UNIT_TYPE_OPTIONS.forEach((option) => reference.addRow([option]));
  reference.addRow([]);

  reference.addRow([
    "Size and amenities aren't imported — add them per unit afterwards.",
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function parseUnitWorkbook(
  // exceljs types its reader against a plain ArrayBuffer, which is also exactly
  // what `File.arrayBuffer()` hands back — so no copy into a Node Buffer.
  buffer: ArrayBuffer
): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return { rows: [], fatal: "That file isn't a readable .xlsx workbook." };
  }

  // Prefer the sheet we named, but tolerate a copy-paste into a fresh workbook.
  const sheet = workbook.getWorksheet(SHEET_UNITS) ?? workbook.worksheets[0];
  if (!sheet) return { rows: [], fatal: "The workbook has no sheets." };

  const headerRow = sheet.getRow(1);
  const columnByIndex = new Map<number, ColumnKey>();
  headerRow.eachCell({ includeEmpty: false }, (cell, index) => {
    const normalized = normalizeHeader(cellText(cell.value));
    const match = COLUMNS.find(
      (column) => normalizeHeader(column.header) === normalized
    );
    if (match) columnByIndex.set(index, match.key);
  });

  const missing = COLUMNS.filter(
    (column) => column.required && ![...columnByIndex.values()].includes(column.key)
  );
  if (missing.length > 0) {
    return {
      rows: [],
      fatal: `The sheet is missing required column${missing.length > 1 ? "s" : ""}: ${missing
        .map((column) => column.header)
        .join(", ")}. Download a fresh template.`,
    };
  }

  const rows: ParsedUnitRow[] = [];
  // Tracks labels already seen in this file — the API only catches a clash once
  // the first of the pair is committed, which would report the wrong row.
  const seenLabels = new Map<string, number>();
  let truncated = false;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rows.length >= MAX_IMPORT_ROWS) {
      truncated = true;
      return;
    }

    const raw = {} as Record<ColumnKey, string>;
    for (const [index, key] of columnByIndex) {
      raw[key] = cellText(row.getCell(index).value);
    }

    // A row where every mapped cell is blank is spreadsheet padding, not data.
    if (COLUMNS.every((column) => !raw[column.key])) return;

    const errors: string[] = [];
    /**
     * Columns this pass already reported on. Zod runs afterwards over the same
     * row and would restate them — "abc" in a money column is both "must be a
     * number" here and "is required" there.
     */
    const reported = new Set<ColumnKey>();

    const unitType = raw.unitType
      ? matchOption(raw.unitType, UNIT_TYPE_OPTIONS)
      : null;
    if (raw.unitType && !unitType) {
      errors.push(`"${raw.unitType}" isn't a valid unit type`);
      reported.add("unitType");
    }

    const numeric = (key: "rentAmount" | "minTenureMonths", label: string) => {
      if (!raw[key]) return null;
      const value = toNumber(raw[key]);
      if (value == null) {
        errors.push(`${label} must be a number`);
        reported.add(key);
      }
      return value;
    };

    const candidate = {
      label: raw.label,
      rentAmount: numeric("rentAmount", "Monthly rate"),
      minTenureMonths: numeric("minTenureMonths", "Minimum tenure"),
      unitType,
      floor: raw.floor || undefined,
      block: raw.block || undefined,
      // Not columns in the template — an imported unit simply starts without them.
      sizeSqm: null,
      amenities: [],
    };

    // The same schema the single-unit form posts against, so the rules can't drift.
    const parsed = createUnitSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as ColumnKey;
        if (reported.has(key)) continue;
        const field = COLUMNS.find((column) => column.key === key);
        errors.push(field ? `${field.header}: ${issue.message}` : issue.message);
      }
    }

    const labelKey = raw.label.toLowerCase();
    if (raw.label) {
      const firstSeen = seenLabels.get(labelKey);
      if (firstSeen) {
        errors.push(`Duplicate of row ${firstSeen} in this file`);
      } else {
        seenLabels.set(labelKey, rowNumber);
      }
    }

    rows.push({
      rowNumber,
      label: raw.label || `Row ${rowNumber}`,
      data: errors.length === 0 && parsed.success ? parsed.data : null,
      errors,
    });
  });

  if (rows.length === 0) {
    return { rows: [], fatal: "The sheet has no rows to import." };
  }
  if (truncated) {
    return {
      rows,
      fatal: `Only the first ${MAX_IMPORT_ROWS} rows were read. Split the file and import the rest separately.`,
    };
  }

  return { rows };
}
