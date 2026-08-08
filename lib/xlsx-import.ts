import ExcelJS from "exceljs";
import type { ZodType } from "zod";

/**
 * The spreadsheet half of every bulk importer: generate a template, read one
 * back, and report per-row what is usable. Entity-specific parts — the columns
 * and how a row becomes a payload — are passed in, so units and tenants share
 * one implementation of the fiddly bits (cell flattening, loose header
 * matching, blank-row skipping, in-file duplicate detection, row caps).
 */

const SHEET_REFERENCE = "Reference";

/** Rows past this are refused outright — a spreadsheet that long is a mistake, not an import. */
export const MAX_IMPORT_ROWS = 500;
/** A template is a few KB; anything approaching this is not one of ours. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export type ImportColumn<K extends string> = {
  key: K;
  header: string;
  width: number;
  required: boolean;
  /** Shown in the Reference sheet's worked example and in the header's note. */
  example: string;
  /** When set, the template gives this column a dropdown of exactly these values. */
  options?: readonly string[];
  /**
   * Excel number format for the column. Use "@" (text) on anything with a
   * meaningful leading zero — a phone typed as 0712345678 into a General cell
   * is stored as the number 712345678 and loses it.
   */
  format?: string;
};

/** A row after parsing: either ready to create, or carrying the reasons it isn't. */
export type ParsedRow<T> = {
  /** 1-based row number in the sheet, so an error points at a row the user can see. */
  rowNumber: number;
  /** Best-effort label for display, even when the row is invalid. */
  label: string;
  /** Present only when `errors` is empty. */
  data: T | null;
  errors: string[];
};

export type ParseResult<T> = {
  rows: ParsedRow<T>[];
  /** Set when the file itself is unusable, or the read was truncated. */
  fatal?: string;
};

