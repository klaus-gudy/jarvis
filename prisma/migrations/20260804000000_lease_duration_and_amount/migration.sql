-- AlterTable: add nullable first so existing rows aren't rejected, backfill, then tighten.
ALTER TABLE "Lease" ADD COLUMN     "durationMonths" INTEGER,
ADD COLUMN     "leaseAmount" INTEGER;

-- Backfill existing rows: approximate duration from the actual date span
-- (existing leases predate the duration-driven form), then derive the amount
-- from the unit's current rent.
UPDATE "Lease"
SET "durationMonths" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ("endDate" - "startDate")) / (86400 * 30.44))::int)
WHERE "durationMonths" IS NULL;

UPDATE "Lease" AS l
SET "leaseAmount" = u."rentAmount" * l."durationMonths"
FROM "Unit" AS u
WHERE u.id = l."unitId" AND l."leaseAmount" IS NULL;

ALTER TABLE "Lease" ALTER COLUMN "durationMonths" SET NOT NULL,
ALTER COLUMN "leaseAmount" SET NOT NULL;
