-- `FileAssetType` stops being an enum and becomes a table.
--
-- Hand-written rather than taken from `migrate diff`, which generates exactly
-- the right shape in exactly the wrong order: it drops "assetType" and adds a
-- NOT NULL "assetTypeId" with nothing in between, which fails on the first
-- existing row and would lose every file's type if it didn't. The order below
-- is seed → backfill → enforce → drop, so no row is ever without a type.
--
-- The old enum and the new table want the same name, and Postgres will not
-- have both (a table creates an implicit composite type). The enum is renamed
-- out of the way first and dropped at the end, once nothing refers to it.

-- CreateEnum
CREATE TYPE "FileAssetSubject" AS ENUM ('ORGANIZATION', 'PROPERTY', 'UNIT', 'MEMBERSHIP', 'LEASE', 'INVOICE', 'PAYMENT');

-- Free the name. "FileAsset"."assetType" keeps working, now typed as _old.
ALTER TYPE "FileAssetType" RENAME TO "FileAssetType_old";

-- CreateTable
CREATE TABLE "FileAssetType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subject" "FileAssetSubject" NOT NULL,
    "allowsMultiple" BOOLEAN NOT NULL DEFAULT true,
    "isPhoto" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT,

    CONSTRAINT "FileAssetType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileAssetType_organizationId_subject_idx" ON "FileAssetType"("organizationId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "FileAssetType_organizationId_key_key" ON "FileAssetType"("organizationId", "key");

-- Postgres treats NULLs as distinct, so the composite unique above does not
-- stop two system rows sharing a key. Prisma's schema language cannot express
-- a partial index, so it is written here.
CREATE UNIQUE INDEX "FileAssetType_system_key_key"
  ON "FileAssetType"("key") WHERE "organizationId" IS NULL;

-- AddForeignKey
ALTER TABLE "FileAssetType" ADD CONSTRAINT "FileAssetType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the seventeen values the enum used to hold, as shared system rows.
--
-- Ids are `sys_<KEY>` rather than generated: the same system type then has the
-- same id in every environment, which makes a dump from production readable
-- against a development database. `allowsMultiple` and `isPhoto` carry over
-- exactly what lib/document-options.ts asserted in code.
--
-- `OTHER` lands under ORGANIZATION rather than being allowed anywhere as it
-- was under the enum. It loses nothing: a per-subject escape hatch is now
-- "add a type", which is the point of this migration.
INSERT INTO "FileAssetType" ("id", "key", "label", "subject", "allowsMultiple", "isPhoto", "isSystem", "updatedAt")
VALUES
  ('sys_BUSINESS_DOCUMENT',   'BUSINESS_DOCUMENT',   'Business document',     'ORGANIZATION', true,  false, true, now()),
  ('sys_OTHER',               'OTHER',               'Other',                 'ORGANIZATION', true,  false, true, now()),

  ('sys_TITLE_DEED',          'TITLE_DEED',          'Title deed',            'PROPERTY',     false, false, true, now()),
  ('sys_PROPERTY_PERMIT',     'PROPERTY_PERMIT',     'Permit',                'PROPERTY',     true,  false, true, now()),
  ('sys_PROPERTY_PHOTO',      'PROPERTY_PHOTO',      'Photo',                 'PROPERTY',     true,  true,  true, now()),

  ('sys_UNIT_DOCUMENT',       'UNIT_DOCUMENT',       'Unit document',         'UNIT',         true,  false, true, now()),
  ('sys_UNIT_PHOTO',          'UNIT_PHOTO',          'Photo',                 'UNIT',         true,  true,  true, now()),

  ('sys_NIDA',                'NIDA',                'NIDA',                  'MEMBERSHIP',   false, false, true, now()),
  ('sys_PASSPORT',            'PASSPORT',            'Passport',              'MEMBERSHIP',   false, false, true, now()),
  ('sys_EMPLOYMENT_DOCUMENT', 'EMPLOYMENT_DOCUMENT', 'Employment document',   'MEMBERSHIP',   false, false, true, now()),
  ('sys_TENANT_DOCUMENT',     'TENANT_DOCUMENT',     'Other tenant document', 'MEMBERSHIP',   true,  false, true, now()),

  ('sys_LEASE_AGREEMENT',     'LEASE_AGREEMENT',     'Signed agreement',      'LEASE',        false, false, true, now()),
  ('sys_LEASE_AMENDMENT',     'LEASE_AMENDMENT',     'Amendment',             'LEASE',        true,  false, true, now()),
  ('sys_LEASE_RENEWAL',       'LEASE_RENEWAL',       'Renewal',               'LEASE',        true,  false, true, now()),
  ('sys_LEASE_TERMINATION',   'LEASE_TERMINATION',   'Termination notice',    'LEASE',        false, false, true, now()),

  ('sys_INVOICE_DOCUMENT',    'INVOICE_DOCUMENT',    'Invoice',               'INVOICE',      false, false, true, now()),

  ('sys_PAYMENT_RECEIPT',     'PAYMENT_RECEIPT',     'Receipt',               'PAYMENT',      false, false, true, now()),
  ('sys_PAYMENT_PROOF',       'PAYMENT_PROOF',       'Proof of payment',      'PAYMENT',      false, false, true, now())
ON CONFLICT DO NOTHING;

-- Nullable first, so existing rows survive long enough to be pointed at a type.
ALTER TABLE "FileAsset" ADD COLUMN "assetTypeId" TEXT;

-- Backfill by key. The enum's text is exactly the key it was seeded under, so
-- every existing row finds its type.
UPDATE "FileAsset" AS f
SET "assetTypeId" = t."id"
FROM "FileAssetType" AS t
WHERE t."organizationId" IS NULL
  AND t."key" = f."assetType"::text;

-- Refuse to continue if anything failed to match, rather than discovering it
-- as a NOT NULL violation with no indication of which row or why.
DO $$
DECLARE orphans INT;
BEGIN
  SELECT count(*) INTO orphans FROM "FileAsset" WHERE "assetTypeId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'FileAsset backfill missed % row(s): an assetType has no seeded FileAssetType', orphans;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "FileAsset" ALTER COLUMN "assetTypeId" SET NOT NULL;

-- AddForeignKey. RESTRICT, not CASCADE: deleting a type that files still point
-- at must fail loudly, not take the files with it.
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_assetTypeId_fkey" FOREIGN KEY ("assetTypeId") REFERENCES "FileAssetType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "FileAsset_assetTypeId_idx" ON "FileAsset"("assetTypeId");

-- Now nothing refers to the old enum.
ALTER TABLE "FileAsset" DROP COLUMN "assetType";
DROP TYPE "FileAssetType_old";
