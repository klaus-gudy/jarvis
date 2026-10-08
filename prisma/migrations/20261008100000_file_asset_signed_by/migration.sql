-- AlterTable
ALTER TABLE "FileAsset" ADD COLUMN     "signedBy" TEXT[] DEFAULT ARRAY[]::TEXT[];