/** Excel hands back plain values, rich text, formula results or errors — flatten them all. */
export function cellText(value: ExcelJS.CellValue): string {
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
 * Accepts what people actually type into a number column: "450000", "450,000",
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

/** Handed to a row mapper so it can read cells and report problems uniformly. */
export type RowContext<K extends string> = {
  raw: Record<K, string>;
  /**
   * Push a human-readable problem; the row is skipped if any are present.
   * Naming the fields it covers stops the schema restating the same fault —
   * pass payload keys as well as column keys where the two differ.
   */
  fail(message: string, ...fields: string[]): void;
  /** Parses a numeric cell, reporting "<label> must be a number" itself. */
  number(key: K, label: string): number | null;
  /** Matches a cell against a fixed list, reporting an unknown value itself. */
  option<T extends readonly string[]>(
    key: K,
    options: T,
    noun: string
  ): T[number] | null;
};

export type TemplateSpec<K extends string> = {
  sheetName: string;
  columns: ImportColumn<K>[];
  /** Heading on the Reference sheet, e.g. "Import units into Milan". */
  title: string;
  intro: string;
  /** Extra reference blocks, e.g. the list of valid unit types. */
  sections?: { heading: string; note?: string; items: readonly string[] }[];
  /** Closing line on the Reference sheet. */
  footnote?: string;
};

export async function buildTemplate<K extends string>(
  spec: TemplateSpec<K>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rentops";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(spec.sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = spec.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
    ...(column.format ? { style: { numFmt: column.format } } : {}),
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  spec.columns.forEach((column, index) => {
    // A note on each header carries the rules without stealing a visible row.
    const cell = header.getCell(index + 1);
    const rule = column.required ? "Required." : "Optional — leave blank to skip.";
    cell.note = `${rule}\n\nExample: ${column.example}`;

    // Dropdowns beat free text: a picked value can't fail validation later.
    if (column.options) {
      for (let row = 2; row <= MAX_IMPORT_ROWS + 1; row++) {
        sheet.getCell(row, index + 1).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${column.options.join(",")}"`],
        };
      }
    }
  });

  const reference = workbook.addWorksheet(SHEET_REFERENCE);
  reference.columns = [{ width: 30 }, { width: 46 }];

  const heading = (text: string) => {
    reference.addRow([text]).font = { bold: true, size: 12 };
  };

  heading(spec.title);
  reference.addRow([spec.intro]);
  reference.addRow([]);

  heading("Worked example");
  reference.addRow(spec.columns.map((c) => c.header)).font = { bold: true };
  reference.addRow(spec.columns.map((c) => c.example));

  for (const section of spec.sections ?? []) {
    reference.addRow([]);
    heading(section.heading);
    if (section.note) reference.addRow([section.note]);
    section.items.forEach((item) => reference.addRow([item]));
  }

  if (spec.footnote) {
    reference.addRow([]);
    reference.addRow([spec.footnote]);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function parseWorkbook<K extends string, T>(
  // exceljs types its reader against a plain ArrayBuffer, which is also exactly
  // what `File.arrayBuffer()` hands back — so no copy into a Node Buffer.
  buffer: ArrayBuffer,
  opts: {
    sheetName: string;
    columns: ImportColumn<K>[];
    /** Column whose value must be unique within the file. */
    uniqueBy: K;
    /** What to call a clashing value in the duplicate message, e.g. "name". */
    uniqueNoun: string;
    /** Row label for the review list. */
    labelOf: (raw: Record<K, string>) => string;
    /** Builds the payload to validate; report problems via `ctx.fail`. */
    toCandidate: (ctx: RowContext<K>) => unknown;
    schema: ZodType<T>;
  }
): Promise<ParseResult<T>> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    return { rows: [], fatal: "That file isn't a readable .xlsx workbook." };
  }

  // Prefer the sheet we named, but tolerate a copy-paste into a fresh workbook.
  const sheet =
    workbook.getWorksheet(opts.sheetName) ?? workbook.worksheets[0];
  if (!sheet) return { rows: [], fatal: "The workbook has no sheets." };

  const columnByIndex = new Map<number, K>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, index) => {
    const normalized = normalizeHeader(cellText(cell.value));
    const match = opts.columns.find(
      (column) => normalizeHeader(column.header) === normalized
    );
    if (match) columnByIndex.set(index, match.key);
  });

  const found = [...columnByIndex.values()];
  const missing = opts.columns.filter(
    (column) => column.required && !found.includes(column.key)
  );
  if (missing.length > 0) {
    return {
      rows: [],
      fatal: `The sheet is missing required column${missing.length > 1 ? "s" : ""}: ${missing
        .map((column) => column.header)
        .join(", ")}. Download a fresh template.`,
    };
  }

  const rows: ParsedRow<T>[] = [];
  // Tracks values already seen in this file — the API only catches a clash once
  // the first of the pair is committed, which would report the wrong row.
  const seen = new Map<string, number>();
  let truncated = false;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    if (rows.length >= MAX_IMPORT_ROWS) {
      truncated = true;
      return;
    }

    const raw = {} as Record<K, string>;
    for (const column of opts.columns) raw[column.key] = "";
    for (const [index, key] of columnByIndex) {
      raw[key] = cellText(row.getCell(index).value);
    }

    // A row where every mapped cell is blank is spreadsheet padding, not data.
    if (opts.columns.every((column) => !raw[column.key])) return;

    const errors: string[] = [];
    /**
     * Columns this pass already reported on. The schema runs afterwards over
     * the same row and would restate them — "abc" in a money column is both
     * "must be a number" here and "is required" there.
     */
    const reported = new Set<string>();

    const ctx: RowContext<K> = {
      raw,
      fail(message, ...fields) {
        errors.push(message);
        for (const field of fields) reported.add(field);
      },
      number(key, label) {
        if (!raw[key]) return null;
        const value = toNumber(raw[key]);
        if (value == null) ctx.fail(`${label} must be a number`, key);
        return value;
      },
      option(key, options, noun) {
        if (!raw[key]) return null;
        const matched = matchOption(raw[key], options);
        if (!matched) ctx.fail(`"${raw[key]}" isn't a valid ${noun}`, key);
        return matched ?? null;
      },
    };

    const candidate = opts.toCandidate(ctx);

    // The same schema the single-record form posts against, so rules can't drift.
    const parsed = opts.schema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (reported.has(key)) continue;
        const field = opts.columns.find((column) => column.key === key);
        errors.push(field ? `${field.header}: ${issue.message}` : issue.message);
      }
    }

    const uniqueValue = raw[opts.uniqueBy];
    if (uniqueValue) {
      const key = uniqueValue.toLowerCase();
      const firstSeen = seen.get(key);
      if (firstSeen) {
        errors.push(`Duplicate ${opts.uniqueNoun} — same as row ${firstSeen}`);
      } else {
        seen.set(key, rowNumber);
      }
    }

    rows.push({
      rowNumber,
      label: opts.labelOf(raw) || `Row ${rowNumber}`,
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
