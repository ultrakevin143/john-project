import type { PrismaClient } from "@prisma/client";
import { ApiError } from "../../shared/errors.js";
import {
  pageResponse,
  paginate,
  paging,
  uuid,
} from "../../shared/validation.js";
import { reportingPeriod } from "../reports/reports.service.js";
import { qualityTrendLimitSchema } from "./insights.schemas.js";

import {
  requireIdentity,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
export const qualityPercentage = (checked: number, failed: number) =>
  checked ? Math.round(10000 * (1 - failed / checked)) / 100 : null;
export function groupQuality(
  results: {
    checked: number;
    failed: number;
    rule: {
      domain: string;
    };
  }[],
) {
  const domains = new Map<
    string,
    {
      domain: string;
      checked: number;
      failed: number;
    }
  >();
  for (const r of results) {
    const row = domains.get(r.rule.domain) ?? {
      domain: r.rule.domain,
      checked: 0,
      failed: 0,
    };
    row.checked += r.checked;
    row.failed += r.failed;
    domains.set(row.domain, row);
  }
  return [...domains.values()]
    .sort((a, b) => a.domain.localeCompare(b.domain))
    .map((r) => ({ ...r, score: qualityPercentage(r.checked, r.failed) }));
}
export function createInsightsService(db: PrismaClient) {
  const getQualityTrends = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const limit = qualityTrendLimitSchema.parse(requestInput.query.limit);
    const runs = await db.dQRun.findMany({
      where: {
        organizationId: requireIdentity(requestContext.user).organizationId,
        status: "SUCCEEDED",
      },
      take: limit,
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      include: {
        results: {
          select: {
            checked: true,
            failed: true,
            rule: { select: { domain: true } },
          },
        },
      },
    });
    const latest = runs[0],
      previous = runs[1];
    return {
      data: {
        runs: runs
          .map((r) => ({
            id: r.id,
            startedAt: r.startedAt,
            checked: r.checked,
            failed: r.failed,
            score: qualityPercentage(r.checked, r.failed),
            domains: groupQuality(r.results),
          }))
          .reverse(),
        domains: groupQuality(latest?.results ?? []).map((d) => {
          const before = groupQuality(previous?.results ?? []).find(
            (p) => p.domain === d.domain,
          );
          return {
            ...d,
            previousScore: before?.score ?? null,
            change:
              d.score !== null &&
              before?.score !== null &&
              before?.score !== undefined
                ? Math.round((d.score - before.score) * 100) / 100
                : null,
          };
        }),
        formula:
          "100 × (1 − failed record-rule observations / checked observations). Domain scores are weighted by observations. Change is percentage points against the previous successful run; rule or coverage changes can affect comparisons.",
      },
    };
  };
  const getMeterReliability = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const organizationId = requireIdentity(requestContext.user).organizationId,
      period = reportingPeriod(requestInput.query),
      dmaId = uuid.optional().parse(requestInput.query.dmaId),
      q = paging.parse(requestInput.query);
    const dmas = await db.districtMeteredArea.findMany({
      where: { organizationId },
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    });
    if (dmaId && !dmas.some((d) => d.id === dmaId))
      throw new ApiError(404, "NOT_FOUND", "DMA not found in this district.");
    const connections = await db.serviceConnection.findMany({
      where: {
        organizationId,
        archivedAt: null,
        ...(dmaId ? { dmaId } : {}),
      },
      select: { id: true, dmaId: true },
    });
    const meters = await db.meter.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        archivedAt: null,
        installedAt: { lte: period.from },
        connectionId: { in: connections.map((c) => c.id) },
      },
      select: { id: true, serialNumber: true, connectionId: true },
      orderBy: { serialNumber: "asc" },
    });
    const [readings, rule] = await Promise.all([
      db.meterReading.findMany({
        where: {
          organizationId,
          archivedAt: null,
          meterId: { in: meters.map((m) => m.id) },
          periodStart: { gte: period.from },
          periodEnd: { lte: period.to },
        },
        select: {
          id: true,
          meterId: true,
          readType: true,
          consumptionM3: true,
          previousM3: true,
          currentM3: true,
          replacementRecorded: true,
        },
      }),
      db.dQRule.findFirst({
        where: { organizationId, checkId: "outliers" },
        select: { config: true },
      }),
    ]);
    const config = rule?.config as
        | {
            maxConsumptionM3?: number;
          }
        | undefined,
      threshold = Number(config?.maxConsumptionM3 ?? 150);
    const rows = meters.map((m) => {
      const observations = readings.filter((r) => r.meterId === m.id),
        connection = connections.find((c) => c.id === m.connectionId)!;
      const anomalies = observations.flatMap((r) => {
        const reasons: string[] = [],
          consumption = Number(r.consumptionM3),
          difference = Number(r.currentM3) - Number(r.previousM3);
        if (consumption > threshold)
          reasons.push(`Consumption exceeds ${threshold} m³`);
        if (consumption < 0 || (!r.replacementRecorded && difference < 0))
          reasons.push(
            "Register or consumption decreases without a recorded replacement",
          );
        if (!r.replacementRecorded && Math.abs(difference - consumption) > 0.01)
          reasons.push("Consumption differs from the register change");
        return reasons.length ? [{ id: r.id, reasons }] : [];
      });
      return {
        id: m.id,
        serialNumber: m.serialNumber,
        dma: dmas.find((d) => d.id === connection.dmaId),
        readings: observations.length,
        actual: observations.filter((r) => r.readType === "ACTUAL").length,
        estimated: observations.filter((r) => r.readType === "ESTIMATED")
          .length,
        missing: observations.length === 0,
        anomalies,
      };
    });
    const filtered = q.search
      ? rows.filter((r) =>
          r.serialNumber.toLowerCase().includes(q.search.toLowerCase()),
        )
      : rows;
    return {
      ...pageResponse(
        filtered.slice(paginate(q.page, q.pageSize).skip, q.page * q.pageSize),
        filtered.length,
        q.page,
        q.pageSize,
      ),
      summary: {
        expectedMeters: rows.length,
        metersRead: rows.filter((r) => !r.missing).length,
        missingMeters: rows.filter((r) => r.missing).length,
        actualReadings: readings.filter((r) => r.readType === "ACTUAL").length,
        estimatedReadings: readings.filter((r) => r.readType === "ESTIMATED")
          .length,
        estimatedPct: readings.length
          ? Math.round(
              (10000 *
                readings.filter((r) => r.readType === "ESTIMATED").length) /
                readings.length,
            ) / 100
          : null,
        anomalousReadings: rows.reduce((n, r) => n + r.anomalies.length, 0),
      },
      dmas,
      period,
      threshold,
      coverage:
        "Currently active, unarchived meters on unarchived service connections, installed by the period start. A meter is missing when it has no complete reading interval contained in the selected Manila period. This is coverage of recorded readings, not a scheduled-read SLA. Anomalies use the configured consumption threshold and register consistency; search affects the table only.",
    };
  };
  return { getQualityTrends, getMeterReliability };
}
