-- AlterTable
ALTER TABLE "MemberProfile" ADD COLUMN     "nationality" TEXT;

-- CreateTable
CREATE TABLE "LeaseTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "LeaseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaseTemplate_organizationId_idx" ON "LeaseTemplate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseTemplate_organizationId_name_key" ON "LeaseTemplate"("organizationId", "name");

-- AddForeignKey
ALTER TABLE "LeaseTemplate" ADD CONSTRAINT "LeaseTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one default template per organization. `lib/lease-templates.ts`
-- clears the flag on every sibling inside the same transaction as a write, but
-- two concurrent writes would each pass that check and both land; Prisma's
-- schema language cannot express a partial index, so it is written here.
CREATE UNIQUE INDEX "LeaseTemplate_organizationId_default_key"
  ON "LeaseTemplate"("organizationId") WHERE "isDefault";
