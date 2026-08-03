import { z } from "zod";

/**
 * Editing a member updates the underlying User. Phone stays mandatory, matching
 * every other place a member is created — an edit must not be a way to strip it.
 */
export const updateMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number (digits only, optional +)"),
  email: z
    .literal("")
    .transform(() => undefined)
    .or(z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")))
    .optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
