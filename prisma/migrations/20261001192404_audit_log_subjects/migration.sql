-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "AuditLog_subjects_idx" ON "AuditLog" USING GIN ("subjects");
