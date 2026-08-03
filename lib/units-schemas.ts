import { z } from "zod";

import { UNIT_AMENITY_OPTIONS, UNIT_TYPE_OPTIONS } from "@/lib/unit-options";

/** Empty strings arrive from untouched form inputs and mean "not provided". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const createUnitSchema = z.object({
  label: z.string().trim().min(1, "Unit name is required").max(60),
  rentAmount: z
    .number({ error: "Monthly rate is required" })
    .int("Monthly rate must be a whole number")
    .min(0, "Monthly rate cannot be negative")
    .max(2_000_000_000),
  minTenureMonths: z
    .number()
    .int()
    .min(1, "Minimum tenure must be at least 1 month")
    .max(120)
    .nullish(),
  unitType: z.enum(UNIT_TYPE_OPTIONS).nullish(),
  floor: optionalText(30),
  block: optionalText(30),
  sizeSqm: z.number().positive("Size must be greater than 0").max(100_000).nullish(),
  amenities: z.array(z.enum(UNIT_AMENITY_OPTIONS)).default([]),
});

export const updateUnitSchema = createUnitSchema.partial();

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
