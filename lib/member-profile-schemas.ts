import { z } from "zod";

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

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine(
    (value) => value === null || /^\+?[0-9]{7,15}$/.test(value),
    "Enter a valid phone number (digits only, optional +)"
  );

export const updateMemberProfileSchema = z.object({
  occupation: optionalText(80),
  nidaNumber: optionalText(40),
  employer: optionalText(120),
  emergencyContactName: optionalText(100),
  emergencyContactPhone: optionalPhone,
  emergencyContactRelation: optionalText(40),
});

export type UpdateMemberProfileInput = z.infer<typeof updateMemberProfileSchema>;
