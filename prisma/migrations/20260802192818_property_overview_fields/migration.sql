-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "amenities" TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE';

