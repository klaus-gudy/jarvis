import { z } from "zod";

import { AMENITY_OPTIONS, CATEGORY_OPTIONS } from "@/lib/property-options";

// Owner is deliberately absent: it is derived from the organization's Owner-role
// member, so accepting it as input would let a client contradict the source.
export const createPropertySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(["RESIDENTIAL", "COMMERCIAL"]),
  category: z.enum(CATEGORY_OPTIONS),
  address: z.string().trim().min(1, "Location is required").max(200),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  description: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => (value ? value : null)),
  amenities: z.array(z.enum(AMENITY_OPTIONS)).default([]),
});

/** Every field optional so PATCH can carry only what changed. */
export const updatePropertySchema = createPropertySchema.partial();

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
