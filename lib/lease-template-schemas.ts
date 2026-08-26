import { z } from "zod";

import { LEASE_TEMPLATE_LANGUAGE_VALUES } from "@/lib/lease-template-options";

/**
 * 200 KB of HTML. A tenancy agreement is a few pages; anything past this is a
 * pasted Word export dragging its image data along, which belongs in the file
 * store rather than in a text column.
 */
const MAX_BODY = 200_000;

export const createLeaseTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Template name is required")
    .max(80, "Template name is too long"),
  description: z
    .string()
    .trim()
    .max(200, "Description is too long")
    .nullish()
    .transform((value) => (value ? value : null)),
  language: z.enum(LEASE_TEMPLATE_LANGUAGE_VALUES, {
    error: "Select a language",
  }),
  body: z
    .string()
    .trim()
    .min(1, "The template body cannot be empty")
    .max(MAX_BODY, "The template body is too large"),
  /**
   * Optional on the way in: the first template an organization saves becomes
   * its default whatever this says, since a lone template that isn't the
   * default is a setting nobody meant to make.
   */
  isDefault: z.boolean().optional(),
});

export type CreateLeaseTemplateInput = z.infer<typeof createLeaseTemplateSchema>;

/** Editing takes the same decisions as creating, so it validates identically. */
export const updateLeaseTemplateSchema = createLeaseTemplateSchema;

export type UpdateLeaseTemplateInput = z.infer<typeof updateLeaseTemplateSchema>;
