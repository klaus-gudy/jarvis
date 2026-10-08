-- AlterTable
ALTER TABLE "PaymentClaim" ADD COLUMN     "receiptId" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentClaim_receiptId_key" ON "PaymentClaim"("receiptId");

-- AddForeignKey
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The receipt a tenant attaches to a reported payment, filed on the invoice.
-- Several per invoice (one per claim), so `allowsMultiple = true`.
INSERT INTO "FileAssetType" ("id", "key", "label", "subject", "allowsMultiple", "isPhoto", "isSystem", "updatedAt")
VALUES ('sys_CLAIM_RECEIPT', 'CLAIM_RECEIPT', 'Tenant receipt', 'INVOICE', true, false, true, now())
ON CONFLICT DO NOTHING;
