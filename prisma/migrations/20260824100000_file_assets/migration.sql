-- CreateEnum
CREATE TYPE "FileAssetType" AS ENUM ('BUSINESS_DOCUMENT', 'TITLE_DEED', 'PROPERTY_PERMIT', 'PROPERTY_PHOTO', 'UNIT_DOCUMENT', 'NIDA', 'PASSPORT', 'EMPLOYMENT_DOCUMENT', 'TENANT_DOCUMENT', 'LEASE_AGREEMENT', 'LEASE_AMENDMENT', 'LEASE_RENEWAL', 'LEASE_TERMINATION', 'INVOICE_DOCUMENT', 'PAYMENT_RECEIPT', 'PAYMENT_PROOF', 'OTHER');

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "assetType" "FileAssetType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "propertyId" TEXT,
    "unitId" TEXT,
    "membershipId" TEXT,
    "leaseId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_objectKey_key" ON "FileAsset"("objectKey");

-- CreateIndex
CREATE INDEX "FileAsset_organizationId_createdAt_idx" ON "FileAsset"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "FileAsset_propertyId_idx" ON "FileAsset"("propertyId");

-- CreateIndex
CREATE INDEX "FileAsset_unitId_idx" ON "FileAsset"("unitId");

-- CreateIndex
CREATE INDEX "FileAsset_membershipId_idx" ON "FileAsset"("membershipId");

-- CreateIndex
CREATE INDEX "FileAsset_leaseId_idx" ON "FileAsset"("leaseId");

-- CreateIndex
CREATE INDEX "FileAsset_invoiceId_idx" ON "FileAsset"("invoiceId");

-- CreateIndex
CREATE INDEX "FileAsset_paymentId_idx" ON "FileAsset"("paymentId");

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one subject column may be set. Prisma's schema language cannot
-- express this, so it is hand-written: without it a row could be filed under a
-- lease *and* a property at once and every read path would have to guess which
-- one it meant.
--
-- `<= 1`, not `= 1`: zero is the organization-level case. A business licence
-- belongs to the organization and to nothing else, and "organizationId" is
-- already NOT NULL, so such a row is still fully owned.
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_at_most_one_owner" CHECK (
    ("propertyId" IS NOT NULL)::integer
  + ("unitId" IS NOT NULL)::integer
  + ("membershipId" IS NOT NULL)::integer
  + ("leaseId" IS NOT NULL)::integer
  + ("invoiceId" IS NOT NULL)::integer
  + ("paymentId" IS NOT NULL)::integer
  <= 1
);
