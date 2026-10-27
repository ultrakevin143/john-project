import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../shared/audit.js";
import { csv } from "../../shared/csv.js";
import { manilaDate, manilaMonthStart } from "../../shared/dates.js";
import { ApiError } from "../../shared/errors.js";
import { stableHash } from "../../shared/hash.js";
import { nrwReport, waterReport } from "./reports.repository.js";
import {
  reportNameSchema,
  reportFormatSchema,
  reportDmaFilterSchema,
} from "./reports.schemas.js";

import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
export function defaultPeriod(now = new Date()) {
  const to = manilaMonthStart(now),
    from = manilaMonthStart(now, -1);
  return { from, to };
}
export function reportingPeriod(query: Record<string, unknown>) {
  const defaults = defaultPeriod();
  const q = z
    .object({ from: z.iso.date().optional(), to: z.iso.date().optional() })
    .parse(query);
  const from = q.from ? manilaDate(q.from) : defaults.from,
    to = q.to ? manilaDate(q.to) : defaults.to;
  if (to <= from || to.getTime() - from.getTime() > 366 * 86400000)
    throw new ApiError(
      422,
      "INVALID_PERIOD",
      "Use an ordered period of at most 366 Manila calendar days. End is exclusive.",
    );
  return { from, to };
}
export // No automatic refresh. Cache invalidation is driven only by successful writes.
let generation = 0;
export const invalidateReports = () => {
  generation++;
};
export const cache = new Map<
  string,
  {
    until: number;
    value: unknown;
  }
