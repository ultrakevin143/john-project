import type { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { repository } from "../src/modules/canonical/canonical.repository.js";
import { type Entity } from "../src/modules/canonical/canonical.schemas.js";
import { type DB } from "../src/modules/canonical/canonical.types.js";
import { ruleDefinitions } from "../src/modules/quality/quality.rules.js";
import { runQuality } from "../src/modules/quality/quality.service.js";
import {
  cebuLocations,
  demonstrationTariffs,
  districtProfile,
  qualityParameters,
} from "../src/modules/reference/reference.data.js";
import { tariffAmount } from "../src/modules/reference/tariff.service.js";
import { defaultPeriod } from "../src/modules/reports/reports.service.js";
import { manilaMonthStart } from "../src/shared/dates.js";
import { stableHash } from "../src/shared/hash.js";
import { hashPassword } from "../src/shared/security.js";

export function seedId(key: string) {
  const h = createHash("sha256").update(`john-water-hub:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export const organizationId = seedId("organization");
const domains = [
  "billing",
  "metering",
  "production",
  "quality",
  "field",
  "customer",
  "assets",
];
export const sourceDefinitions = [
  {
    code: "BILL",
    name: "Customer billing",
    entity: "billing",
    domain: "billing",
    method: "CSV batch",
    freshnessHours: 744,
  },
  {
    code: "AMR",
    name: "Metering / AMR",
    entity: "meter-readings",
    domain: "metering",
    method: "CSV batch",
    freshnessHours: 744,
  },
  {
    code: "SCADA",
    name: "Production & distribution",
    entity: "production",
    domain: "production",
    method: "Mock REST",
    freshnessHours: 2,
  },
  {
    code: "LAB",
    name: "Water-quality laboratory",
    entity: "water-quality",
    domain: "quality",
    method: "CSV batch",
    freshnessHours: 24,
  },
  {
    code: "FIELD",
    name: "Field work orders",
    entity: "work-orders",
    domain: "field",
    method: "Mock REST",
    freshnessHours: 24,
  },
  {
    code: "CARE",
    name: "Customer service",
    entity: "complaints",
    domain: "customer",
    method: "Mock REST",
    freshnessHours: 24,
  },
  {
    code: "ASSET",
    name: "Pipeline asset registry",
    entity: "pipelines",
    domain: "assets",
    method: "Mock REST",
    freshnessHours: 168,
  },
];
const allPermissions = [
  "operations:read",
  "integrations:read",
  "integrations:write",
  "dq:read",
  "dq:write",
  "governance:read",
  "governance:write",
  "audit:read",
  "reports:read",
  "reports:nrw",
  "field:write",
  "lab:correct",
  "operations:archive",
  "identity:reveal",
  ...domains.map((d) => `domain:${d}`),
];
export const demoRoles = [
  { code: "admin", name: "Administrator", permissions: allPermissions },
  {
    code: "operator",
    name: "Integration operator",
    permissions: [
      "operations:read",
      "integrations:read",
      "integrations:write",
      "dq:read",
      "governance:read",
      "reports:read",
      "reports:nrw",
      ...domains.map((d) => `domain:${d}`),
    ],
  },
  {
    code: "steward",
    name: "Data steward",
    permissions: allPermissions.filter(
      (p) =>
        !["operations:archive", "identity:reveal", "field:write"].includes(p),
    ),
  },
  {
    code: "analyst",
    name: "District analyst",
    permissions: allPermissions.filter(
      (p) =>
        !p.endsWith(":write") &&
        !p.endsWith(":correct") &&
        !p.endsWith(":archive") &&
        !p.endsWith(":reveal") &&
        p !== "audit:read",
    ),
  },
  {
    code: "billing",
    name: "Billing analyst",
    permissions: [
      "operations:read",
      "reports:read",
      "reports:nrw",
      "domain:billing",
      "domain:metering",
    ],
  },
  {
    code: "plant",
    name: "Plant operator",
    permissions: [
      "operations:read",
      "reports:read",
      "domain:production",
      "domain:assets",
    ],
  },
  {
    code: "lab",
    name: "Lab analyst",
    permissions: [
      "operations:read",
      "reports:read",
      "lab:correct",
      "domain:quality",
    ],
  },
  {
    code: "field",
    name: "Field supervisor",
    permissions: [
      "operations:read",
      "reports:read",
      "field:write",
      "domain:field",
      "domain:customer",
      "domain:assets",
    ],
  },
];
export async function seed(db: PrismaClient, password: string) {
  if (password.length < 12)
    throw new Error("Synthetic seed password requires at least 12 characters.");
  const now = new Date(),
    iso = now.toISOString(),
    day = 86400000,
    period = defaultPeriod(now),
    previousStart = manilaMonthStart(period.from, -1),
    installed = new Date(now.getTime() - 3 * 365 * day).toISOString(),
    hash = await hashPassword(password);
  await db.organization.upsert({
    where: { id: organizationId },
    create: {
      id: organizationId,
      name: districtProfile.name,
    },
    update: {},
  });
  for (const role of demoRoles) {
    const roleId = seedId(`role:${role.code}`);
    await db.role.upsert({
      where: { id: roleId },
      create: { id: roleId, organizationId, code: role.code, name: role.name },
      update: {},
    });
    for (const code of role.permissions)
      await db.permission.upsert({
        where: { roleId_code: { roleId, code } },
        create: { roleId, code },
        update: {},
      });
    await db.user.upsert({
      where: { email: `${role.code}@waterhub.demo` },
      create: {
        id: seedId(`user:${role.code}`),
        organizationId,
        email: `${role.code}@waterhub.demo`,
        name: `Demo ${role.name.toLowerCase()}`,
        roleId,
        passwordHash: hash,
      },
      update: {},
    });
  }
  for (const code of domains)
    await db.dataDomain.upsert({
      where: { id: seedId(`domain:${code}`) },
      create: {
        id: seedId(`domain:${code}`),
        organizationId,
        code,
        name: (
          {
            billing: "Billing",
            metering: "Metering",
            production: "Production",
            quality: "Water quality",
            field: "Field operations",
            customer: "Customer service",
            assets: "Asset registry",
          } as Record<string, string>
        )[code]!,
        description: `Governed ${code} information for the demonstration water district.`,
        owner: `${code} department`,
        steward: `${code} data steward`,
      },
      update: {},
    });
  for (const source of sourceDefinitions) {
    const sourceSystemId = seedId(`source:${source.code}`);
    await db.sourceSystem.upsert({
      where: { id: sourceSystemId },
      create: {
        ...source,
        id: sourceSystemId,
        organizationId,
        lastSuccessAt: new Date(
          now.getTime() - (source.code === "ASSET" ? 8 * day : 3600000),
        ),
      },
      update: {},
    });
    for (const adapter of ["csv", "mock"])
      await db.integrationConnection.upsert({
        where: { sourceSystemId_adapter: { sourceSystemId, adapter } },
        create: { sourceSystemId, organizationId, adapter, enabled: true },
        update: {},
      });
  }
  const ownerByEntity: Record<Entity, string> = {
    accounts: "BILL",
    billing: "BILL",
    "service-connections": "AMR",
    meters: "AMR",
    "meter-readings": "AMR",
    facilities: "SCADA",
    production: "SCADA",
    "sampling-points": "LAB",
    "water-quality": "LAB",
    "work-orders": "FIELD",
    leaks: "FIELD",
    complaints: "CARE",
    pipelines: "ASSET",
  };
  async function canonical(
    entity: Entity,
    key: string,
    data: Record<string, unknown>,
  ) {
    const id = seedId(key),
      sourceSystemId = seedId(`source:${ownerByEntity[entity]}`),
      record = {
        ...data,
        id,
        organizationId,
        sourceSystemId,
        sourceRecordId: key,
        sourceUpdatedAt: now,
        sourceVersion: stableHash(data),
      };
    await repository(db, entity).upsert({
      where: {
        organizationId_sourceSystemId_sourceRecordId: {
          organizationId,
          sourceSystemId,
          sourceRecordId: key,
        },
      },
      create: record,
      update: {},
    });
    return id;
  }
  const tariffId = seedId("tariff:residential");
  await db.tariff.upsert({
    where: { id: tariffId },
    create: {
      id: tariffId,
      organizationId,
      ...demonstrationTariffs[0]!,
    },
    update: {},
  });
  const parameters = qualityParameters;
  for (const p of parameters)
    await db.waterQualityParameter.upsert({
      where: { id: seedId(`parameter:${p.code}`) },
      create: {
        ...p,
        id: seedId(`parameter:${p.code}`),
        organizationId,
      },
      update: {},
    });
  const dmaNames = cebuLocations.map((p) => `${p.barangay} demo`),
    positions = [
      [20, 25],
      [75, 22],
      [44, 65],
      [85, 80],
    ];
  for (let d = 0; d < 4; d++) {
    const dmaId = seedId(`dma:${d}`),
      code = `DMA-${String(d + 1).padStart(2, "0")}`,
      name = dmaNames[d]!;
    await db.districtMeteredArea.upsert({
      where: { id: dmaId },
      create: {
        id: dmaId,
        organizationId,
        code,
        name,
        connections: 6,
        diagramX: positions[d]![0]!,
        diagramY: positions[d]![1]!,
        ...cebuLocations[d]!,
      },
      update: {},
    });
    const pipeId = await canonical("pipelines", `pipe:${d}`, {
      code: `PIPE-${d + 1}`,
      dmaId,
      material: d % 2 ? "HDPE" : "Ductile iron",
      diameterMm: 150,
      lengthM: 1800 + d * 300,
      installedAt: new Date(installed),
    });
    const pointId = await canonical("sampling-points", `point:${d}`, {
      code: `SP-${d + 1}`,
      name: `${name} distribution tap`,
      dmaId,
    });
    const qualityAction = await canonical(
      "work-orders",
      `quality-action:${d}`,
      {
        reference: `WQ-${d + 101}`,
        title: `Review ${name} water-quality sample`,
        dmaId,
        category: "WATER_QUALITY",
        priority: "ERROR",
        status: d === 1 ? "IN_PROGRESS" : "OPEN",
        assignee: "Demonstration quality response team",
        reportedAt: new Date(now.getTime() - 3 * 3600000),
        ...(d === 1
          ? { dispatchedAt: new Date(now.getTime() - 2 * 3600000) }
          : {}),
      },
    );
    for (let p = 0; p < parameters.length; p++) {
      const parameter = parameters[p]!,
        value =
          parameter.code === "CL"
            ? d === 0
              ? 0.12
              : 0.45
            : parameter.code === "TURB"
              ? d === 1
                ? 6.2
                : 1.1
              : parameter.code === "PH"
                ? 7.3
                : 0;
      await canonical("water-quality", `sample:${d}:${parameter.code}`, {
        sampleReference: `LAB-${d + 101}`,
        samplingPointId: pointId,
        parameterId: seedId(`parameter:${parameter.code}`),
        value,
        unit: parameter.unit,
        sampledAt: new Date(now.getTime() - 90 * 60000),
        enteredBy: "Demonstration laboratory analyst",
        ...(d === 1 && parameter.code === "TURB"
          ? { correctiveActionId: qualityAction }
          : {}),
      });
    }
    if (d < 3) {
      const workOrderId = await canonical("work-orders", `leak-work:${d}`, {
        reference: `WO-${d + 201}`,
        title: `Repair ${name.toLowerCase()} distribution leak`,
        dmaId,
        category: "LEAK_REPAIR",
        priority: d === 0 ? "ERROR" : "WARNING",
        status: d === 0 ? "OPEN" : "IN_PROGRESS",
        assignee: d === 0 ? "Unassigned" : "Demonstration crew B",
        reportedAt: new Date(now.getTime() - (d + 2) * 3600000),
        ...(d
          ? { dispatchedAt: new Date(now.getTime() - (d + 1) * 3600000) }
          : {}),
      });
      await canonical("leaks", `leak:${d}`, {
        reference: `LK-${d + 301}`,
        dmaId,
        pipelineId: pipeId,
        workOrderId,
        location: `${name} sector ${d + 1}`,
        estimatedLossM3Day: 35 + d * 12,
        reportedAt: new Date(now.getTime() - (d + 2) * 3600000),
      });
    }
    let billed = 0;
    for (let c = 0; c < 6; c++) {
      const key = `${d}:${c}`,
        accountId = await canonical("accounts", `account:${key}`, {
          accountNumber: `DEMO-${d + 1}${String(c + 1).padStart(4, "0")}`,
          customerName: `Synthetic household ${d + 1}-${c + 1}`,
          address: `Synthetic block ${c + 1}, Barangay ${cebuLocations[d]!.barangay}, Cebu City, Philippines`,
          city: cebuLocations[d]!.city,
          barangay: cebuLocations[d]!.barangay,
          tariffId,
          active: true,
        });
      const connectionId = await canonical(
        "service-connections",
        `connection:${key}`,
        {
          code: `SC-${d + 1}-${c + 1}`,
          accountId,
          dmaId,
          status: "ACTIVE",
          installedAt: new Date(installed),
        },
      );
      const meterId = await canonical("meters", `meter:${key}`, {
        serialNumber: `MTR-${d + 1}${String(c + 1).padStart(4, "0")}`,
        connectionId,
        status: "ACTIVE",
        installedAt: new Date(installed),
      });
      const consumption = d === 2 && c === 0 ? 185 : 18 + d * 4 + c * 2,
        register = 1000 + d * 100 + c * 50;
      await canonical("meter-readings", `reading:previous:${key}`, {
        meterId,
        connectionId,
        previousM3: register - 25,
        currentM3: register,
        consumptionM3: 25,
        readType: "ACTUAL",
        occurredAt: new Date(period.from.getTime() - 3600000),
        periodStart: previousStart,
        periodEnd: period.from,
        replacementRecorded: false,
      });
      const meterReadingId = await canonical(
        "meter-readings",
        `reading:${key}`,
        {
          meterId,
          connectionId,
          previousM3: register,
          currentM3: register + consumption,
          consumptionM3: consumption,
          readType: c === 0 || (d === 0 && c === 1) ? "ESTIMATED" : "ACTUAL",
          occurredAt: new Date(period.to.getTime() - 3600000),
          periodStart: period.from,
          periodEnd: period.to,
          replacementRecorded: false,
        },
      );
      const billedM3 = consumption + (d === 1 && c === 1 ? 3 : 0);
      billed += billedM3;
      await canonical("billing", `bill:${key}`, {
        reference: `BILL-${d + 1}-${c + 1}`,
        accountId,
        connectionId,
        meterReadingId,
        dmaId,
        tariffId,
        billedM3,
        amount: tariffAmount(billedM3, demonstrationTariffs[0]!),
        periodStart: period.from,
        periodEnd: period.to,
        paymentStatus: c % 2 ? "PAID" : "UNPAID",
      });
      if (c < 2)
        await canonical("complaints", `complaint:${key}`, {
          reference: `CS-${d + 1}-${c + 1}`,
          accountId,
          dmaId,
          category: c === 0 ? "LOW_PRESSURE" : "BILLING_DISPUTE",
          customerAlias: `Synthetic contact ${key}`,
          status: c === 0 ? "ASSIGNED" : "RESOLVED",
          reportedAt: new Date(now.getTime() - 2 * day),
          ...(c ? { resolvedAt: new Date(now.getTime() - day) } : {}),
        });
    }
    for (let f = 0; f < 2; f++) {
      const facilityId = await canonical("facilities", `facility:${d}:${f}`, {
        code: `FAC-${d + 1}-${f + 1}`,
        name: `${name} ${f ? "reservoir" : "inlet station"}`,
        dmaId,
        type: f ? "RESERVOIR" : "PUMP_STATION",
        capacityM3Day: 1200,
      });
      await canonical("production", `production:period:${d}:${f}`, {
        facilityId,
        dmaId,
        volumeM3: Math.round(billed / (1 - (0.18 + d * 0.05))) * (f ? 0.6 : 1),
        flowLs: 12 + d,
        pressureBar: 3.2,
        periodStart: period.from,
        periodEnd: period.to,
        occurredAt: new Date(period.to.getTime() - 1000),
        isSystemInput: f === 0,
      });
      await canonical("production", `production:latest:${d}:${f}`, {
        facilityId,
        dmaId,
        volumeM3: 20 + d,
        flowLs: 12 + d,
        pressureBar: d === 2 ? 1.1 : 3.2,
        periodStart: new Date(now.getTime() - 3600000),
        periodEnd: now,
        occurredAt: new Date(now.getTime() - 15 * 60000),
        isSystemInput: false,
      });
    }
  }
  for (const [entity, code] of Object.entries(ownerByEntity)) {
    const source = sourceDefinitions.find((s) => s.code === code)!,
      restricted = ["accounts", "billing", "complaints"].includes(entity);
    await db.dataAsset.upsert({
      where: { id: seedId(`asset:${entity}`) },
      create: {
        id: seedId(`asset:${entity}`),
        organizationId,
        domainId: seedId(`domain:${source.domain}`),
        sourceSystemId: seedId(`source:${code}`),
        name: entity.split("-").join(" "),
        entity,
        owner: `${source.domain} department`,
        steward: `${source.domain} data steward`,
        classification: restricted ? "RESTRICTED" : "INTERNAL",
        containsPii: ["accounts", "complaints"].includes(entity),
        retentionDays: restricted ? 2555 : 1095,
        policy:
          "Synthetic demonstration records only. Retention is metadata; approved deletion requires a separate reviewed process.",
      },
      update: {},
    });
  }
  for (const rule of ruleDefinitions)
    await db.dQRule.upsert({
      where: { organizationId_code: { organizationId, code: rule.code } },
      create: { ...rule, organizationId },
      update: {},
    });
  for (const source of sourceDefinitions) {
    const sourceSystemId = seedId(`source:${source.code}`),
      runId = seedId(`seed-run:${source.code}`);
    await db.integrationRun.upsert({
      where: { id: runId },
      create: {
        id: runId,
        organizationId,
        sourceSystemId,
        idempotencyKey: `seed-snapshot-${source.code}`,
        payloadHash: stableHash(source),
        entity: source.entity,
        method: source.method,
        status: "SUCCEEDED",
        startedAt: new Date(now.getTime() - 3700000),
        finishedAt: new Date(now.getTime() - 3600000),
        totalRecords: 1,
        processed: 1,
        initiatedBy: "Synthetic seed",
      },
      update: {},
    });
    await db.rawImportRecord.upsert({
      where: { runId_rowNumber: { runId, rowNumber: 1 } },
      create: {
        id: seedId(`seed-raw:${source.code}`),
        organizationId,
        runId,
        rowNumber: 1,
        sourceRecordId: `seed:${source.code}`,
        payload: { synthetic: true, source: source.code },
        payloadHash: stableHash(source),
        status: "LOADED",
      },
      update: {},
    });
  }
  if (
    !(await db.auditEvent.findFirst({
      where: { organizationId, action: "SYNTHETIC_SEED" },
    }))
  )
    await db.auditEvent.create({
      data: {
        organizationId,
        actorName: "Local setup",
        action: "SYNTHETIC_SEED",
        entity: "workspace",
        requestId: "synthetic-seed",
        metadata: { sources: 7, notice: "Synthetic data only", seededAt: iso },
      },
    });
  await configureCebu(db);
  if (!(await db.dQRun.findFirst({ where: { organizationId } })))
    await runQuality(db, {
      organizationId,
      actorName: "Synthetic seed",
      requestId: "seed-quality",
    });
}
// Reference configuration only. This never creates operational records, users,
// passwords or sessions, so remote setup can keep the requested empty workspace.
export async function configureCebu(db: DB) {
  await db.organization.update({
    where: { id: organizationId },
    data: { name: districtProfile.name, timezone: districtProfile.timezone },
  });
  for (const [i, location] of cebuLocations.entries())
    await db.districtMeteredArea.update({
      where: { id: seedId(`dma:${i}`) },
      data: {
        ...location,
        name: `${location.barangay} demo`,
        connections: await db.serviceConnection.count({
          where: {
            organizationId,
            dmaId: seedId(`dma:${i}`),
            archivedAt: null,
          },
        }),
      },
    });
  for (const tariff of demonstrationTariffs) {
    const id =
      tariff.code === "RES"
        ? seedId("tariff:residential")
        : seedId("tariff:commercial");
    await db.tariff.upsert({
      where: { id },
      create: { id, organizationId, ...tariff },
      update: tariff,
    });
  }
  for (const p of qualityParameters)
    await db.waterQualityParameter.update({
      where: { id: seedId(`parameter:${p.code}`) },
      data: p,
    });
  for (const rule of ruleDefinitions)
    await db.dQRule.upsert({
      where: { organizationId_code: { organizationId, code: rule.code } },
      create: { ...rule, organizationId },
      update: {
        name: rule.name,
        description: rule.description,
        config: rule.config,
      },
    });
  for (const code of domains) {
    const owner = (
      {
        billing: "Commercial Services manager",
        metering: "Metering supervisor",
        production: "Production and Distribution manager",
        quality: "Water Quality laboratory head",
        field: "Pipeline Maintenance supervisor",
        customer: "Customer Services manager",
        assets: "Engineering manager",
      } as Record<string, string>
    )[code]!;
    await db.dataDomain.update({
      where: { id: seedId(`domain:${code}`) },
      data: {
        owner,
        steward: `${code} data steward`,
        description: `Cebu prototype ${code} data. Department titles are illustrative, not MCWD's organization chart.`,
      },
    });
    await db.dataAsset.updateMany({
      where: { organizationId, domainId: seedId(`domain:${code}`) },
      data: {
        owner,
        policy:
          "Philippine prototype policy: purpose-limited access, minimum necessary fields, masked customer identity and audited corrections. Retention periods are illustrative and require owner/legal approval; no automatic deletion or legal-compliance certification.",
      },
    });
  }
}
