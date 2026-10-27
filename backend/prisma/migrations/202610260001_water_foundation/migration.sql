-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Classification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "Remediation" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ReadType" AS ENUM ('ACTUAL', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('OPEN', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REPLACED');

-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('TREATMENT_PLANT', 'PUMP_STATION', 'RESERVOIR');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataDomain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "steward" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "steward" TEXT NOT NULL,
    "classification" "Classification" NOT NULL,
    "containsPii" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL,
    "policy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSystem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "freshnessHours" INTEGER NOT NULL DEFAULT 24,
    "lastSuccessAt" TIMESTAMP(3),
    "cursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cursor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "initiatedBy" TEXT NOT NULL,

    CONSTRAINT "IntegrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLock" (
    "sourceSystemId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationLock_pkey" PRIMARY KEY ("sourceSystemId")
);

-- CreateTable
CREATE TABLE "RawImportRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "sourceRecordId" TEXT,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "canonicalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationRecordError" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rawRecordId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "remediation" "Remediation" NOT NULL DEFAULT 'OPEN',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationRecordError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DQRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "description" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DQRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DQRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "RunStatus" NOT NULL DEFAULT 'RUNNING',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "checked" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "initiatedBy" TEXT NOT NULL,

    CONSTRAINT "DQRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DQResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "checked" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "samples" JSONB NOT NULL,
    "remediation" "Remediation" NOT NULL DEFAULT 'OPEN',
    "remediationNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DQResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "requestId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistrictMeteredArea" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connections" INTEGER NOT NULL,
    "diagramX" DOUBLE PRECISION NOT NULL,
    "diagramY" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistrictMeteredArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tariff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePerM3" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "dmaId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "MeterStatus" NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "replacedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeterReading" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "meterId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "previousM3" DECIMAL(16,3) NOT NULL,
    "currentM3" DECIMAL(16,3) NOT NULL,
    "consumptionM3" DECIMAL(16,3) NOT NULL,
    "readType" "ReadType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "replacementRecorded" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeterReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "meterReadingId" TEXT NOT NULL,
    "dmaId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "billedM3" DECIMAL(16,3) NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dmaId" TEXT NOT NULL,
    "type" "FacilityType" NOT NULL,
    "capacityM3Day" DECIMAL(16,3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionReading" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "dmaId" TEXT NOT NULL,
    "volumeM3" DECIMAL(16,3) NOT NULL,
    "flowLs" DOUBLE PRECISION NOT NULL,
    "pressureBar" DOUBLE PRECISION NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "isSystemInput" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineAsset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "dmaId" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "diameterMm" DOUBLE PRECISION NOT NULL,
    "lengthM" DOUBLE PRECISION NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SamplingPoint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dmaId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SamplingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterQualityParameter" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "plausibleMin" DOUBLE PRECISION NOT NULL,
    "plausibleMax" DOUBLE PRECISION NOT NULL,
    "limitMin" DOUBLE PRECISION NOT NULL,
    "limitMax" DOUBLE PRECISION NOT NULL,
    "guidance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterQualityParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterQualityResult" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "sampleReference" TEXT NOT NULL,
    "samplingPointId" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "sampledAt" TIMESTAMP(3) NOT NULL,
    "enteredBy" TEXT NOT NULL,
    "correctiveActionId" TEXT,
    "correctionVersion" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterQualityResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dmaId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" "Severity" NOT NULL,
    "status" "WorkStatus" NOT NULL,
    "previousStatus" TEXT,
    "assignee" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeakReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "dmaId" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "workOrderId" TEXT,
    "location" TEXT NOT NULL,
    "estimatedLossM3Day" DOUBLE PRECISION NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeakReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerComplaint" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceSystemId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "dmaId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "customerAlias" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL,
    "previousStatus" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_organizationId_code_key" ON "Role"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_roleId_code_key" ON "Permission"("roleId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataDomain_organizationId_code_key" ON "DataDomain"("organizationId", "code");

-- CreateIndex
CREATE INDEX "DataAsset_organizationId_domainId_idx" ON "DataAsset"("organizationId", "domainId");

-- CreateIndex
CREATE UNIQUE INDEX "DataAsset_organizationId_sourceSystemId_entity_key" ON "DataAsset"("organizationId", "sourceSystemId", "entity");

-- CreateIndex
CREATE INDEX "SourceSystem_organizationId_lastSuccessAt_idx" ON "SourceSystem"("organizationId", "lastSuccessAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSystem_organizationId_code_key" ON "SourceSystem"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_sourceSystemId_adapter_key" ON "IntegrationConnection"("sourceSystemId", "adapter");

-- CreateIndex
CREATE INDEX "IntegrationRun_organizationId_startedAt_idx" ON "IntegrationRun"("organizationId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationRun_organizationId_sourceSystemId_idempotencyKey_key" ON "IntegrationRun"("organizationId", "sourceSystemId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "RawImportRecord_organizationId_sourceRecordId_idx" ON "RawImportRecord"("organizationId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "RawImportRecord_runId_rowNumber_key" ON "RawImportRecord"("runId", "rowNumber");

-- CreateIndex
CREATE INDEX "IntegrationRecordError_organizationId_remediation_idx" ON "IntegrationRecordError"("organizationId", "remediation");

-- CreateIndex
CREATE UNIQUE INDEX "DQRule_organizationId_code_key" ON "DQRule"("organizationId", "code");

-- CreateIndex
CREATE INDEX "DQRun_organizationId_startedAt_idx" ON "DQRun"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "DQResult_organizationId_remediation_idx" ON "DQResult"("organizationId", "remediation");

-- CreateIndex
CREATE UNIQUE INDEX "DQResult_runId_ruleId_key" ON "DQResult"("runId", "ruleId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_action_idx" ON "AuditEvent"("organizationId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "DistrictMeteredArea_organizationId_code_key" ON "DistrictMeteredArea"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "DistrictMeteredArea_organizationId_id_key" ON "DistrictMeteredArea"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_organizationId_code_key" ON "Tariff"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_organizationId_id_key" ON "Tariff"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_organizationId_sourceSystemId_sourceRecordI_key" ON "CustomerAccount"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_organizationId_accountNumber_key" ON "CustomerAccount"("organizationId", "accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_organizationId_id_key" ON "CustomerAccount"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ServiceConnection_organizationId_dmaId_idx" ON "ServiceConnection"("organizationId", "dmaId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConnection_organizationId_sourceSystemId_sourceRecor_key" ON "ServiceConnection"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConnection_organizationId_code_key" ON "ServiceConnection"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConnection_organizationId_id_key" ON "ServiceConnection"("organizationId", "id");

-- CreateIndex
CREATE INDEX "Meter_organizationId_connectionId_idx" ON "Meter"("organizationId", "connectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Meter_organizationId_sourceSystemId_sourceRecordId_key" ON "Meter"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Meter_organizationId_serialNumber_key" ON "Meter"("organizationId", "serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Meter_organizationId_id_key" ON "Meter"("organizationId", "id");

-- CreateIndex
CREATE INDEX "MeterReading_organizationId_occurredAt_idx" ON "MeterReading"("organizationId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_organizationId_sourceSystemId_sourceRecordId_key" ON "MeterReading"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_organizationId_meterId_periodStart_periodEnd_key" ON "MeterReading"("organizationId", "meterId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "MeterReading_organizationId_id_key" ON "MeterReading"("organizationId", "id");

-- CreateIndex
CREATE INDEX "BillingRecord_organizationId_dmaId_periodStart_periodEnd_idx" ON "BillingRecord"("organizationId", "dmaId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_organizationId_sourceSystemId_sourceRecordId_key" ON "BillingRecord"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_organizationId_reference_key" ON "BillingRecord"("organizationId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_organizationId_meterReadingId_key" ON "BillingRecord"("organizationId", "meterReadingId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_organizationId_id_key" ON "BillingRecord"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_organizationId_sourceSystemId_sourceRecordId_key" ON "Facility"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_organizationId_code_key" ON "Facility"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Facility_organizationId_id_key" ON "Facility"("organizationId", "id");

-- CreateIndex
CREATE INDEX "ProductionReading_organizationId_dmaId_periodStart_periodEn_idx" ON "ProductionReading"("organizationId", "dmaId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionReading_organizationId_sourceSystemId_sourceRecor_key" ON "ProductionReading"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionReading_organizationId_facilityId_periodStart_per_key" ON "ProductionReading"("organizationId", "facilityId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionReading_organizationId_id_key" ON "ProductionReading"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineAsset_organizationId_sourceSystemId_sourceRecordId_key" ON "PipelineAsset"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineAsset_organizationId_code_key" ON "PipelineAsset"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineAsset_organizationId_id_key" ON "PipelineAsset"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SamplingPoint_organizationId_sourceSystemId_sourceRecordId_key" ON "SamplingPoint"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "SamplingPoint_organizationId_code_key" ON "SamplingPoint"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "SamplingPoint_organizationId_id_key" ON "SamplingPoint"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WaterQualityParameter_organizationId_code_key" ON "WaterQualityParameter"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WaterQualityParameter_organizationId_id_key" ON "WaterQualityParameter"("organizationId", "id");

-- CreateIndex
CREATE INDEX "WaterQualityResult_organizationId_sampledAt_idx" ON "WaterQualityResult"("organizationId", "sampledAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaterQualityResult_organizationId_sourceSystemId_sourceReco_key" ON "WaterQualityResult"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "WaterQualityResult_organizationId_sampleReference_parameter_key" ON "WaterQualityResult"("organizationId", "sampleReference", "parameterId");

-- CreateIndex
CREATE UNIQUE INDEX "WaterQualityResult_organizationId_id_key" ON "WaterQualityResult"("organizationId", "id");

-- CreateIndex
CREATE INDEX "WorkOrder_organizationId_status_idx" ON "WorkOrder"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_organizationId_sourceSystemId_sourceRecordId_key" ON "WorkOrder"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_organizationId_reference_key" ON "WorkOrder"("organizationId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_organizationId_id_key" ON "WorkOrder"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "LeakReport_organizationId_sourceSystemId_sourceRecordId_key" ON "LeakReport"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "LeakReport_organizationId_reference_key" ON "LeakReport"("organizationId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "LeakReport_organizationId_id_key" ON "LeakReport"("organizationId", "id");

-- CreateIndex
CREATE INDEX "CustomerComplaint_organizationId_status_idx" ON "CustomerComplaint"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerComplaint_organizationId_sourceSystemId_sourceRecor_key" ON "CustomerComplaint"("organizationId", "sourceSystemId", "sourceRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerComplaint_organizationId_reference_key" ON "CustomerComplaint"("organizationId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerComplaint_organizationId_id_key" ON "CustomerComplaint"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataDomain" ADD CONSTRAINT "DataDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "DataDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataAsset" ADD CONSTRAINT "DataAsset_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSystem" ADD CONSTRAINT "SourceSystem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationRun" ADD CONSTRAINT "IntegrationRun_sourceSystemId_fkey" FOREIGN KEY ("sourceSystemId") REFERENCES "SourceSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawImportRecord" ADD CONSTRAINT "RawImportRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IntegrationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationRecordError" ADD CONSTRAINT "IntegrationRecordError_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IntegrationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationRecordError" ADD CONSTRAINT "IntegrationRecordError_rawRecordId_fkey" FOREIGN KEY ("rawRecordId") REFERENCES "RawImportRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DQResult" ADD CONSTRAINT "DQResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DQRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DQResult" ADD CONSTRAINT "DQResult_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "DQRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
