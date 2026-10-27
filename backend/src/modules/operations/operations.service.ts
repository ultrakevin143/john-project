import type { PrismaClient } from "@prisma/client";
import { type Config } from "../../config/env.js";
import { audit } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import { stableHash } from "../../shared/hash.js";
import { type Identity } from "../../shared/request-context.js";
import {
  pageResponse,
  paginate,
  paging,
  uuid,
} from "../../shared/validation.js";
import { canTransition, entityDomain } from "../canonical/canonical.policy.js";
import { repository } from "../canonical/canonical.repository.js";
import {
  entitySchema,
  schemas,
  type Entity,
} from "../canonical/canonical.schemas.js";
import { resolveCompletedLeaks } from "../canonical/canonical.service.js";
import { type Canonical } from "../canonical/canonical.types.js";
import {
  statusEntitySchema,
  updateOperationalStatusSchema,
  correctWaterQualitySchema,
  archiveReasonSchema,
} from "./operations.schemas.js";

import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
export function assertDomain(user: Identity, entity: Entity) {
  if (!user.permissions.includes(`domain:${entityDomain[entity]}`))
    throw new ApiError(
      403,
      "DOMAIN_FORBIDDEN",
      `Your role cannot access ${entityDomain[entity]} records.`,
    );
}
export const identitiesMasked = (user: Identity, config: Config) =>
  config.MASK_CUSTOMER_IDENTITIES === "true" ||
  !user.permissions.includes("identity:reveal");