>();
export function createReportsService(db: PrismaClient, demoMode: boolean) {
  const getOverview = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const user = requireIdentity(requestContext.user),
      period = reportingPeriod(requestInput.query),
      canQuality = user.permissions.includes("domain:quality"),
      canField = user.permissions.includes("domain:field"),
      canCustomer = user.permissions.includes("domain:customer"),
      canBalance = user.permissions.includes("reports:nrw"),
      key = `${user.organizationId}:${stableHash([...user.permissions].sort())}:${period.from.toISOString()}:${period.to.toISOString()}:${generation}`,
      found = cache.get(key);
    if (found && found.until > Date.now()) return { data: found.value };
    const now = new Date(),
      week = new Date(now.getTime() - 7 * 86400000),
      where = { organizationId: user.organizationId, archivedAt: null };
    const [nrw, quality, leaks, complaints, workOrders, sources, dq] =
      await Promise.all([
        canBalance ? nrwReport(db, user.organizationId, period) : null,
        canQuality ? waterReport(db, user.organizationId, week, now) : null,
        canField
          ? db.leakReport.findMany({
              where: { ...where, resolvedAt: null },
              orderBy: { reportedAt: "asc" },
            })
          : [],
        canCustomer
          ? db.customerComplaint.count({
              where: { ...where, status: { in: ["OPEN", "ASSIGNED"] } },
            })
          : null,
        canField
          ? db.workOrder.findMany({
              where: { ...where, status: { notIn: ["COMPLETED", "CLOSED"] } },
              orderBy: [{ priority: "asc" }, { reportedAt: "asc" }],
            })
          : [],
        user.permissions.includes("integrations:read")
          ? db.sourceSystem.findMany({
              where: { organizationId: user.organizationId },
              select: {
                id: true,
                name: true,
                code: true,
                domain: true,
                method: true,
                lastSuccessAt: true,
                freshnessHours: true,
                entity: true,
              },
            })
          : [],
        user.permissions.includes("dq:read")
          ? db.dQRun.findFirst({
              where: {
                organizationId: user.organizationId,
                status: "SUCCEEDED",
              },
              orderBy: { startedAt: "desc" },
            })
          : null,
      ]);
    const districtAreas =
      nrw?.dmas ??
      (await db.districtMeteredArea.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { code: "asc" },
      }));
    const dmas = districtAreas.map((d) => ({
      ...d,
      ...(canQuality
        ? {
            breaches: quality!.rows.filter((r) => r.dmaId === d.id && r.breach)
              .length,
          }
        : {}),
      ...(canField
        ? { leaks: leaks.filter((l) => l.dmaId === d.id).length }
        : {}),
    }));
    const value = {
      synthetic: demoMode,
      observedAt: now,
      period: { from: period.from, to: period.to, endExclusive: true },
      nrw: nrw
        ? {
            inputM3: nrw.inputM3,
            billedM3: nrw.billedM3,
            nrwPct: nrw.nrwPct,
            formula: nrw.formula,
          }
        : null,
      quality: quality
        ? {
            total: quality.total,
            breached: quality.breached,
            invalid: quality.invalid,
            compliancePct: quality.compliancePct,
            period: quality.period,
            limitsNotice: quality.limitsNotice,
          }
        : null,
      activeLeaks: canField ? leaks.length : null,
      openComplaints: complaints,
      dmas,
      sources,
      dq,
      attention: [
        ...(quality?.rows ?? [])
          .filter((r) => r.breach)
          .map((r) => ({
            id: r.id,
            kind: "Quality breach",
            title: `${r.parameter}: ${r.value} ${r.unit}`,
            detail: `${r.point} · limits ${r.limitMin}–${r.limitMax} ${r.unit}`,
            dmaId: r.dmaId,
            date: r.sampledAt,
            status: r.correctiveAction ? "Action linked" : "Action required",
            href: `/operations/water-quality?record=${r.id}`,
            severity: "ERROR",
          })),
        ...leaks.map((l) => ({
          id: l.id,
          kind: "Active leak",
          title: l.reference,
          detail: `${l.location} · ${l.estimatedLossM3Day} m³/day estimated loss`,
          dmaId: l.dmaId,
          date: l.reportedAt,
          status: l.workOrderId ? "Work order linked" : "Dispatch required",
          href: `/operations/leaks?record=${l.id}`,
          severity: "WARNING",
        })),
      ],
      workOrders: workOrders.map(
        ({ id, reference, title, status, priority, dmaId, reportedAt }) => ({
          id,
          reference,
          title,
          status,
          priority,
          dmaId,
          reportedAt,
        }),
      ),
    };
    if (cache.size > 50) cache.clear();
    cache.set(key, { until: Date.now() + 15000, value });
    return { data: value };
  };
  const getReportsReport = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const report = reportNameSchema.parse(requestInput.params.report),
      format = reportFormatSchema.parse(requestInput.query.format),
      dmaId = reportDmaFilterSchema.parse(requestInput.query.dmaId),
      user = requireIdentity(requestContext.user);
    if (
      report === "water-quality" &&
      !user.permissions.includes("domain:quality")
    )
      throw new ApiError(
        403,
        "DOMAIN_FORBIDDEN",
        "Water-quality reports require laboratory-domain access.",
      );
    if (report === "nrw" && !user.permissions.includes("reports:nrw"))
      throw new ApiError(
        403,
        "DOMAIN_FORBIDDEN",
        "NRW analysis requires water-balance permission.",
      );
    if (
      dmaId &&
      !(await db.districtMeteredArea.findFirst({
        where: { id: dmaId, organizationId: user.organizationId },
      }))
    )
      throw new ApiError(404, "NOT_FOUND", "DMA not found.");
    const period =
      report === "water-quality" &&
      !requestInput.query.from &&
      !requestInput.query.to
        ? { from: new Date(Date.now() - 7 * 86400000), to: new Date() }
        : reportingPeriod(requestInput.query);
    let data: unknown;
    let rows: Record<string, unknown>[];
    if (report === "nrw") {
      const result = await nrwReport(db, user.organizationId, period, dmaId);
      data = result;
      rows = result.dmas.map(
        ({
          code,
          name,
          inputM3,
          billedM3,
          lossM3,
          nrwPct,
          inputRecords,
          billingRecords,
          warning,
        }) => ({
          code,
          name,
          inputM3,
          billedM3,
          lossM3,
          nrwPct,
          inputRecords,
          billingRecords,
          warning,
          periodStart: period.from,
          periodEnd: period.to,
        }),
      );
    } else if (report === "water-quality") {
      const result = await waterReport(
        db,
        user.organizationId,
        period.from,
        period.to,
      );
      data = result;
      rows = result.rows.map((r) => ({
        id: r.id,
        sampleReference: r.sampleReference,
        point: r.point,
        parameter: r.parameter,
        value: r.value,
        unit: r.unit,
        limitMin: r.limitMin,
        limitMax: r.limitMax,
        breach: r.breach,
        sampledAt: r.sampledAt,
        enteredBy: r.enteredBy,
        correctionVersion: r.correctionVersion,
        valid: r.valid,
        standardCode: r.standardCode,
        referenceSection: r.referenceSection,
        method: r.method,
        correctiveAction: r.correctiveAction?.reference ?? "",
      }));
    } else {
      const [work, complaints, leaks] = await Promise.all([
        db.workOrder.findMany({
          where: {
            organizationId: user.organizationId,
            archivedAt: null,
            reportedAt: { gte: period.from, lt: period.to },
          },
        }),
        db.customerComplaint.findMany({
          where: {
            organizationId: user.organizationId,
            archivedAt: null,
            reportedAt: { gte: period.from, lt: period.to },
          },
          select: {
            category: true,
            status: true,
            reportedAt: true,
            resolvedAt: true,
          },
        }),
        db.leakReport.findMany({
          where: {
            organizationId: user.organizationId,
            archivedAt: null,
            reportedAt: { gte: period.from, lt: period.to },
          },
        }),
      ]);
      const dispatch = work
          .filter((w) => w.dispatchedAt)
          .map(
            (w) =>
              (w.dispatchedAt!.getTime() - w.reportedAt.getTime()) / 3600000,
          ),
        repair = work
          .filter((w) => w.completedAt)
          .map(
            (w) =>
              (w.completedAt!.getTime() - w.reportedAt.getTime()) / 3600000,
          ),
        resolution = complaints
          .filter((c) => c.resolvedAt)
          .map(
            (c) => (c.resolvedAt!.getTime() - c.reportedAt.getTime()) / 3600000,
          ),
        avg = (v: number[]) =>
          v.length
            ? Math.round((v.reduce((n, v) => n + v, 0) / v.length) * 100) / 100
            : null;
      rows = [
        {
          periodStart: period.from,
          periodEnd: period.to,
          workOrders: work.length,
          openWorkOrders: work.filter(
            (w) => !["COMPLETED", "CLOSED"].includes(w.status),
          ).length,
          activeLeaks: leaks.filter((l) => !l.resolvedAt).length,
          complaints: complaints.length,
          meanDispatchHours: avg(dispatch),
          meanRepairHours: avg(repair),
          meanComplaintResolutionHours: avg(resolution),
        },
      ];
      data = {
        period,
        ...rows[0],
        complaintsByCategory: [
          ...new Set(complaints.map((c) => c.category)),
        ].map((category) => ({
          category,
          total: complaints.filter((c) => c.category === category).length,
        })),
        backlogByPriority: ["ERROR", "WARNING", "INFO"].map((priority) => ({
          priority,
          total: work.filter(
            (w) =>
              w.priority === priority &&
              !["COMPLETED", "CLOSED"].includes(w.status),
          ).length,
        })),
        timingNotice:
          "Times are measured from report to dispatch/completion; averages exclude unfinished records. Backlog is current state for records reported in the selected period.",
      };
    }
    if (format === "csv") {
      await audit(db, {
        ...serviceAudit(requestContext.audit),
        action: "REPORT_EXPORTED",
        entity: "report",
        entityId: report,
        metadata: {
          from: period.from.toISOString(),
          to: period.to.toISOString(),
          dmaId: dmaId ?? null,
        },
      });
      return {
        kind: "download" as const,
        content: csv(rows),
        filename: `water-hub-${report}.csv`,
      };
    }
    return { kind: "json" as const, payload: { data } };
  };
  return { getOverview, getReportsReport };
}
