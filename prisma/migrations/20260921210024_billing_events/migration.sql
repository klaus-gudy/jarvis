-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT,
    "amount" INTEGER,
    "currency" TEXT,
    "provider" TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "plan" TEXT,
    "billing" TEXT,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_eventId_key" ON "BillingEvent"("eventId");

-- CreateIndex
CREATE INDEX "BillingEvent_reference_idx" ON "BillingEvent"("reference");

-- CreateIndex
CREATE INDEX "BillingEvent_customerEmail_idx" ON "BillingEvent"("customerEmail");

-- CreateIndex
CREATE INDEX "BillingEvent_type_receivedAt_idx" ON "BillingEvent"("type", "receivedAt");
