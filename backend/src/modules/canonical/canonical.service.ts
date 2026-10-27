import { type AuditInput } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import { canTransition, transitions } from "./canonical.policy.js";
import { repository } from "./canonical.repository.js";
import { type Entity, schemas } from "./canonical.schemas.js";
import { type Canonical, type DB } from "./canonical.types.js";

export async function saveCanonical(
  db: DB,
  entity: Entity,
  payload: unknown,
  meta: {
    organizationId: string;
    sourceSystemId: string;
    sourceVersion: string;
  },
  auditContext?: Omit<AuditInput, "action" | "entity">,
) {
  const parsed = schemas[entity].parse(payload),
    data = parsed as Record<string, unknown>;
  if (parsed.sourceUpdatedAt.getTime() > Date.now() + 300000)
    throw new ApiError(
      422,
      "FUTURE_TIMESTAMP",
      "sourceUpdatedAt is more than five minutes in the future.",
    );
  const refs: Record<string, () => Promise<unknown>> = {
    dmaId: () =>
      db.districtMeteredArea.findFirst({
        where: { id: String(data.dmaId), organizationId: meta.organizationId },
      }),
    tariffId: () =>
      db.tariff.findFirst({
        where: {
          id: String(data.tariffId),
          organizationId: meta.organizationId,
        },
      }),
    parameterId: () =>
      db.waterQualityParameter.findFirst({
        where: {
          id: String(data.parameterId),
          organizationId: meta.organizationId,
        },
      }),
  };
  const entityRefs: Record<string, Entity> = {
    accountId: "accounts",
    connectionId: "service-connections",
    meterId: "meters",
    meterReadingId: "meter-readings",
    facilityId: "facilities",
    samplingPointId: "sampling-points",
    pipelineId: "pipelines",
    workOrderId: "work-orders",
    correctiveActionId: "work-orders",
  };
  for (const [field, target] of Object.entries(entityRefs))
    refs[field] = () =>
      repository(db, target).findFirst({
        where: {
          id: data[field],
          organizationId: meta.organizationId,
          archivedAt: null,
        },
      });
  for (const [field, find] of Object.entries(refs))
    if (data[field] && !(await find()))
      throw new ApiError(
        422,
        "INVALID_REFERENCE",
        `${field} must reference an active record in your organization.`,
      );
  if (entity === "meter-readings") {
    const meter = await db.meter.findFirstOrThrow({
      where: { id: String(data.meterId), organizationId: meta.organizationId },
    });
    if (meter.connectionId !== data.connectionId)
      throw new ApiError(
        422,
        "METER_CONNECTION",
        "Meter and service connection do not match.",
      );
    if (data.replacementRecorded && !meter.replacedAt)
      throw new ApiError(
        422,
        "REPLACEMENT_REQUIRED",
        "A replacement date must be recorded on the meter before resetting the register.",
      );
  }
  if (entity === "billing") {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${meta.organizationId}))`;
    const connection = await db.serviceConnection.findFirstOrThrow({
      where: {
        id: String(data.connectionId),
        organizationId: meta.organizationId,
      },
    });
    const reading = await db.meterReading.findFirstOrThrow({
      where: {
        id: String(data.meterReadingId),
        organizationId: meta.organizationId,
      },
    });
    const account = await db.customerAccount.findFirstOrThrow({
      where: {
        id: String(data.accountId),
        organizationId: meta.organizationId,
      },
    });
    const [billTariff, accountTariff] = await Promise.all([
      db.tariff.findFirstOrThrow({
        where: {
          id: String(data.tariffId),
          organizationId: meta.organizationId,
        },
      }),
      db.tariff.findFirstOrThrow({
        where: { id: account.tariffId, organizationId: meta.organizationId },
      }),
    ]);
    if (
      connection.accountId !== data.accountId ||
      connection.dmaId !== data.dmaId ||
      reading.connectionId !== data.connectionId ||
      accountTariff.customerClass !== billTariff.customerClass ||
      accountTariff.meterSizeMm !== billTariff.meterSizeMm
    )
      throw new ApiError(
        422,
        "BILLING_LINEAGE",
        "Account, tariff, connection, DMA and reading must agree.",
      );
    if (
      (data.periodStart as Date) < billTariff.effectiveFrom ||
      (billTariff.effectiveTo &&
        (data.periodEnd as Date) > billTariff.effectiveTo)
    )
      throw new ApiError(
        422,
        "TARIFF_PERIOD",
        "The complete billing period must fall inside the selected tariff version. Split periods at a rate change in the source system.",
      );
    if (
      reading.periodStart.getTime() !== (data.periodStart as Date).getTime() ||
      reading.periodEnd.getTime() !== (data.periodEnd as Date).getTime()
    )
      throw new ApiError(
        422,
        "BILLING_PERIOD",
        "Billing must match the reading period exactly.",
      );
  }
  if (entity === "production") {
    const facility = await db.facility.findFirstOrThrow({
      where: {
        id: String(data.facilityId),
        organizationId: meta.organizationId,
      },
    });
    if (facility.dmaId !== data.dmaId)
      throw new ApiError(
        422,
        "DMA_MISMATCH",
        "Production DMA must match the facility DMA.",
      );
  }
  if (entity === "leaks") {
    const pipe = await db.pipelineAsset.findFirstOrThrow({
      where: {
        id: String(data.pipelineId),
        organizationId: meta.organizationId,
      },
    });
    if (pipe.dmaId !== data.dmaId)
      throw new ApiError(
        422,
        "DMA_MISMATCH",
        "Leak and pipeline DMA must agree.",
      );
  }
  if (entity === "water-quality") {
    const parameter = await db.waterQualityParameter.findFirstOrThrow({
      where: {
        id: String(data.parameterId),
        organizationId: meta.organizationId,
      },
    });
    if (
      data.unit !== parameter.unit ||
      Number(data.value) < parameter.plausibleMin ||
      Number(data.value) > parameter.plausibleMax ||
      (parameter.code === "COLI" && !Number.isInteger(Number(data.value)))
    )
      throw new ApiError(
        422,
        "INVALID_LAB_VALUE",
        "Result must use the parameter unit and physically plausible range.",
      );
    if (data.correctiveActionId) {
      const action = await db.workOrder.findFirstOrThrow({
        where: {
          id: String(data.correctiveActionId),
          organizationId: meta.organizationId,
        },
      });
      const point = await db.samplingPoint.findFirstOrThrow({
        where: {
          id: String(data.samplingPointId),
          organizationId: meta.organizationId,
        },
      });
      if (action.category !== "WATER_QUALITY" || action.dmaId !== point.dmaId)
        throw new ApiError(
          422,
          "CORRECTIVE_ACTION",
          "Corrective action must be a water-quality work order for the sampling point's DMA.",
        );
    }
  }
  const where = {
      organizationId: meta.organizationId,
      sourceSystemId: meta.sourceSystemId,
      sourceRecordId: parsed.sourceRecordId,
    },
    repo = repository(db, entity);
  const existing = await repo.findFirst({ where });
  if (existing?.sourceVersion === meta.sourceVersion)
    return { id: existing.id, skipped: true };
  if (
    existing &&
    Object.entries(parsed).every(([key, value]) => {
      const previous = existing[key];
      return value instanceof Date
        ? previous instanceof Date && previous.getTime() === value.getTime()
        : typeof value === "number"
          ? Number(previous) === value
          : previous === value;
    })
  )
    return { id: existing.id, skipped: true };
  if (existing?.archivedAt)
    throw new ApiError(
      409,
      "ARCHIVED_RECORD",
      "Archived records cannot be re-imported.",
    );
  if (existing && existing.sourceUpdatedAt >= parsed.sourceUpdatedAt)
    throw new ApiError(
      422,
      "STALE_VERSION",
      "Changed data requires a newer source timestamp.",
    );
  const change = { ...parsed, ...meta };
  if (existing && transitions[entity]) {
    if (!canTransition(entity, String(existing.status), String(data.status)))
      throw new ApiError(
        422,
        "INVALID_TRANSITION",
        `Cannot move ${entity} from ${existing.status} to ${data.status}.`,
      );
    Object.assign(change, { previousStatus: existing.status });
  }
  if (entity === "water-quality" && existing)
    Object.assign(change, {
      correctionVersion: Number(existing.correctionVersion) + 1,
    });
  const saved = await repo.upsert({
    where: { organizationId_sourceSystemId_sourceRecordId: where },
    create: change,
    update: change,
  });
  if (entity === "work-orders")
    await resolveCompletedLeaks(db, saved, auditContext);
  if (entity === "water-quality" && existing)
    await db.auditEvent.create({
      data: {
        organizationId: meta.organizationId,
        actorId: auditContext?.actorId,
        actorName: auditContext?.actorName ?? "Integration pipeline",
        action: "LAB_RESULT_CORRECTED",
        entity,
        entityId: saved.id,
        requestId: auditContext?.requestId ?? "integration-correction",
        reason: "Newer source version accepted",
        metadata: {
          before: {
            value: Number(existing.value),
            unit: String(existing.unit),
          },
          after: { value: Number(data.value), unit: String(data.unit) },
        },
      },
    });
  return { id: saved.id, skipped: false };
}
export async function resolveCompletedLeaks(
  db: DB,
  work: Canonical,
  context?: Omit<AuditInput, "action" | "entity">,
) {
  if (
    work.category !== "LEAK_REPAIR" ||
    !["COMPLETED", "CLOSED"].includes(String(work.status)) ||
    !work.completedAt
  )
    return;
  const leaks = await db.leakReport.findMany({
    where: {
      organizationId: work.organizationId,
      workOrderId: work.id,
      dmaId: String(work.dmaId),
      resolvedAt: null,
      archivedAt: null,
    },
  });
  const completedAt =
    work.completedAt instanceof Date
      ? work.completedAt
      : new Date(String(work.completedAt));
  for (const leak of leaks) {
    if (completedAt < leak.reportedAt)
      throw new ApiError(
        422,
        "LEAK_RESOLUTION_DATE",
        "Repair completion cannot precede the linked leak report.",
      );
    await db.leakReport.update({
      where: { id: leak.id },
      data: { resolvedAt: completedAt },
    });
    await db.auditEvent.create({
      data: {
        organizationId: work.organizationId,
        actorId: context?.actorId,
        actorName: context?.actorName ?? "Integration pipeline",
        requestId: context?.requestId ?? "linked-leak-repair",
        action: "LEAK_RESOLVED",
        entity: "leaks",
        entityId: leak.id,
        reason: "Linked leak-repair work order completed",
        metadata: {
          workOrderId: work.id,
          resolvedAt: completedAt.toISOString(),
        },
      },
    });
  }
}
