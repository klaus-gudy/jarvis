import { createTenantSchema, type CreateTenantInput } from "@/lib/tenants-schemas";
import {
  buildTemplate,
  parseWorkbook,
  type ImportColumn,
  type ParsedRow,
} from "@/lib/xlsx-import";

const SHEET = "Tenants";

type ColumnKey = "firstName" | "lastName" | "phone" | "email";

/**
 * First and last name are separate columns because that is how people keep
 * tenant lists, but the app stores a single `name` — the two are joined in
 * `toCandidate` and the split is never persisted.
 */
const COLUMNS: ImportColumn<ColumnKey>[] = [
  {
    key: "firstName",
    header: "First name",
    width: 20,
    required: true,
    example: "Neema",
  },
  {
    key: "lastName",
    header: "Last name",
    width: 20,
    required: false,
    example: "Kimaro",
  },
  {
    key: "phone",
    header: "Phone",
    width: 20,
    required: true,
    example: "0712345678",
    // Text, or Excel eats the leading zero and stores 712345678.
    format: "@",
  },
  {
    key: "email",
    header: "Email",
    width: 30,
    required: false,
    example: "neema@example.com",
  },
];

export type ParsedTenantRow = ParsedRow<CreateTenantInput>;

/** "Neema" + "Kimaro" -> "Neema Kimaro"; a missing surname is fine. */
function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
}

export function buildTenantTemplate(organizationName: string) {
  return buildTemplate({
    sheetName: SHEET,
    columns: COLUMNS,
    title: `Import tenants into ${organizationName}`,
    intro:
      "Fill in the Tenants sheet, then upload it back. This sheet is ignored on import.",
    sections: [
      {
        heading: "Phone numbers",
        note: "Any of these shapes works — all are stored as 0712345678:",
        items: ["0712345678", "0712 345 678", "+255712345678", "255712345678"],
      },
    ],
    footnote:
      "First and last name are joined into one full name. Imported tenants can't sign in until you invite them from the Users page.",
  });
}

export function parseTenantWorkbook(buffer: ArrayBuffer) {
  return parseWorkbook<ColumnKey, CreateTenantInput>(buffer, {
    sheetName: SHEET,
    columns: COLUMNS,
    // Phone is the identity here: User.phone is globally unique, so two rows
    // sharing one would fail on the second insert with a confusing message.
    uniqueBy: "phone",
    uniqueNoun: "phone number",
    labelOf: (raw) => fullName(raw.firstName, raw.lastName) || raw.phone,
    schema: createTenantSchema,
    toCandidate: (ctx) => {
      // A General-formatted cell drops the leading zero, leaving 9 digits.
      // Every Tanzanian mobile number is that zero plus these nine.
      const typed = ctx.raw.phone.trim();
      const phone = /^\d{9}$/.test(typed) ? `0${typed}` : typed;

      // A surname alone would satisfy the joined name, so the column's
      // "Required" note has to be enforced here or it isn't true. Also covers
      // `name` so the schema doesn't restate it when both parts are blank.
      if (!ctx.raw.firstName.trim()) {
        ctx.fail("First name is required", "firstName", "name");
      }

      return {
        name: fullName(ctx.raw.firstName, ctx.raw.lastName),
        phone,
        email: ctx.raw.email || undefined,
      };
    },
  });
}
