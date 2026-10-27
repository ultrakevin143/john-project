-- Composite foreign keys enforce organization isolation even outside the API.
ALTER TABLE "SourceSystem" ADD CONSTRAINT "SourceSystem_org_id_key" UNIQUE ("organizationId", "id");
ALTER TABLE "DataDomain" ADD CONSTRAINT "DataDomain_org_id_key" UNIQUE ("organizationId", "id");
ALTER TABLE "Role" ADD CONSTRAINT "Role_org_id_key" UNIQUE ("organizationId", "id");
ALTER TABLE "User" ADD CONSTRAINT "User_org_id_key" UNIQUE ("organizationId", "id");
ALTER TABLE "IntegrationRun" ADD CONSTRAINT "IntegrationRun_org_id_key" UNIQUE ("organizationId", "id");
ALTER TABLE "RawImportRecord" ADD CONSTRAINT "RawImportRecord_org_id_key" UNIQUE ("organizationId", "id");
ALTER TABLE "DQRun" ADD CONSTRAINT "DQRun_org_id_key" UNIQUE ("organizationId", "id");
ALTER TABLE "DQRule" ADD CONSTRAINT "DQRule_org_id_key" UNIQUE ("organizationId", "id");
DO $$
DECLARE r record; t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['CustomerAccount','ServiceConnection','Meter','MeterReading','BillingRecord','Facility','ProductionReading','PipelineAsset','SamplingPoint','WaterQualityResult','WorkOrder','LeakReport','CustomerComplaint'] LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId", "sourceSystemId") REFERENCES "SourceSystem" ("organizationId", "id")',t,t||'_source_org_fk');
  END LOOP;
  FOR r IN SELECT * FROM (VALUES
    ('User','roleId','Role'),
    ('DataAsset','domainId','DataDomain'),('DataAsset','sourceSystemId','SourceSystem'),
    ('IntegrationConnection','sourceSystemId','SourceSystem'),('IntegrationRun','sourceSystemId','SourceSystem'),
    ('IntegrationLock','sourceSystemId','SourceSystem'),('RawImportRecord','runId','IntegrationRun'),
    ('IntegrationRecordError','runId','IntegrationRun'),('IntegrationRecordError','rawRecordId','RawImportRecord'),
    ('DQResult','runId','DQRun'),('DQResult','ruleId','DQRule'),('AuditEvent','actorId','User'),
    ('CustomerAccount','tariffId','Tariff'),('ServiceConnection','accountId','CustomerAccount'),('ServiceConnection','dmaId','DistrictMeteredArea'),
    ('Meter','connectionId','ServiceConnection'),('MeterReading','meterId','Meter'),('MeterReading','connectionId','ServiceConnection'),
    ('BillingRecord','accountId','CustomerAccount'),('BillingRecord','connectionId','ServiceConnection'),('BillingRecord','meterReadingId','MeterReading'),('BillingRecord','dmaId','DistrictMeteredArea'),('BillingRecord','tariffId','Tariff'),
    ('Facility','dmaId','DistrictMeteredArea'),('ProductionReading','facilityId','Facility'),('ProductionReading','dmaId','DistrictMeteredArea'),
    ('PipelineAsset','dmaId','DistrictMeteredArea'),('SamplingPoint','dmaId','DistrictMeteredArea'),
    ('WaterQualityResult','samplingPointId','SamplingPoint'),('WaterQualityResult','parameterId','WaterQualityParameter'),('WaterQualityResult','correctiveActionId','WorkOrder'),
    ('WorkOrder','dmaId','DistrictMeteredArea'),('LeakReport','dmaId','DistrictMeteredArea'),('LeakReport','pipelineId','PipelineAsset'),('LeakReport','workOrderId','WorkOrder'),
    ('CustomerComplaint','accountId','CustomerAccount'),('CustomerComplaint','dmaId','DistrictMeteredArea')
  ) AS refs(child,field,parent) LOOP
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("organizationId", %I) REFERENCES %I ("organizationId", "id")',r.child,r.child||'_'||r.field||'_org_fk',r.field,r.parent);
  END LOOP;
