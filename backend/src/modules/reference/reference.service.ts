import type { PrismaClient } from "@prisma/client";
import { audit } from "../../shared/audit.js";
import { manilaDate } from "../../shared/dates.js";
import { ApiError } from "../../shared/errors.js";
import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
import { cebuLocations, districtProfile } from "./reference.data.js";
import { tariffVersionSchema } from "./reference.schemas.js";
export function createReferenceService(db: PrismaClient) {
  const getIndex = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const user = requireIdentity(requestContext.user),
      where = { organizationId: user.organizationId };
    const [areas, tariffs, parameters] = await Promise.all([
      db.districtMeteredArea.findMany({ where, orderBy: { code: "asc" } }),
      user.permissions.includes("domain:billing")
        ? db.tariff.findMany({
            where,
            orderBy: [{ customerClass: "asc" }, { effectiveFrom: "desc" }],
          })
        : [],
      user.permissions.includes("domain:quality")
        ? db.waterQualityParameter.findMany({ where, orderBy: { code: "asc" } })
        : [],
    ]);
    return {
      data: {
        profile: districtProfile,
        locations: cebuLocations,
        areas,
        tariffs,
        parameters,
      },
    };
  };
  const postTariffs = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const user = requireIdentity(requestContext.user),
      body = tariffVersionSchema.parse(requestInput.body),
      from = manilaDate(body.effectiveFrom);
    const data = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.organizationId}))`;
      const prior = await tx.tariff.findFirst({
        where: { id: body.supersedesId, organizationId: user.organizationId },
      });
      if (!prior)
        throw new ApiError(404, "NOT_FOUND", "Tariff version not found.");
      if (prior.effectiveTo || from <= prior.effectiveFrom)
        throw new ApiError(
          409,
          "TARIFF_VERSION",
          "Choose the latest open tariff and a later effective date.",
        );
      if (
        await tx.tariff.findFirst({
          where: { organizationId: user.organizationId, code: body.code },
        })
      )
        throw new ApiError(
          409,
          "TARIFF_CODE",
          "That tariff version code already exists.",
        );
      if (
        await tx.billingRecord.count({
          where: {
            organizationId: user.organizationId,
            tariffId: prior.id,
            periodEnd: { gt: from },
          },
        })
      )
        throw new ApiError(
          409,
          "TARIFF_BILLED_PERIOD",
          "Existing bills extend beyond that date. Choose a date after their billing periods.",
        );
      await tx.tariff.update({
        where: { id: prior.id },
        data: { effectiveTo: from },
      });
      const tariff = await tx.tariff.create({
        data: {
          organizationId: user.organizationId,
          code: body.code,
          name: body.name,
          customerClass: prior.customerClass,
          meterSizeMm: prior.meterSizeMm,
          currency: "PHP",
          effectiveFrom: from,
          baseVolumeM3: body.baseVolumeM3,
          baseCharge: body.baseCharge,
          ratePerM3: body.ratePerM3,
          blocks: body.blocks,
          sourceLabel:
            "User-configured illustrative prototype tariff; not an approved MCWD rate. Water charge only.",
          demoOnly: true,
        },
      });
      await audit(tx, {
        ...serviceAudit(requestContext.audit),
        action: "TARIFF_VERSION_CREATED",
        entity: "tariff",
        entityId: tariff.id,
        reason: body.reason,
        metadata: {
          previousId: prior.id,
          effectiveFrom: from.toISOString(),
          currency: "PHP",
          illustrative: true,
        },
      });
      return tariff;
    });
    return { data };
  };
  return { getIndex, postTariffs };
}
