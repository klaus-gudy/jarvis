import { UNIT_TYPE_OPTIONS } from "@/lib/unit-options";
import { createUnitSchema, type CreateUnitInput } from "@/lib/units-schemas";
import {
  buildTemplate,
  parseWorkbook,
  type ImportColumn,
  type ParsedRow,
} from "@/lib/xlsx-import";

const SHEET = "Units";

type ColumnKey =
  | "label"
  | "rentAmount"
  | "unitType"
  | "floor"
  | "block"
  | "minTenureMonths";

/**
 * The single source of truth for the template's shape. The generator writes
 * these headers and the parser matches against them, so a column can never be
 * added to one side only.
 *
 * Size and amenities are deliberately absent: both are still on the unit form,
 * they just aren't worth a spreadsheet column yet. Adding either back means a
 * row here plus its handling in `toCandidate` — nothing else.
 */
const COLUMNS: ImportColumn<ColumnKey>[] = [
  { key: "label", header: "Unit name", width: 18, required: true, example: "A1" },
  {
    key: "rentAmount",
    header: "Monthly rate (TZS)",
    width: 20,
    required: true,
    example: "450000",
  },
  {
    key: "unitType",
    header: "Unit type",
    width: 16,
    required: false,
    example: "2 Bedroom",
    options: UNIT_TYPE_OPTIONS,
  },
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

export type ParsedUnitRow = ParsedRow<CreateUnitInput>;

export function buildUnitTemplate(propertyName: string) {
  return buildTemplate({
    sheetName: SHEET,
    columns: COLUMNS,
    title: `Import units into ${propertyName}`,
    intro:
      "Fill in the Units sheet, then upload it back. This sheet is ignored on import.",
    sections: [
      {
        heading: "Valid unit types",
        note: "Pick from the dropdown in the Units sheet.",
        items: UNIT_TYPE_OPTIONS,
      },
    ],
    footnote:
      "Size and amenities aren't imported — add them per unit afterwards.",
  });
}

export function parseUnitWorkbook(buffer: ArrayBuffer) {
  return parseWorkbook<ColumnKey, CreateUnitInput>(buffer, {
    sheetName: SHEET,
    columns: COLUMNS,
    uniqueBy: "label",
    uniqueNoun: "unit name",
    labelOf: (raw) => raw.label,
    schema: createUnitSchema,
    toCandidate: (ctx) => ({
      label: ctx.raw.label,
      rentAmount: ctx.number("rentAmount", "Monthly rate"),
      minTenureMonths: ctx.number("minTenureMonths", "Minimum tenure"),
      unitType: ctx.option("unitType", UNIT_TYPE_OPTIONS, "unit type"),
      floor: ctx.raw.floor || undefined,
      block: ctx.raw.block || undefined,
      // Not columns in the template — an imported unit simply starts without them.
      sizeSqm: null,
      amenities: [],
    }),
  });
}