export function masked(
  row: Canonical,
  entity: Entity,
  user: Identity,
  config: Config,
) {
  const data = { ...row };
  if (identitiesMasked(user, config)) {
    if (entity === "accounts") {
      data.customerName = "Synthetic customer ••••";
      data.address = "Address withheld";
      data.accountNumber = `••••${String(data.accountNumber).slice(-4)}`;
    }
    if (entity === "complaints") data.customerAlias = "Withheld";
  }
  return data;
}
export const searchFields: Record<Entity, string[]> = {
  accounts: ["accountNumber", "customerName"],
  "service-connections": ["code"],
  meters: ["serialNumber"],
  "meter-readings": ["sourceRecordId"],
  billing: ["reference"],
  facilities: ["code", "name"],
  production: ["sourceRecordId"],
  pipelines: ["code", "material"],
  "sampling-points": ["code", "name"],
  "water-quality": ["sampleReference", "unit"],
  "work-orders": ["reference", "title", "assignee"],
  leaks: ["reference", "location"],
  complaints: ["reference", "category"],
};
export const statusValues: Partial<Record<Entity, string[]>> = {
  "service-connections": ["ACTIVE", "INACTIVE"],
  meters: ["ACTIVE", "INACTIVE", "REPLACED"],
  "work-orders": ["OPEN", "DISPATCHED", "IN_PROGRESS", "COMPLETED", "CLOSED"],
  complaints: ["OPEN", "ASSIGNED", "RESOLVED", "CLOSED"],
};
export function createOperationsService(db: PrismaClient, config: Config) {
  const getLookups = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const user = requireIdentity(requestContext.user),
      where = { organizationId: user.organizationId };
    const [
      dmas,
      tariffs,
      parameters,
      sources,
      facilities,
      meters,
      connections,
      points,
      workOrders,
    ] = await Promise.all([
      db.districtMeteredArea.findMany({ where, orderBy: { code: "asc" } }),
      user.permissions.includes("domain:billing")
        ? db.tariff.findMany({ where })
        : [],
      user.permissions.includes("domain:quality")
        ? db.waterQualityParameter.findMany({ where })
        : [],
      user.permissions.includes("integrations:read")
        ? db.sourceSystem.findMany({ where })
        : [],
      user.permissions.includes("domain:production")
        ? db.facility.findMany({
            where: { ...where, archivedAt: null },
            select: { id: true, name: true, dmaId: true },
          })
        : [],
      user.permissions.includes("domain:metering")
        ? db.meter.findMany({
            where: { ...where, archivedAt: null },
            select: { id: true, serialNumber: true, connectionId: true },
          })
        : [],
      user.permissions.includes("domain:metering")
        ? db.serviceConnection.findMany({
            where: { ...where, archivedAt: null },
            select: { id: true, code: true, dmaId: true },
          })
        : [],
      user.permissions.includes("domain:quality")
        ? db.samplingPoint.findMany({ where: { ...where, archivedAt: null } })
        : [],
      user.permissions.includes("domain:quality")
        ? db.workOrder.findMany({
            where: { ...where, category: "WATER_QUALITY", archivedAt: null },
            select: { id: true, reference: true, title: true },
          })
        : [],
    ]);
    return {
      data: {
        dmas,
        tariffs,
        parameters,
        sources,
        facilities,
        meters,
        connections,
        points,
        workOrders,
      },
    };
  };
  const getEntity = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const entity = entitySchema.parse(requestInput.params.entity),
      user = requireIdentity(requestContext.user);
    assertDomain(user, entity);
    const q = paging.parse(requestInput.query),
      dmaId = uuid.optional().parse(requestInput.query.dmaId),
      sourceSystemId = uuid.optional().parse(requestInput.query.sourceSystemId);
    if (q.status && !statusValues[entity]?.includes(q.status))
      throw new ApiError(
        422,
        "INVALID_STATUS",
        "Status filter is not valid for this entity.",
      );
    const maskedAccountSearch =
      entity === "accounts" && identitiesMasked(user, config) && !!q.search;
    if (maskedAccountSearch && !/^[a-zA-Z0-9]{4}$/.test(q.search))
      throw new ApiError(
        422,
        "MASKED_ACCOUNT_SEARCH",
        "Search using the four visible trailing account characters. Names and full account numbers are hidden.",
      );
    const where: Record<string, unknown> = {
      organizationId: user.organizationId,
      archivedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(sourceSystemId ? { sourceSystemId } : {}),
      ...(q.search
        ? {
            ...(maskedAccountSearch
              ? { accountNumber: { endsWith: q.search, mode: "insensitive" } }
              : {
                  OR: searchFields[entity].map((k) => ({
                    [k]: { contains: q.search, mode: "insensitive" },
                  })),
                }),
          }
        : {}),
    };
    if (dmaId) {
      if (
        ["accounts", "meters", "meter-readings", "water-quality"].includes(
          entity,
        )
      ) {
        let ids: string[] = [];
        if (entity === "accounts")
          ids = (
            await db.serviceConnection.findMany({
              where: {
                organizationId: user.organizationId,
                dmaId,
                archivedAt: null,
              },
              select: { accountId: true },
            })
          ).map((r) => r.accountId);
        else if (entity === "water-quality")
          ids = (
            await db.samplingPoint.findMany({
              where: {
                organizationId: user.organizationId,
                dmaId,
                archivedAt: null,
              },
              select: { id: true },
            })
          ).map((r) => r.id);
        else
          ids = (
            await db.serviceConnection.findMany({
              where: {
                organizationId: user.organizationId,
                dmaId,
                archivedAt: null,
              },
              select: { id: true },
            })
          ).map((r) => r.id);
        where[
          entity === "accounts"
            ? "id"
            : entity === "water-quality"
              ? "samplingPointId"
              : "connectionId"
        ] = { in: ids };
      } else where.dmaId = dmaId;
    }
    const repo = repository(db, entity),
      [rows, total] = await Promise.all([
        repo.findMany({
          where,
          ...paginate(q.page, q.pageSize),
          orderBy: [{ createdAt: q.sort }, { id: "asc" }],
        }),
        repo.count({ where }),
      ]);
    return pageResponse(
      rows.map((r) => masked(r, entity, user, config)),
      total,
      q.page,
      q.pageSize,
    );
  };
  const getEntityId = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const entity = entitySchema.parse(requestInput.params.entity),
      id = uuid.parse(requestInput.params.id),
      user = requireIdentity(requestContext.user);
    assertDomain(user, entity);
    const row = await repository(db, entity).findFirst({
      where: { id, organizationId: user.organizationId, archivedAt: null },
    });
    if (!row)
      throw new ApiError(404, "NOT_FOUND", "Operational record not found.");
    const source = await db.sourceSystem.findFirst({
      where: { id: row.sourceSystemId, organizationId: user.organizationId },
      select: { id: true, name: true, method: true, domain: true },
    });
    return {
      data: { ...masked(row, entity, user, config), sourceSystem: source },
    };
  };
  const patchWaterQualityId = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const user = requireIdentity(requestContext.user);
    assertDomain(user, "water-quality");
    const id = uuid.parse(requestInput.params.id),
      body = correctWaterQualitySchema.parse(requestInput.body);
    const result = await db.$transaction(async (tx) => {
      const before = await tx.waterQualityResult.findFirst({
        where: { id, organizationId: user.organizationId, archivedAt: null },
      });
      if (!before)
        throw new ApiError(404, "NOT_FOUND", "Lab result not found.");
      const parameter = await tx.waterQualityParameter.findFirstOrThrow({
        where: {
          id: before.parameterId,
          organizationId: user.organizationId,
        },
      });
      if (
        body.unit !== parameter.unit ||
        body.value < parameter.plausibleMin ||
        body.value > parameter.plausibleMax ||
        (parameter.code === "COLI" && !Number.isInteger(body.value))
      )
        throw new ApiError(
          422,
          "INVALID_LAB_VALUE",
          "Check the parameter unit and physically plausible range.",
        );
      const point = await tx.samplingPoint.findFirstOrThrow({
        where: {
          id: before.samplingPointId,
          organizationId: user.organizationId,
        },
      });
      if (
        body.correctiveActionId &&
        !(await tx.workOrder.findFirst({
          where: {
            id: body.correctiveActionId,
            organizationId: user.organizationId,
            category: "WATER_QUALITY",
            dmaId: point.dmaId,
            archivedAt: null,
          },
        }))
      )
        throw new ApiError(
          422,
          "CORRECTIVE_ACTION",
          "Select a water-quality corrective work order in the sampling point's DMA.",
        );
      const changed = await tx.waterQualityResult.updateMany({
        where: {
          id,
          organizationId: user.organizationId,
          correctionVersion: body.version,
        },
        data: {
          value: body.value,
          unit: body.unit,
          correctiveActionId: body.correctiveActionId,
          enteredBy: user.name,
          correctionVersion: { increment: 1 },
          sourceUpdatedAt: new Date(),
          sourceVersion: stableHash(body),
        },
      });
      if (!changed.count)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "This lab result changed. Refresh before correcting it.",
        );
      await audit(tx, {
        ...serviceAudit(requestContext.audit),
        action: "LAB_RESULT_CORRECTED",
        entity: "water-quality",
        entityId: id,
        reason: body.reason,
        metadata: {
          before: {
            value: before.value,
            unit: before.unit,
            correctiveActionId: before.correctiveActionId,
            enteredBy: before.enteredBy,
          },
          after: {
            value: body.value,
            unit: body.unit,
            correctiveActionId: body.correctiveActionId,
            enteredBy: user.name,
          },
        },
      });
      return tx.waterQualityResult.findUniqueOrThrow({ where: { id } });
    });
    return { data: result };
  };
  const patchEntityIdStatus = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const entity = statusEntitySchema.parse(requestInput.params.entity),
      id = uuid.parse(requestInput.params.id),
      user = requireIdentity(requestContext.user);
    assertDomain(user, entity);
    const body = updateOperationalStatusSchema.parse(requestInput.body);
    const saved = await db.$transaction(async (tx) => {
      const repo = repository(tx, entity),
        before = await repo.findFirst({
          where: {
            id,
            organizationId: user.organizationId,
            archivedAt: null,
          },
        });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Record not found.");
      if (!canTransition(entity, String(before.status), body.status))
        throw new ApiError(
          422,
          "INVALID_TRANSITION",
          `Cannot move ${before.status} to ${body.status}.`,
        );
      const canonical = Object.fromEntries(
        Object.entries(before)
          .filter(([key]) => key in schemas[entity].shape)
          .map(([key, value]) => [
            key,
            value instanceof Date ? value.toISOString() : value,
          ]),
      );
      const validated = schemas[entity].parse({
        ...canonical,
        ...Object.fromEntries(
          ["status", "dispatchedAt", "completedAt", "resolvedAt"]
            .filter((k) => body[k as keyof typeof body] !== undefined)
            .map((k) => [k, body[k as keyof typeof body]]),
        ),
      });
      const change = Object.fromEntries(
        ["status", "dispatchedAt", "completedAt", "resolvedAt"]
          .filter((k) => k in validated)
          .map((k) => [k, (validated as Record<string, unknown>)[k]]),
      );
      const result = await repo.updateMany({
        where: {
          id,
          organizationId: user.organizationId,
          updatedAt: new Date(body.updatedAt),
        },
        data: {
          ...change,
          previousStatus: before.status,
          sourceUpdatedAt: new Date(),
          sourceVersion: stableHash(body),
        },
      });
      if (!result.count)
        throw new ApiError(
          409,
          "VERSION_CONFLICT",
          "Record changed. Refresh before saving.",
        );
      await audit(tx, {
        ...serviceAudit(requestContext.audit),
        action: "STATUS_CHANGED",
        entity,
        entityId: id,
        reason: body.reason,
        metadata: { before: String(before.status), after: body.status },
      });
      const changed = await repo.findFirst({
        where: { id, organizationId: user.organizationId },
      });
      if (entity === "work-orders" && changed)
        await resolveCompletedLeaks(
          tx,
          changed,
          serviceAudit(requestContext.audit),
        );
      return changed;
    });
    return { data: saved };
  };
  const postEntityIdArchive = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const entity = entitySchema.parse(requestInput.params.entity),
      id = uuid.parse(requestInput.params.id),
      user = requireIdentity(requestContext.user);
    assertDomain(user, entity);
    const { reason } = archiveReasonSchema.parse(requestInput.body);
    if (entity === "billing" || entity === "water-quality")
      throw new ApiError(
        403,
        "RETAINED_RECORD",
        "Billing and laboratory records are retained; corrections preserve their audit trail.",
      );
    await db.$transaction(async (tx) => {
      const changed = await repository(tx, entity).updateMany({
        where: { id, organizationId: user.organizationId, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      if (!changed.count)
        throw new ApiError(404, "NOT_FOUND", "Active record not found.");
      await audit(tx, {
        ...serviceAudit(requestContext.audit),
        action: "RECORD_ARCHIVED",
        entity,
        entityId: id,
        reason,
      });
    });
    return undefined;
  };
  return {
    getLookups,
    getEntity,
    getEntityId,
    patchWaterQualityId,
    patchEntityIdStatus,
    postEntityIdArchive,
  };
}
