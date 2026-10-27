-- Add reference configuration without altering accounts, grants or existing rows.
ALTER TABLE "DistrictMeteredArea"
  ADD COLUMN "city" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "barangay" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "barangayPsgc" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CustomerAccount"
  ADD COLUMN "city" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "barangay" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Tariff"
  ADD COLUMN "customerClass" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
  ADD COLUMN "meterSizeMm" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'PHP',
  ADD COLUMN "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT '2026-01-01 00:00:00',
  ADD COLUMN "effectiveTo" TIMESTAMP(3),
  ADD COLUMN "baseVolumeM3" DECIMAL(12,3) NOT NULL DEFAULT 0,
  ADD COLUMN "baseCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "blocks" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "sourceLabel" TEXT NOT NULL DEFAULT 'Illustrative tariff; not an MCWD rate',
  ADD COLUMN "demoOnly" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WaterQualityParameter"
  ADD COLUMN "standardCode" TEXT NOT NULL DEFAULT 'DEMO-UNREVIEWED',
  ADD COLUMN "standardUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "referenceSection" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "method" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "monitoringIntervalHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_configuration_check" CHECK (
  "currency" = 'PHP' AND "meterSizeMm" > 0 AND "baseVolumeM3" >= 0 AND "baseCharge" >= 0
  AND ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
  AND jsonb_typeof("blocks") = 'array'
);
ALTER TABLE "WaterQualityParameter" ADD CONSTRAINT "WaterQualityParameter_interval_check"
  CHECK ("monitoringIntervalHours" > 0);
