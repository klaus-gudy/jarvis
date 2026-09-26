import { z } from "zod";

/**
 * Prisma-free so the role dialog can share it. Permission strings are checked
 * against the catalogue in `lib/roles.ts` (`parsePermissions`), not here, so a
 * permission retired from the code is dropped rather than rejected.
 */
const name = z.string().trim().min(1, "Role name is required").max(40);
const permissions = z.array(z.string().max(64)).max(100);

export const createRoleSchema = z.object({
  name,
  permissions: permissions.default([]),
});

export const updateRoleSchema = z
  .object({ name: name.optional(), permissions: permissions.optional() })
  .refine((v) => v.name !== undefined || v.permissions !== undefined, {
    message: "Nothing to change",
  });

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
