-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "status" "UnitStatus" NOT NULL DEFAULT 'ACTIVE';
