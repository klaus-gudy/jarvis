-- AlterTable
ALTER TABLE "User" ADD COLUMN     "toursSeen" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "toursSeenVersion" INTEGER NOT NULL DEFAULT 0;
