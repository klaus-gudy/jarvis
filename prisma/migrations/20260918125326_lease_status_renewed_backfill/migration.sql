-- A lease with a successor is Renewed, not merely Ended. Separate from the
-- enum change: Postgres can't use a new enum value in the transaction that adds it.
UPDATE "Lease" SET "status" = 'Renewed'
WHERE "id" IN (SELECT "renewedFromId" FROM "Lease" WHERE "renewedFromId" IS NOT NULL);
