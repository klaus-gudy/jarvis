-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('Upcoming', 'Active', 'Ended');

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "status" "LeaseStatus" NOT NULL DEFAULT 'Active';

-- CreateIndex
CREATE INDEX "Lease_status_endDate_idx" ON "Lease"("status", "endDate");

-- Backfill from the dates, using the same rule leaseStatus() applied on read.
UPDATE "Lease" SET "status" = CASE
  WHEN "startDate" > now() THEN 'Upcoming'::"LeaseStatus"
  WHEN "endDate" < now() THEN 'Ended'::"LeaseStatus"
  ELSE 'Active'::"LeaseStatus"
END;
