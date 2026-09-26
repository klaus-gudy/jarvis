-- CreateEnum
CREATE TYPE "RoleKind" AS ENUM ('OWNER', 'STAFF', 'TENANT');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "kind" "RoleKind" NOT NULL DEFAULT 'STAFF',
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];


-- Backfill: the built-ins were matched by name (trimmed, case-insensitive) in
-- code until now, so classify them the same way.
UPDATE "Role" SET "kind" = 'OWNER'  WHERE lower(trim("name")) = 'owner';
UPDATE "Role" SET "kind" = 'TENANT' WHERE lower(trim("name")) = 'tenant';

-- Every other role predates permissions and could reach every page. Give it
-- the Manager template so nobody loses access on deploy; owners tighten it
-- from the Roles page.
UPDATE "Role" SET "permissions" = ARRAY['dashboard:read', 'property:read', 'property:write', 'tenant:read', 'tenant:write', 'lease:read', 'lease:write', 'lease:delete', 'contract:generate', 'payment:read', 'payment:record', 'payment:reverse', 'document:read', 'document:write', 'member:read', 'member:write', 'member:invite', 'sms:send', 'template:manage', 'export:run']::TEXT[]
WHERE "kind" = 'STAFF';

-- At most one Owner role and one Tenant role per organization.
CREATE UNIQUE INDEX "Role_organizationId_builtin_kind_key"
  ON "Role" ("organizationId", "kind")
  WHERE "kind" IN ('OWNER', 'TENANT');
