-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "ownerName" TEXT NOT NULL,
ADD COLUMN     "type" "PropertyType" NOT NULL;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "rentAmount" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Property_organizationId_idx" ON "Property"("organizationId");

-- CreateIndex
CREATE INDEX "Unit_propertyId_idx" ON "Unit"("propertyId");

