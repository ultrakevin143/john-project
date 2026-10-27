import type { PrismaClient } from "@prisma/client";

export async function nrwReport(
  db: PrismaClient,
  organizationId: string,
  period: {
    from: Date;
    to: Date;
  },
  dmaId?: string,
) {
  const where = {
    organizationId,
    archivedAt: null,
    ...(dmaId ? { dmaId } : {}),
    periodStart: { gte: period.from },
    periodEnd: { lte: period.to },
  };
  const [dmas, production, billing] = await Promise.all([
    db.districtMeteredArea.findMany({
      where: { organizationId, ...(dmaId ? { id: dmaId } : {}) },
      orderBy: { code: "asc" },
    }),
    db.productionReading.findMany({
      where: { ...where, isSystemInput: true },
      orderBy: { periodStart: "asc" },
    }),
    db.billingRecord.findMany({ where, orderBy: { periodStart: "asc" } }),
  ]);
  const rows = dmas.map((d) => {
    const inputs = production.filter((r) => r.dmaId === d.id),
      bills = billing.filter((r) => r.dmaId === d.id),
      inputM3 = inputs.reduce((n, r) => n + Number(r.volumeM3), 0),
      billedM3 = bills.reduce((n, r) => n + Number(r.billedM3), 0),
      lossM3 = inputM3 - billedM3;
    return {
      ...d,
      inputM3,
      billedM3,
      lossM3,
      nrwPct: inputM3 ? Math.round((lossM3 / inputM3) * 10000) / 100 : null,
      inputRecords: inputs.length,
      billingRecords: bills.length,
      warning: !inputM3
        ? "No system input observations"
        : billedM3 > inputM3
          ? "Billed volume exceeds system input"
          : null,
    };
  });
  const inputM3 = rows.reduce((n, r) => n + r.inputM3, 0),
    billedM3 = rows.reduce((n, r) => n + r.billedM3, 0);
  return {
    period: {
      from: period.from,
      to: period.to,
      endExclusive: true,
      timezone: "Asia/Manila",
    },
    formula:
      "NRW % = 100 × (system input m³ − billed m³) / system input m³. Simplified volume balance; includes unbilled authorized use. No input = unavailable.",
    coverage:
      "Only whole intervals contained in the selected period are included; no prorating. Only boundary meters marked system input count. Internal transfer readings are excluded.",
    inputM3,
    billedM3,
    lossM3: inputM3 - billedM3,
    nrwPct: inputM3 ? Math.round((1 - billedM3 / inputM3) * 10000) / 100 : null,
    dmas: rows,
    lineage: dmaId
      ? {
          production,
          billing: billing.map(
            ({
              id,
              reference,
              meterReadingId,
              connectionId,
              sourceSystemId,
              billedM3,
              periodStart,
              periodEnd,
            }) => ({
              id,
              reference,
              meterReadingId,
              connectionId,
              sourceSystemId,
              billedM3,
              periodStart,
              periodEnd,
            }),
          ),
        }
      : undefined,
  };
}
export async function waterReport(
  db: PrismaClient,
  organizationId: string,
  from: Date,
  to: Date,
) {
  const [results, parameters, points, workOrders] = await Promise.all([
    db.waterQualityResult.findMany({
      where: {
        organizationId,
        archivedAt: null,
        sampledAt: { gte: from, lt: to },
      },
      orderBy: { sampledAt: "desc" },
    }),
    db.waterQualityParameter.findMany({ where: { organizationId } }),
    db.samplingPoint.findMany({ where: { organizationId, archivedAt: null } }),
    db.workOrder.findMany({
      where: { organizationId, category: "WATER_QUALITY", archivedAt: null },
      select: { id: true, reference: true, status: true },
    }),
  ]);
  const rows = results.map((r) => {
    const p = parameters.find((p) => p.id === r.parameterId),
      point = points.find((p) => p.id === r.samplingPointId),
      valid =
        !!p &&
        r.unit === p.unit &&
        Number.isFinite(r.value) &&
        r.value >= p.plausibleMin &&
        r.value <= p.plausibleMax &&
        (p.code !== "COLI" || Number.isInteger(r.value)),
      breach = valid ? r.value < p!.limitMin || r.value > p!.limitMax : null;
    return {
      ...r,
      parameter: p?.name ?? "Unknown parameter",
      parameterCode: p?.code,
      point: point?.name ?? "Unknown point",
      dmaId: point?.dmaId,
      limitMin: p?.limitMin,
      limitMax: p?.limitMax,
      standardCode: p?.standardCode,
      standardUrl: p?.standardUrl,
      referenceSection: p?.referenceSection,
      method: p?.method,
      valid,
      breach,
      correctiveAction:
        workOrders.find((w) => w.id === r.correctiveActionId) ?? null,
    };
  });
  const breached = rows.filter((r) => r.breach).length;
  const validCount = rows.filter((r) => r.valid).length;
  return {
    period: { from, to, endExclusive: true, timezone: "Asia/Manila" },
    total: rows.length,
    breached,
    invalid: rows.length - validCount,
    compliancePct: validCount
      ? Math.round((1 - breached / validCount) * 10000) / 100
      : null,
    limitsNotice:
      "PNSDW 2017 reference comparison for four parameters only. Invalid units/ranges are excluded from the within-limit percentage. Synthetic results do not certify water safety. Sampling reminders use a demo schedule; confirm the approved Water Safety Plan and current standards before operational use.",
    rows,
  };
}