END $$;
ALTER TABLE "Meter" ADD CONSTRAINT "Meter_connection_lineage_key" UNIQUE ("organizationId","id","connectionId");
ALTER TABLE "MeterReading" ADD CONSTRAINT "MeterReading_connection_lineage_fk" FOREIGN KEY ("organizationId","meterId","connectionId") REFERENCES "Meter" ("organizationId","id","connectionId");
ALTER TABLE "ServiceConnection" ADD CONSTRAINT "Connection_account_dma_key" UNIQUE ("organizationId","id","accountId","dmaId");
ALTER TABLE "BillingRecord" ADD CONSTRAINT "Billing_connection_lineage_fk" FOREIGN KEY ("organizationId","connectionId","accountId","dmaId") REFERENCES "ServiceConnection" ("organizationId","id","accountId","dmaId");
ALTER TABLE "MeterReading" ADD CONSTRAINT "Reading_connection_key" UNIQUE ("organizationId","id","connectionId");
ALTER TABLE "BillingRecord" ADD CONSTRAINT "Billing_reading_lineage_fk" FOREIGN KEY ("organizationId","meterReadingId","connectionId") REFERENCES "MeterReading" ("organizationId","id","connectionId");
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_dma_key" UNIQUE ("organizationId","id","dmaId");
ALTER TABLE "ProductionReading" ADD CONSTRAINT "Production_facility_dma_fk" FOREIGN KEY ("organizationId","facilityId","dmaId") REFERENCES "Facility" ("organizationId","id","dmaId");
ALTER TABLE "PipelineAsset" ADD CONSTRAINT "Pipeline_dma_key" UNIQUE ("organizationId","id","dmaId");
ALTER TABLE "LeakReport" ADD CONSTRAINT "Leak_pipeline_dma_fk" FOREIGN KEY ("organizationId","pipelineId","dmaId") REFERENCES "PipelineAsset" ("organizationId","id","dmaId");

ALTER TABLE "MeterReading" ADD CONSTRAINT "Reading_quantities_period_check" CHECK ("previousM3">=0 AND "currentM3">=0 AND "consumptionM3">=0 AND "periodEnd">"periodStart" AND ("currentM3">="previousM3" OR "replacementRecorded"));
ALTER TABLE "BillingRecord" ADD CONSTRAINT "Billing_quantities_period_check" CHECK ("billedM3">=0 AND "amount">=0 AND "periodEnd">"periodStart");
ALTER TABLE "ProductionReading" ADD CONSTRAINT "Production_quantities_period_check" CHECK ("volumeM3">=0 AND "flowLs">=0 AND "pressureBar">=0 AND "periodEnd">"periodStart");
ALTER TABLE "WorkOrder" ADD CONSTRAINT "Work_completion_check" CHECK (("status" NOT IN ('COMPLETED','CLOSED') OR "completedAt" IS NOT NULL) AND ("completedAt" IS NULL OR "completedAt">="reportedAt") AND ("dispatchedAt" IS NULL OR "dispatchedAt">="reportedAt"));
ALTER TABLE "CustomerComplaint" ADD CONSTRAINT "Complaint_resolution_check" CHECK (("status" NOT IN ('RESOLVED','CLOSED') OR "resolvedAt" IS NOT NULL) AND ("resolvedAt" IS NULL OR "resolvedAt">="reportedAt"));
ALTER TABLE "WaterQualityParameter" ADD CONSTRAINT "Parameter_limits_check" CHECK ("plausibleMin"<="limitMin" AND "limitMin"<="limitMax" AND "limitMax"<="plausibleMax");
ALTER TABLE "DataAsset" ADD CONSTRAINT "Asset_retention_classification_check" CHECK ("retentionDays">0 AND (NOT "containsPii" AND "entity" NOT IN ('accounts','billing','complaints') OR "classification"='RESTRICTED'));

CREATE FUNCTION reject_immutable_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Governed historical records cannot be changed or deleted using this operation'; END;
$$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON "AuditEvent" FOR EACH STATEMENT EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER lab_no_delete BEFORE DELETE ON "WaterQualityResult" FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
CREATE TRIGGER billing_no_delete BEFORE DELETE ON "BillingRecord" FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
