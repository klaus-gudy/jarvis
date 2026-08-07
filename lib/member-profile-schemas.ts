import { z } from "zod";

import { optionalTzPhoneSchema } from "@/lib/phone";

/**
 * Every field here is optional by design — this record only ever adds context
 * to a member. Blank inputs are normalised to null so clearing a field stores
 * nothing rather than an empty string.
 *
 * nullish, not optional: the transform emits null, so accepting only
 * string|undefined would leave the schema unable to re-parse its own output.
 * See the decision log entry for 2026-08-08.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

export const updateMemberProfileSchema = z.object({
  occupation: optionalText(80),
  nidaNumber: optionalText(40),
  employer: optionalText(120),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalTzPhoneSchema,
  emergencyContactRelation: optionalText(40),
});

export type UpdateMemberProfileInput = z.infer<typeof updateMemberProfileSchema>;
