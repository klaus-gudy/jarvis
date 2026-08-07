import { z } from "zod";

import { UNIT_AMENITY_OPTIONS, UNIT_TYPE_OPTIONS } from "@/lib/unit-options";

/**
 * Empty strings arrive from untouched form inputs and mean "not provided".
 * Accepts null as well as undefined so the schema stays idempotent: it emits
 * null for a blank field, and the bulk importer re-submits its own parsed
 * output to the create endpoint, which validates it a second time.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const createUnitSchema = z.object({
  label: z.string().trim().min(1, "Unit name is required").max(60),
  rentAmount: z
    .number({ error: "Monthly rate is required" })
    .int("Monthly rate must be a whole number")
    .min(0, "Monthly rate cannot be negative")
    .max(2_000_000_000, "Monthly rate is too large"),
  minTenureMonths: z
    .number()
    .int("Minimum tenure must be a whole number of months")
    .min(1, "Minimum tenure must be at least 1 month")
    .max(120, "Minimum tenure cannot exceed 120 months")
    .nullish(),
  unitType: z.enum(UNIT_TYPE_OPTIONS).nullish(),
  floor: optionalText(30),
  block: optionalText(30),
  sizeSqm: z
    .number()
    .positive("Size must be greater than 0")
    .max(100_000, "Size is too large")
    .nullish(),
  amenities: z.array(z.enum(UNIT_AMENITY_OPTIONS)).default([]),
});

export const updateUnitSchema = createUnitSchema.partial();

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
