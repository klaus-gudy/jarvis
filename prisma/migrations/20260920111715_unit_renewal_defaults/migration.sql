-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "minTenureMonths" SET DEFAULT 6,
ALTER COLUMN "autoRenew" SET DEFAULT true;

-- Existing units, brought up to the same defaults.
--
-- 0 is treated as "unset", not as a real term: it is what the column held on
-- every live unit, and a zero-month renewal would write a lease that ends the
-- day it starts. A unit with a genuine tenure already set keeps it.
UPDATE "Unit" SET "minTenureMonths" = 6
WHERE "minTenureMonths" IS NULL OR "minTenureMonths" <= 0;

-- Auto-renew becomes the rule rather than the exception, for units that exist
-- as well as ones created from now on.
UPDATE "Unit" SET "autoRenew" = true WHERE "autoRenew" = false;
