import { z } from "zod";

import { tzPhoneSchema } from "@/lib/phone";

/**
 * Editing a member updates the underlying User. Phone stays mandatory, matching
 * every other place a member is created — an edit must not be a way to strip it.
 */
export const updateMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: tzPhoneSchema,
  email: z
    .literal("")
    .transform(() => undefined)
    .or(z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")))
    .optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
