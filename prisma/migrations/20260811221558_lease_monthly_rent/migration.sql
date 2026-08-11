-- The agreed monthly rate becomes an explicit column rather than something
-- inferred from `leaseAmount / durationMonths`, so a lease negotiated away
-- from the unit's asking rent can say so.
ALTER TABLE "Lease" ADD COLUMN "monthlyRent" INTEGER;

-- Backfill is exact: every existing leaseAmount was written as
-- `unit.rentAmount * durationMonths`, so dividing recovers the rate used.
UPDATE "Lease"
SET "monthlyRent" = CASE
  WHEN "durationMonths" > 0 THEN "leaseAmount" / "durationMonths"
  ELSE 0
END;

ALTER TABLE "Lease" ALTER COLUMN "monthlyRent" SET NOT NULL;
