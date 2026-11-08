CREATE TABLE "ImportPayloadRevision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rawRecordId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "changedById" TEXT,
    "changedByName" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportPayloadRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportPayloadRevision_organizationId_rawRecordId_createdAt_idx"
ON "ImportPayloadRevision"("organizationId", "rawRecordId", "createdAt");

ALTER TABLE "ImportPayloadRevision"
ADD CONSTRAINT "ImportPayloadRevision_rawRecordId_fkey"
FOREIGN KEY ("rawRecordId") REFERENCES "RawImportRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION check_import_revision_organization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    raw_organization TEXT;
BEGIN
    SELECT "organizationId" INTO raw_organization
    FROM "RawImportRecord" WHERE "id" = NEW."rawRecordId";
    IF raw_organization IS DISTINCT FROM NEW."organizationId" THEN
        RAISE EXCEPTION 'Import revision must match the raw record organization' USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "import_revision_organization"
BEFORE INSERT OR UPDATE ON "ImportPayloadRevision"
FOR EACH ROW EXECUTE FUNCTION check_import_revision_organization();

CREATE FUNCTION protect_import_payload_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Import payload revisions cannot be changed directly' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER "import_payload_revision_immutable"
BEFORE UPDATE OR DELETE ON "ImportPayloadRevision"
FOR EACH ROW EXECUTE FUNCTION protect_import_payload_revision();

CREATE TRIGGER "import_payload_revision_no_truncate"
BEFORE TRUNCATE ON "ImportPayloadRevision"
FOR EACH STATEMENT EXECUTE FUNCTION protect_import_payload_revision();
