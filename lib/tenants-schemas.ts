import { z } from "zod";

import { tzPhoneSchema } from "@/lib/phone";

/**
 * Assisted onboarding: staff record a tenant on their behalf, so phone is the
 * required identifier and email is optional. No password field — the account
 * cannot sign in until it's invited from the Users page.
 */
export const createTenantSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: tzPhoneSchema,
  email: z
    .literal("")
    .transform(() => undefined)
    .or(z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")))
    .optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;
