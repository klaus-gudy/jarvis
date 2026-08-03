-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "amenities" TEXT[],
ADD COLUMN     "block" TEXT,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "minTenureMonths" INTEGER,
ADD COLUMN     "sizeSqm" DOUBLE PRECISION,
ADD COLUMN     "unitType" TEXT;

