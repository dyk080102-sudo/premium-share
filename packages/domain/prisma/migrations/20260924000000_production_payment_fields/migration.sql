-- Production payment fields + PG BusinessSource (PG SDK deferred)

ALTER TYPE "BusinessSource" ADD VALUE 'PG';

ALTER TABLE "orders" ALTER COLUMN "source" SET DEFAULT 'MANUAL';

ALTER TABLE "payments" ALTER COLUMN "source" SET DEFAULT 'MANUAL';
ALTER TABLE "payments" ADD COLUMN "provider" TEXT;
ALTER TABLE "payments" ADD COLUMN "externalPaymentId" TEXT;
ALTER TABLE "payments" ADD COLUMN "depositorName" TEXT;
ALTER TABLE "payments" ADD COLUMN "notes" TEXT;

CREATE INDEX "payments_depositorName_idx" ON "payments"("depositorName");
CREATE INDEX "payments_externalPaymentId_idx" ON "payments"("externalPaymentId");
