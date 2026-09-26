import { z } from "zod";

/**
 * Prisma-free so the role dialog can share it. Permission strings are checked
 * against the catalogue in `lib/roles.ts` (`parsePermissions`), not here, so a
 * permission retired from the code is dropped rather than rejected.
 */
const name = z.string().trim().min(1, "Role name is required").max(40);
const permissions = z.array(z.string().max(64)).max(100);
/** Blank clears it (built-ins fall back to their default wording). */
const description = z
  .string()
  .trim()
  .max(200, "Keep it under 200 characters")
  .transform((value) => value || null)
  .nullish();

export const createRoleSchema = z.object({
  name,
  description,
  permissions: permissions.default([]),
});

export const updateRoleSchema = z
  .object({ name: name.optional(), description, permissions: permissions.optional() })
  .refine((v) => v.name !== undefined || v.description !== undefined || v.permissions !== undefined, {
    message: "Nothing to change",
  });

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
