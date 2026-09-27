import { z } from "zod";

import { updateMemberProfileSchema } from "@/lib/member-profile-schemas";

/**
 * What a tenant may change about themself from the portal. Email, phone and
 * NIDA are left out on purpose: the first two are how they sign in (and a new
 * email would need re-verifying), the third is identity data the landlord
 * records. `strict` so a request carrying any of them — or a `roleId` — is
 * refused rather than silently trimmed.
 */
export const updateOwnProfileSchema = updateMemberProfileSchema
  .omit({ nidaNumber: true })
  .extend({ name: z.string().trim().min(1, "Name is required").max(100) })
  .strict();

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
