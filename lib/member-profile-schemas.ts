import { z } from "zod";

import { optionalTzPhoneSchema } from "@/lib/phone";

/**
 * Every field here is optional by design — this record only ever adds context
 * to a member. Blank inputs are normalised to null so clearing a field stores
 * nothing rather than an empty string.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
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
