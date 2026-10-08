-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT true;

-- Existing leases keep the behaviour they had: the unit's flag at this moment.
UPDATE "Lease" AS lease
   SET "autoRenew" = unit."autoRenew"
  FROM "Unit" AS unit
 WHERE unit.id = lease."unitId";
