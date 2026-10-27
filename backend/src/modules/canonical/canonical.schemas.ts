import { z } from "zod";

export const entityNames = [
  "accounts",
  "service-connections",
  "meters",
  "meter-readings",
  "billing",
  "facilities",
  "production",
  "pipelines",
  "sampling-points",
  "water-quality",
  "work-orders",
  "leaks",
  "complaints",
] as const;
export type Entity = (typeof entityNames)[number];
export const entitySchema = z.enum(entityNames);
export const text = z.string().trim().min(1).max(200);
export const finite = z.preprocess(
  (v) =>
    typeof v === "number"
      ? v
      : typeof v === "string" && v.trim()
        ? Number(v)
        : undefined,
  z.number().finite(),
);
export const positive = finite.pipe(z.number().nonnegative().max(1e12));
export const timestamp = z.iso
  .datetime({ offset: true })
  .transform((v) => new Date(v));
export const optionalDate = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  timestamp.optional(),
);
export const bool = z.preprocess(
  (v) => (v === "true" ? true : v === "false" ? false : v),
  z.boolean(),
);
export const common = { sourceRecordId: text, sourceUpdatedAt: timestamp };
export const period = { periodStart: timestamp, periodEnd: timestamp };
export const validPeriod = (d: { periodStart: Date; periodEnd: Date }) =>
  d.periodEnd > d.periodStart;
export const schemas = {
  accounts: z
    .object({
      ...common,
      accountNumber: text.transform((v) => v.toUpperCase()),
      customerName: text,
      address: text,
      city: text.optional().default(""),
      barangay: text.optional().default(""),
      tariffId: z.uuid(),
      active: bool.default(true),
    })
    .strict(),
  "service-connections": z
    .object({
      ...common,
      code: text,
      accountId: z.uuid(),
      dmaId: z.uuid(),
      status: z.enum(["ACTIVE", "INACTIVE"]),
      installedAt: timestamp,
    })
    .strict(),
  meters: z
    .object({
      ...common,
      serialNumber: text.transform((v) => v.toUpperCase()),
      connectionId: z.uuid(),
      status: z.enum(["ACTIVE", "INACTIVE", "REPLACED"]),
      installedAt: timestamp,
      replacedAt: optionalDate,
    })
    .strict()
    .refine(
      (d) => d.status !== "REPLACED" || !!d.replacedAt,
      "Replaced meters require replacedAt.",
    ),
  "meter-readings": z
    .object({
      ...common,
      meterId: z.uuid(),
      connectionId: z.uuid(),
      previousM3: positive,
      currentM3: positive,
      consumptionM3: positive,
      readType: z.enum(["ACTUAL", "ESTIMATED"]),
      occurredAt: timestamp,
      ...period,
      replacementRecorded: bool.default(false),
    })
    .strict()
    .refine(validPeriod, "Period end must follow its start.")
    .refine(
      (d) => d.currentM3 >= d.previousM3 || d.replacementRecorded,
      "Decreasing register requires a recorded meter replacement.",
    )
    .refine(
      (d) =>
        Math.abs(
          d.consumptionM3 -
            (d.replacementRecorded && d.currentM3 < d.previousM3
              ? d.currentM3
              : d.currentM3 - d.previousM3),
        ) <= 0.01,
      "Consumption must match register difference (0.01 m³ tolerance).",
    ),
  billing: z
    .object({
      ...common,
      reference: text,
      accountId: z.uuid(),
      connectionId: z.uuid(),
      meterReadingId: z.uuid(),
      dmaId: z.uuid(),
      tariffId: z.uuid(),
      billedM3: positive,
      amount: positive,
      ...period,
      paymentStatus: z.enum(["UNPAID", "PAID", "PARTIAL"]),
    })
    .strict()
    .refine(validPeriod, "Period end must follow its start."),
  facilities: z
    .object({
      ...common,
      code: text,
      name: text,
      dmaId: z.uuid(),
      type: z.enum(["TREATMENT_PLANT", "PUMP_STATION", "RESERVOIR"]),
      capacityM3Day: positive,
    })
    .strict(),
  production: z
    .object({
      ...common,
      facilityId: z.uuid(),
      dmaId: z.uuid(),
      volumeM3: positive,
      flowLs: positive,
      pressureBar: positive,
      ...period,
      occurredAt: timestamp,
      isSystemInput: bool.default(false),
    })
    .strict()
    .refine(validPeriod, "Period end must follow its start."),
  pipelines: z
    .object({
      ...common,
      code: text,
      dmaId: z.uuid(),
      material: text,
      diameterMm: positive,
      lengthM: positive,
      installedAt: timestamp,
    })
    .strict(),
  "sampling-points": z
    .object({ ...common, code: text, name: text, dmaId: z.uuid() })
    .strict(),
  "water-quality": z
    .object({
      ...common,
      sampleReference: text,
      samplingPointId: z.uuid(),
      parameterId: z.uuid(),
      value: finite,
      unit: text,
      sampledAt: timestamp,
      enteredBy: text,
      correctiveActionId: z.preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.uuid().optional(),
      ),
    })
    .strict(),
  "work-orders": z
    .object({
      ...common,
      reference: text,
      title: text,
      dmaId: z.uuid(),
      category: z.enum([
        "LEAK_REPAIR",
        "WATER_QUALITY",
        "METER_REPLACEMENT",
        "MAINTENANCE",
      ]),
      priority: z.enum(["INFO", "WARNING", "ERROR"]),
      status: z.enum([
        "OPEN",
        "DISPATCHED",
        "IN_PROGRESS",
        "COMPLETED",
        "CLOSED",
      ]),
      assignee: text,
      reportedAt: timestamp,
      dispatchedAt: optionalDate,
      completedAt: optionalDate,
    })
    .strict()
    .refine(
      (d) => !["COMPLETED", "CLOSED"].includes(d.status) || !!d.completedAt,
      "Completed/closed work orders require completedAt.",
    )
    .refine(
      (d) => !d.dispatchedAt || d.dispatchedAt >= d.reportedAt,
      "Dispatch cannot precede report.",
    )
    .refine(
      (d) =>
        !d.completedAt || d.completedAt >= (d.dispatchedAt ?? d.reportedAt),
      "Completion cannot precede report/dispatch.",
    ),
  leaks: z
    .object({
      ...common,
      reference: text,
      dmaId: z.uuid(),
      pipelineId: z.uuid(),
      workOrderId: z.preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.uuid().optional(),
      ),
      location: text,
      estimatedLossM3Day: positive,
      reportedAt: timestamp,
      resolvedAt: optionalDate,
    })
    .strict()
    .refine(
      (d) => !d.resolvedAt || d.resolvedAt >= d.reportedAt,
      "Resolution cannot precede report.",
    ),
  complaints: z
    .object({
      ...common,
      reference: text,
      accountId: z.uuid(),
      dmaId: z.uuid(),
      category: z.enum(["LOW_PRESSURE", "NO_WATER", "LEAK", "BILLING_DISPUTE"]),
      customerAlias: text,
      status: z.enum(["OPEN", "ASSIGNED", "RESOLVED", "CLOSED"]),
      reportedAt: timestamp,
      resolvedAt: optionalDate,
    })
    .strict()
    .refine(
      (d) => !["RESOLVED", "CLOSED"].includes(d.status) || !!d.resolvedAt,
      "Resolved/closed complaints require resolvedAt.",
    )
    .refine(
      (d) => !d.resolvedAt || d.resolvedAt >= d.reportedAt,
      "Resolution cannot precede report.",
    ),
};
export const validateRecord = (entity: Entity, payload: unknown) =>
  schemas[entity].safeParse(payload);
