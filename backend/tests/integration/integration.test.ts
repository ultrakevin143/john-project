import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import request from "supertest";
import {
  configureCebu,
  demoRoles,
  organizationId,
  seed,
  seedId,
} from "../../prisma/seed.js";
import { emptyWaterRecords } from "../../scripts/empty-water-records.js";
import { createApp } from "../../src/app.js";
import { getConfig, isLoopback } from "../../src/config/env.js";
import { schemas } from "../../src/modules/canonical/canonical.schemas.js";
import { evaluate } from "../../src/modules/quality/quality.engine.js";
import {
  snapshot,
  type Snapshot,
} from "../../src/modules/quality/quality.repository.js";
import { ruleDefinitions } from "../../src/modules/quality/quality.rules.js";
import { tariffAmount } from "../../src/modules/reference/tariff.service.js";
import { csv } from "../../src/shared/csv.js";

const url = new URL(process.env.DATABASE_URL!);
assert.ok(
  isLoopback(url.hostname) &&
    /^\/water_hub_test(?:_[a-z0-9]+)?$/.test(url.pathname),
  "Integration tests refuse non-local or non-test databases",
);
const db = new PrismaClient(),
  config = getConfig({ ...process.env, NODE_ENV: "test" }),
  app = createApp(db, config),
  agents = Object.fromEntries(
    demoRoles.map((r) => [r.code, request.agent(app)]),
  );
before(async () => {
  await seed(db, process.env.SEED_PASSWORD!);
  for (const role of demoRoles)
    await agents[role.code]!.post("/auth/login")
      .send({
        email: `${role.code}@waterhub.demo`,
        password: process.env.SEED_PASSWORD,
      })
      .expect(200);
});
after(async () => {
  await db.$disconnect();
});
const admin = agents.admin!,
  operator = agents.operator!,
  analyst = agents.analyst!,
  lab = agents.lab!,
  field = agents.field!,
  plant = agents.plant!;
test("health, readiness, API contract and error responses", async () => {
  await request(app).get("/health").expect(200);
  await request(app).get("/ready").expect(200);
  const spec = await request(app).get("/openapi.json").expect(200);
  assert.equal(spec.body.openapi, "3.1.0");
  assert.ok(spec.body.paths["/dq/scorecards"]);
  const denied = await request(app).get("/operations/accounts").expect(401);
  assert.ok(denied.body.error.requestId);
  assert.equal(denied.headers["cache-control"], "no-store");
  await admin.get("/operations/not-an-entity").expect(422);
  await admin.get("/operations/meters?page=0").expect(422);
  await admin.get("/operations/meters?status=COMPLETED").expect(422);
});
test("domain roles, restricted identities and least-privilege writes", async () => {
  await plant.get("/operations/billing").expect(403);
  await plant.get("/operations/accounts").expect(403);
  await plant.get("/operations/production").expect(200);
  await plant.get("/reports/nrw").expect(403);
  await lab.get("/operations/water-quality").expect(200);
  await lab.get("/operations/accounts").expect(403);
  const accounts = await admin.get("/operations/accounts").expect(200);
  assert.ok(accounts.body.data[0].accountNumber.startsWith("••••"));
  assert.equal(accounts.body.data[0].customerName, "Synthetic customer ••••");
  await analyst.post("/dq/runs").send({}).expect(403);
  await analyst.post("/integrations/imports").send({}).expect(403);
  await analyst.get("/audit-events").expect(403);
});
test("CSV quarantine, replay protection and selected corrected retry", async () => {
  const now = new Date().toISOString(),
    sourceSystemId = seedId("source:FIELD"),
    key = `integration-${randomUUID()}`,
    base = {
      sourceRecordId: "integration-work-valid",
      sourceUpdatedAt: now,
      reference: "DEMO-INTEGRATION-1",
      title: "Synthetic main leak inspection",
      dmaId: seedId("dma:0"),
      category: "LEAK_REPAIR",
      priority: "WARNING",
      status: "OPEN",
      assignee: "Demonstration test crew",
      reportedAt: now,
    },
    invalid = {
      ...base,
      sourceRecordId: "integration-work-bad",
      reference: "DEMO-INTEGRATION-2",
      category: "UNKNOWN",
    };
  const input = {
    sourceSystemId,
    entity: "work-orders",
    format: "csv",
    idempotencyKey: key,
    csv: csv([base, invalid]),
  };
  const first = await operator
    .post("/integrations/imports")
    .send(input)
    .expect(201);
  assert.equal(first.body.data.processed, 1);
  assert.equal(first.body.data.failed, 1);
  const replay = await operator
    .post("/integrations/imports")
    .send(input)
    .expect(201);
  assert.equal(replay.body.data.replayed, true);
  assert.equal(replay.body.data.id, first.body.data.id);
  await operator
    .post("/integrations/imports")
    .send({ ...input, csv: csv([base]) })
    .expect(409);
  const detail = await operator
      .get(`/integrations/runs/${first.body.data.id}`)
      .expect(200),
    error = detail.body.data.errors[0];
  const retry = await operator
    .post(`/integrations/runs/${first.body.data.id}/retry`)
    .send({
      corrections: [
        { errorId: error.id, payload: { ...invalid, category: "LEAK_REPAIR" } },
      ],
    })
    .expect(200);
  assert.equal(retry.body.data.processed, 2);
  assert.equal(retry.body.data.failed, 0);
  assert.equal(retry.body.data.totalRecords, 2);
  assert.equal(
    await db.workOrder.count({
      where: {
        organizationId,
        reference: { in: [base.reference, invalid.reference] },
      },
    }),
    2,
  );
});
test("malformed CSV headers and disabled adapters are rejected", async () => {
  const sourceSystemId = seedId("source:SCADA");
  await operator
    .post("/integrations/imports")
    .send({
      sourceSystemId,
      idempotencyKey: randomUUID(),
      format: "csv",
      csv: "sourceRecordId,sourceRecordId\na,b",
    })
    .expect(422);
  await db.integrationConnection.update({
    where: { sourceSystemId_adapter: { sourceSystemId, adapter: "mock" } },
    data: { enabled: false },
  });
  try {
    await operator
      .post("/integrations/imports")
      .send({ sourceSystemId, idempotencyKey: randomUUID(), format: "mock" })
      .expect(409);
  } finally {
    await db.integrationConnection.update({
      where: { sourceSystemId_adapter: { sourceSystemId, adapter: "mock" } },
      data: { enabled: true },
    });
  }
});
test("all twenty-one DQM checks pass valid observations and detect a targeted defect", async (t) => {
  const original = await snapshot(db, organizationId),
    clone = () => JSON.parse(JSON.stringify(original)) as Snapshot;
  const clean = clone();
  for (const source of clean.sources)
    source.lastSuccessAt = new Date().toISOString();
  for (const r of clean.entities["meter-readings"]) r.readType = "ACTUAL";
  for (const r of clean.entities.production) r.pressureBar = 3.2;
  for (const r of clean.entities.billing) {
    const reading = clean.entities["meter-readings"].find(
      (m) => m.id === r.meterReadingId,
    )!;
    r.billedM3 = Number(reading.consumptionM3);
    const tariff = clean.tariffs.find((t) => t.id === r.tariffId)!;
    r.amount = tariffAmount(Number(r.billedM3), {
      baseVolumeM3: Number(tariff.baseVolumeM3),
      baseCharge: Number(tariff.baseCharge),
      ratePerM3: Number(tariff.ratePerM3),
      blocks: tariff.blocks,
    });
  }
  for (const r of clean.entities["water-quality"]) {
    const p = clean.parameters.find((p) => p.id === r.parameterId)!;
    r.value = (Number(p.limitMin) + Number(p.limitMax)) / 2;
  }
  const mutations: Record<string, (s: Snapshot) => void> = {
    completeness: (s) => {
      s.entities.accounts[0]!.customerName = "  ";
    },
    timestamps: (s) => {
      s.entities.accounts[0]!.sourceUpdatedAt = new Date(Date.now() + 86400000);
    },
    quantities: (s) => {
      s.entities.production[0]!.volumeM3 = -1;
    },
    references: (s) => {
      s.entities.accounts[0]!.tariffId = randomUUID();
    },
    "source-duplicates": (s) => {
      s.raw.push({ ...s.raw[0]!, id: randomUUID() });
    },
    identifiers: (s) => {
      s.entities.meters[1]!.serialNumber = String(
        s.entities.meters[0]!.serialNumber,
      ).toLowerCase();
    },
    lineage: (s) => {
      s.entities["meter-readings"][0]!.meterId = randomUUID();
    },
    sequence: (s) => {
      s.entities["meter-readings"][0]!.currentM3 = 0;
    },
    billing: (s) => {
      s.entities.billing[0]!.billedM3 =
        Number(s.entities.billing[0]!.billedM3) + 10;
    },
    estimated: (s) => {
      for (const r of s.entities["meter-readings"]) r.readType = "ESTIMATED";
    },
    "lab-range": (s) => {
      s.entities["water-quality"][0]!.unit = "wrong-unit";
    },
    "lab-action": (s) => {
      const r = s.entities["water-quality"][0]!,
        p = s.parameters.find((p) => p.id === r.parameterId)!;
      r.value = Number(p.limitMax) + 1;
      r.correctiveActionId = null;
    },
    "work-status": (s) => {
      s.entities["work-orders"][0]!.status = "CLOSED";
      s.entities["work-orders"][0]!.completedAt = null;
    },
    "complaint-status": (s) => {
      s.entities.complaints[0]!.status = "RESOLVED";
      s.entities.complaints[0]!.resolvedAt = null;
    },
    freshness: (s) => {
      s.sources[0]!.lastSuccessAt = "2000-01-01T00:00:00Z";
    },
    outliers: (s) => {
      s.entities.production[0]!.pressureBar = 100;
    },
    classification: (s) => {
      const asset = s.assets.find((a) => a.entity === "accounts")!;
      asset.classification = "PUBLIC";
    },
    "cebu-location": (s) => {
      s.entities.accounts[0]!.barangay = "Not a configured barangay";
    },
    "tariff-amount": (s) => {
      s.entities.billing[0]!.amount = 0.01;
    },
    "sampling-interval": (s) => {
      s.entities["water-quality"] = [];
    },
    "standards-provenance": (s) => {
      s.parameters[0]!.standardUrl = "https://unverified.invalid/";
    },
  };
  for (const rule of ruleDefinitions)
    await t.test(rule.code + " " + rule.name, () => {
      const fixture = JSON.parse(JSON.stringify(clean)) as Snapshot;
      const settings = {
        ...rule.config,
        ...(rule.checkId === "outliers" ? { maxConsumptionM3: 1000 } : {}),
      };
      const valid = evaluate(rule.checkId, fixture, settings);
      assert.ok(valid.length > 0, "Rule must evaluate real observations");
      assert.equal(
        valid.filter((o) => o.failed).length,
        0,
        "Baseline must pass",
      );
      mutations[rule.checkId]!(fixture);
      const invalid = evaluate(rule.checkId, fixture, settings);
      assert.ok(
        invalid.some((o) => o.failed),
        "Targeted defect must be detected",
      );
      assert.ok(
        invalid.filter((o) => o.failed).every((o) => o.reason.length > 5),
      );
    });
});
test("quality snapshots persist results and score; remediation never inflates it", async () => {
  const response = await admin.post("/dq/runs").send({}).expect(201),
    run = response.body.data;
  const card = await admin.get(`/dq/scorecards?runId=${run.id}`).expect(200),
    d = card.body.data;
  assert.equal(d.results.length, 21);
  assert.equal(
    d.checked,
    d.results.reduce(
      (
        n: number,
        r: {
          checked: number;
        },
      ) => n + r.checked,
      0,
    ),
  );
  assert.equal(d.score, Math.round((1 - d.failed / d.checked) * 10000) / 100);
  const finding = d.results.find((r: { failed: number }) => r.failed > 0);
  assert.ok(finding);
  await admin
    .patch(`/dq/results/${finding.id}`)
    .send({
      remediation: "ACKNOWLEDGED",
      note: "Demonstration investigation assigned",
    })
    .expect(200);
  assert.equal(
    (await db.dQRun.findUniqueOrThrow({ where: { id: run.id } })).score,
    d.score,
  );
  assert.ok(finding.samples.length <= 5);
  assert.ok(finding.samples[0].label);
  assert.ok(Array.isArray(finding.samples[0].values));
  assert.equal("payload" in finding.samples[0], false);
});
test("unchanged synthetic provider snapshots skip canonical writes and replay safely", async () => {
  const input = {
    sourceSystemId: seedId("source:SCADA"),
    idempotencyKey: randomUUID(),
    format: "mock",
  };
  const first = await operator
    .post("/integrations/imports")
    .send(input)
    .expect(201);
  assert.equal(first.body.data.skipped, 1);
  assert.equal(first.body.data.failed, 0);
  const replay = await operator
    .post("/integrations/imports")
    .send(input)
    .expect(201);
  assert.equal(replay.body.data.id, first.body.data.id);
  assert.equal(replay.body.data.replayed, true);
});
test("imported laboratory corrections preserve the importing actor and request", async () => {
  const row = await db.waterQualityResult.findFirstOrThrow({
    where: { organizationId },
  });
  const keys = Object.keys(schemas["water-quality"].shape);
  const record = Object.fromEntries(
    Object.entries(row)
      .filter(([key, value]) => keys.includes(key) && value !== null)
      .map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString() : value,
      ]),
  );
  const response = await operator
    .post("/integrations/imports")
    .send({
      sourceSystemId: seedId("source:LAB"),
      idempotencyKey: randomUUID(),
      format: "json",
      records: [
        {
          ...record,
          sourceUpdatedAt: new Date(Date.now() + 1000).toISOString(),
          enteredBy: "Synthetic source laboratory reviewer",
        },
      ],
    })
    .expect(201);
  assert.equal(response.body.data.failed, 0);
  assert.equal(response.body.data.processed, 1);
  const event = await db.auditEvent.findFirstOrThrow({
    where: { organizationId, entityId: row.id, action: "LAB_RESULT_CORRECTED" },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(event.actorName, "Demo integration operator");
  assert.equal(event.requestId, response.headers["x-request-id"]);
});
test("NRW excludes transfers and exposes the exact period lineage", async () => {
  const all = await admin.get("/reports/nrw").expect(200),
    dma = all.body.data.dmas[0];
  const detail = await admin.get(`/reports/nrw?dmaId=${dma.id}`).expect(200),
    d = detail.body.data;
  const expected = d.lineage.production.reduce(
      (
        n: number,
        r: {
          volumeM3: string;
        },
      ) => n + Number(r.volumeM3),
      0,
    ),
    billed = d.lineage.billing.reduce(
      (
        n: number,
        r: {
          billedM3: string;
        },
      ) => n + Number(r.billedM3),
      0,
    );
  assert.equal(expected, d.inputM3);
  assert.equal(billed, d.billedM3);
  assert.equal(d.nrwPct, Math.round((1 - billed / expected) * 10000) / 100);
  assert.ok(
    d.lineage.production.every(
      (r: { isSystemInput: boolean }) => r.isSystemInput,
    ),
  );
  const inputCount = await db.productionReading.count({
    where: { organizationId },
  });
  assert.ok(inputCount > d.lineage.production.length);
  await admin.get("/reports/nrw?from=2026-10-01&to=2026-09-01").expect(422);
  const output = await admin.get("/reports/nrw?format=csv").expect(200);
  assert.ok(output.text.includes("inputM3"));
  assert.ok(
    await db.auditEvent.findFirst({
      where: { organizationId, action: "REPORT_EXPORTED" },
    }),
  );
});
test("laboratory corrections require domain permission, version and an audit reason", async () => {
  const row = await db.waterQualityResult.findFirstOrThrow({
      where: { organizationId },
    }),
    p = await db.waterQualityParameter.findUniqueOrThrow({
      where: { id: row.parameterId },
    }),
    body = {
      value: (p.limitMin + p.limitMax) / 2,
      unit: p.unit,
      correctiveActionId: null,
      version: row.correctionVersion,
      reason: "Synthetic verified laboratory correction",
    };
  await plant
    .patch(`/operations/water-quality/${row.id}`)
    .send(body)
    .expect(403);
  await lab
    .patch(`/operations/water-quality/${row.id}`)
    .send({ ...body, reason: "no" })
    .expect(422);
  const changed = await lab
    .patch(`/operations/water-quality/${row.id}`)
    .send(body)
    .expect(200);
  assert.equal(changed.body.data.correctionVersion, row.correctionVersion + 1);
  await lab.patch(`/operations/water-quality/${row.id}`).send(body).expect(409);
  assert.ok(
    await db.auditEvent.findFirst({
      where: {
        organizationId,
        entityId: row.id,
        action: "LAB_RESULT_CORRECTED",
      },
    }),
  );
  await admin
    .post(`/operations/water-quality/${row.id}/archive`)
    .send({ reason: "Synthetic removal request" })
    .expect(403);
  await assert.rejects(db.waterQualityResult.delete({ where: { id: row.id } }));
});
test("governance uses optimistic concurrency and preserves restricted policies", async () => {
  const asset = await db.dataAsset.findFirstOrThrow({
      where: { organizationId, entity: "accounts" },
    }),
    body = {
      owner: asset.owner,
      steward: asset.steward,
      classification: "RESTRICTED",
      retentionDays: asset.retentionDays,
      policy: asset.policy,
      version: asset.version,
      reason: "Synthetic policy review completed",
    };
  await admin
    .patch(`/governance/assets/${asset.id}`)
    .send({ ...body, classification: "PUBLIC" })
    .expect(422);
  await admin.patch(`/governance/assets/${asset.id}`).send(body).expect(200);
  await admin.patch(`/governance/assets/${asset.id}`).send(body).expect(409);
});
test("tenant foreign keys and immutable audit reject direct database violations", async () => {
  const otherId = randomUUID();
  await db.organization.create({
    data: { id: otherId, name: "Second synthetic district" },
  });
  const own = await db.meter.findFirstOrThrow({ where: { organizationId } });
  await assert.rejects(
    db.meter.create({
      data: {
        ...own,
        id: randomUUID(),
        organizationId: otherId,
        serialNumber: "OTHER-TEST",
        sourceRecordId: "OTHER-TEST",
      },
    }),
  );
  const event = await db.auditEvent.findFirstOrThrow({
    where: { organizationId },
  });
  await assert.rejects(
    db.auditEvent.update({
      where: { id: event.id },
      data: { reason: "forbidden rewrite" },
    }),
  );
  await assert.rejects(db.auditEvent.delete({ where: { id: event.id } }));
});
test("response lifecycle rejects shortcuts and accepts a legal dispatch", async () => {
  const work = await db.workOrder.findFirstOrThrow({
    where: { organizationId, status: "OPEN" },
  });
  await field
    .patch(`/operations/work-orders/${work.id}/status`)
    .send({
      status: "COMPLETED",
      updatedAt: work.updatedAt.toISOString(),
      reason: "Synthetic forbidden shortcut",
    })
    .expect(422);
  await field
    .patch(`/operations/work-orders/${work.id}/status`)
    .send({
      status: "DISPATCHED",
      dispatchedAt: new Date().toISOString(),
      updatedAt: work.updatedAt.toISOString(),
      reason: "Synthetic crew dispatched",
    })
    .expect(200);
});
test("request safety, session rotation and logout", async () => {
  await admin
    .post("/dq/runs")
    .set("Origin", "https://untrusted.invalid")
    .send({})
    .expect(403);
  await admin
    .post("/dq/runs")
    .set("Sec-Fetch-Site", "cross-site")
    .send({})
    .expect(403);
  await admin
    .post("/dq/runs")
    .set("Content-Type", "text/plain")
    .send("{}")
    .expect(415);
  await admin
    .post("/dq/runs")
    .set("Content-Type", "application/json")
    .send("{oops")
    .expect(400);
  const session = request.agent(app);
  const login = await session
    .post("/auth/login")
    .send({
      email: "analyst@waterhub.demo",
      password: process.env.SEED_PASSWORD,
    })
    .expect(200);
  const oldCookie = login.headers["set-cookie"];
  assert.ok(oldCookie);
  await session.post("/auth/refresh").send({}).expect(200);
  await request(app)
    .get("/auth/me")
    .set("Cookie", Array.isArray(oldCookie) ? oldCookie : [oldCookie])
    .expect(401);
  await session.post("/auth/logout").send({}).expect(204);
  await session.get("/auth/me").expect(401);
});
test("Cebu reference data is scoped by domain and new tariff versions preserve historic bills", async () => {
  const ref = await admin.get("/reference").expect(200);
  assert.equal(ref.body.data.profile.timezone, "Asia/Manila");
  assert.equal(ref.body.data.areas[0].city, "Cebu City");
  assert.equal(ref.body.data.parameters.length, 4);
  assert.equal(ref.body.data.tariffs.length, 2);
  const plantRef = await plant.get("/reference").expect(200);
  assert.deepEqual(plantRef.body.data.tariffs, []);
  assert.deepEqual(plantRef.body.data.parameters, []);
  const tariff = ref.body.data.tariffs.find(
    (t: { code: string }) => t.code === "RES",
  );
  const body = {
    supersedesId: tariff.id,
    code: "RES-2027",
    name: "Illustrative residential 2027",
    effectiveFrom: "2027-01-01",
    baseVolumeM3: 10,
    baseCharge: 200,
    ratePerM3: 30,
    blocks: [
      { upToM3: 20, rate: 22 },
      { upToM3: null, rate: 30 },
    ],
    reason: "Synthetic rate version for local verification",
  };
  await analyst.post("/reference/tariffs").send(body).expect(403);
  await plant.post("/reference/tariffs").send(body).expect(403);
  await admin
    .post("/reference/tariffs")
    .send({ ...body, blocks: [{ upToM3: 9, rate: 1 }] })
    .expect(422);
  await admin
    .post("/reference/tariffs")
    .send({ ...body, effectiveFrom: "2026-01-01" })
    .expect(409);
  await admin
    .post("/reference/tariffs")
    .send({ ...body, effectiveFrom: "2026-02-01" })
    .expect(409);
  const bills = await db.billingRecord.findMany({
    where: { organizationId },
    orderBy: { id: "asc" },
  });
  const created = await admin.post("/reference/tariffs").send(body).expect(201);
  assert.equal(created.body.data.currency, "PHP");
  assert.equal(created.body.data.effectiveFrom, "2026-12-31T16:00:00.000Z");
  assert.deepEqual(
    await db.billingRecord.findMany({
      where: { organizationId },
      orderBy: { id: "asc" },
    }),
    bills,
  );
  await admin.post("/reference/tariffs").send(body).expect(409);
  assert.ok(
    await db.auditEvent.findFirst({
      where: { organizationId, action: "TARIFF_VERSION_CREATED" },
    }),
  );
});
test("invalid lab units are excluded from reference-limit percentages", async () => {
  const row = await db.waterQualityResult.findFirstOrThrow({
    where: { organizationId },
  });
  await db.waterQualityResult.update({
    where: { id: row.id },
    data: { unit: "wrong-unit" },
  });
  try {
    const report = (await lab.get("/reports/water-quality").expect(200)).body
      .data;
    assert.ok(report.invalid >= 1);
    const invalid = report.rows.find((r: { id: string }) => r.id === row.id);
    assert.equal(invalid.valid, false);
    assert.equal(invalid.breach, null);
  } finally {
    await db.waterQualityResult.update({
      where: { id: row.id },
      data: { unit: row.unit },
    });
  }
});
test("a completed leak repair closes its linked leak and records the actor", async () => {
  const leak = await db.leakReport.findFirstOrThrow({
    where: { organizationId, reference: "LK-301" },
  });
  let work = await db.workOrder.findUniqueOrThrow({
    where: { id: leak.workOrderId! },
  });
  for (const status of ["DISPATCHED", "IN_PROGRESS", "COMPLETED"]) {
    if (work.status === "DISPATCHED" && status === "DISPATCHED") continue;
    const changed = await field
      .patch(`/operations/work-orders/${work.id}/status`)
      .send({
        status,
        updatedAt: work.updatedAt.toISOString(),
        ...(status === "DISPATCHED"
          ? { dispatchedAt: new Date().toISOString() }
          : {}),
        ...(status === "COMPLETED"
          ? { completedAt: new Date().toISOString() }
          : {}),
        reason: "Synthetic Cebu leak repair verified",
      })
      .expect(200);
    work = {
      ...work,
      ...changed.body.data,
      updatedAt: new Date(changed.body.data.updatedAt),
    };
  }
  const closed = await db.leakReport.findUniqueOrThrow({
    where: { id: leak.id },
  });
  assert.ok(closed.resolvedAt);
  const event = await db.auditEvent.findFirstOrThrow({
    where: { organizationId, entityId: leak.id, action: "LEAK_RESOLVED" },
  });
  assert.equal(event.actorName, "Demo field supervisor");
});
test("quality trends preserve real history, weighted domain scores and tenant boundaries", async () => {
  await plant.get("/insights/quality-trends").expect(403);
  await admin.get("/insights/quality-trends?limit=500").expect(422);
  const report = (await admin.get("/insights/quality-trends").expect(200)).body
    .data;
  assert.ok(report.runs.length > 0);
  for (const run of report.runs) {
    const stored = await db.dQRun.findUniqueOrThrow({ where: { id: run.id } });
    assert.equal(stored.organizationId, organizationId);
    assert.equal(
      run.score,
      run.checked
        ? Math.round((1 - run.failed / run.checked) * 10000) / 100
        : null,
    );
  }
  for (const domain of report.domains)
    assert.equal(
      domain.score,
      domain.checked
        ? Math.round((1 - domain.failed / domain.checked) * 10000) / 100
        : null,
    );
});
test("meter reliability identifies missing, estimated and anomalous records without customer identities", async () => {
  await plant.get("/insights/meter-reliability").expect(403);
  await lab.get("/insights/meter-reliability").expect(403);
  const meter = await db.meter.findFirstOrThrow({
    where: { organizationId, status: "ACTIVE" },
  });
  const reading = await db.meterReading.findFirstOrThrow({
    where: { organizationId, meterId: meter.id },
  });
  const localDay = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  const from = localDay(reading.periodStart),
    to = localDay(reading.periodEnd);
  const query = `from=${from}&to=${to}&pageSize=100`;
  const baseline = (
    await admin.get(`/insights/meter-reliability?${query}`).expect(200)
  ).body;
  assert.ok(baseline.summary.expectedMeters > 0);
  const removed = await db.meterReading.updateMany({
    where: { organizationId, meterId: meter.id },
    data: { archivedAt: new Date() },
  });
  assert.ok(removed.count > 0);
  const after = (
    await admin.get(`/insights/meter-reliability?${query}`).expect(200)
  ).body;
  assert.ok(after.data.find((r: { id: string }) => r.id === meter.id).missing);
  assert.ok(after.summary.missingMeters > baseline.summary.missingMeters);
  assert.ok(!JSON.stringify(after).includes("customerName"));
  await db.meterReading.updateMany({
    where: { organizationId, meterId: meter.id },
    data: { archivedAt: null },
  });
  await admin
    .get("/insights/meter-reliability?from=2026-10-02&to=2026-10-01")
    .expect(422);
  await admin
    .get(`/insights/meter-reliability?dmaId=${randomUUID()}`)
    .expect(404);
});
test("maintenance backup failure rolls back; successful empty preserves accounts, audit and guards", async () => {
  const users = await db.user.findMany({
    where: { organizationId },
    orderBy: { id: "asc" },
  });
  const before = await db.billingRecord.count({ where: { organizationId } });
  assert.ok(before > 0);
  await assert.rejects(
    emptyWaterRecords(db, "public", async () => {
      throw new Error("Simulated private-backup failure");
    }),
    /backup failure/,
  );
  assert.equal(
    await db.billingRecord.count({ where: { organizationId } }),
    before,
  );
  const other = await db.organization.create({
    data: { name: "Preserved separate district" },
  });
  const otherRun = await db.dQRun.create({
    data: { organizationId: other.id, initiatedBy: "Separate district" },
  });
  const audits = await db.auditEvent.count({ where: { organizationId } });
  let saved = 0;
  const result = await emptyWaterRecords(
    db,
    "public",
    async (rows) => {
      saved = rows.reduce((n, t) => n + t.rows.length, 0);
    },
    configureCebu,
  );
  assert.ok(saved > 0);
  assert.ok(result.after.every((t) => t.count === 0));
  assert.equal(result.historicalGuardsEnabled, 4);
  assert.deepEqual(
    await db.user.findMany({
      where: { organizationId },
      orderBy: { id: "asc" },
    }),
    users,
  );
  assert.equal(
    await db.auditEvent.count({ where: { organizationId } }),
    audits + 1,
  );
  assert.ok(await db.dQRun.findUnique({ where: { id: otherRun.id } }));
  const overview = (await admin.get("/overview").expect(200)).body.data;
  assert.equal(overview.quality.total, 0);
  assert.equal(overview.quality.compliancePct, null);
  assert.equal(overview.nrw.nrwPct, null);
  assert.equal(overview.activeLeaks, 0);
  assert.equal(overview.dq, null);
  assert.ok(
    overview.sources.every(
      (s: { lastSuccessAt: string | null }) => s.lastSuccessAt === null,
    ),
  );
  const event = await db.auditEvent.findFirstOrThrow({
    where: { organizationId },
  });
  await assert.rejects(db.auditEvent.delete({ where: { id: event.id } }));
});
test("school presentation users enforce admin access, tenant isolation, safe responses and session revocation", async () => {
  await request(app).get("/users").expect(401);
  await operator.get("/users").expect(403);
  await agents.steward!.get("/users/roles").expect(403);
  const roles = (await admin.get("/users/roles").expect(200)).body.data;
  const role = roles.find((r: { code: string }) => r.code === "analyst");
  const email = `student-${randomUUID()}@waterhub.demo`,
    password = process.env.SEED_PASSWORD!;
  const created = (
    await admin
      .post("/users")
      .send({
        name: "Presentation learner",
        email,
        password,
        roleId: role.id,
        reason: "Create isolated local presentation account",
      })
      .expect(201)
  ).body.data;
  assert.ok(!JSON.stringify(created).includes("password"));
  await admin
    .post("/users")
    .send({
      name: "Duplicate learner",
      email,
      password,
      roleId: role.id,
      reason: "Duplicate email should be rejected",
    })
    .expect(409);
  const student = request.agent(app);
  const studentLogin = await student
    .post("/auth/login")
    .send({ email, password })
    .expect(200);
  assert.equal(studentLogin.body.data.roleCode, "analyst");
  await student.get("/users").expect(403);
  const changed = (
    await admin
      .patch(`/users/${created.id}`)
      .send({
        name: created.name,
        roleId: role.id,
        active: false,
        updatedAt: created.updatedAt,
        reason: "Deactivate account and revoke local sessions",
      })
      .expect(200)
  ).body.data;
  await student.get("/auth/me").expect(401);
  await student.post("/auth/login").send({ email, password }).expect(401);
  await admin
    .patch(`/users/${created.id}`)
    .send({
      name: created.name,
      roleId: role.id,
      active: true,
      updatedAt: created.updatedAt,
      reason: "Reject an outdated edit of this account",
    })
    .expect(409);
  const me = await db.user.findUniqueOrThrow({
    where: { id: seedId("user:admin") },
  });
  await admin
    .patch(`/users/${me.id}`)
    .send({
      name: me.name,
      roleId: role.id,
      active: false,
      updatedAt: me.updatedAt.toISOString(),
      reason: "Prevent accidental administrator lockout",
    })
    .expect(409);
  const other = await db.organization.create({
      data: { name: "Isolated presentation district" },
    }),
    foreignRole = await db.role.create({
      data: {
        organizationId: other.id,
        code: "admin",
        name: "Foreign administrator",
      },
    });
  await admin
    .patch(`/users/${changed.id}`)
    .send({
      name: changed.name,
      roleId: foreignRole.id,
      active: true,
      updatedAt: changed.updatedAt,
      reason: "Foreign roles must not cross district boundaries",
    })
    .expect(422);
  const list = await admin.get("/users").expect(200);
  assert.ok(!JSON.stringify(list.body).includes("passwordHash"));
  const event = await db.auditEvent.findFirstOrThrow({
    where: { entityId: created.id, action: "USER_UPDATED" },
  });
  assert.equal(event.reason, "Deactivate account and revoke local sessions");
  assert.ok(!JSON.stringify(event).includes(password));
});

test("administrator-assisted recovery enforces verification, single use, expiry and session revocation", async () => {
  const role = await db.role.findFirstOrThrow({
    where: { organizationId, code: "analyst" },
  });
  const email = `recovery-${randomUUID()}@example.test`,
    oldPassword = `old-${randomUUID()}`,
    newPassword = `new-${randomUUID()}`;
  const created = await admin
    .post("/users")
    .send({
      name: "Recovery Test",
      email,
      password: oldPassword,
      roleId: role.id,
      reason: "Create isolated recovery test",
    })
    .expect(201);
  const target = created.body.data;
  const recipient = request.agent(app);
  await recipient
    .post("/auth/login")
    .send({ email, password: oldPassword })
    .expect(200);
  const issue = {
    administratorPassword: process.env.SEED_PASSWORD,
    verificationMethod: "Verified in person",
    reason: "Recover account after identity verification",
    verified: true,
  };
  await request(app)
    .post(`/users/${target.id}/recovery`)
    .send(issue)
    .expect(401);
  await analyst.post(`/users/${target.id}/recovery`).send(issue).expect(403);
  await admin
    .post(`/users/${target.id}/recovery`)
    .send({ ...issue, administratorPassword: `wrong-${randomUUID()}` })
    .expect(401);
  await admin
    .post(`/users/${target.id}/recovery`)
    .send({ ...issue, verified: false })
    .expect(422);
  const foreignOrganization = await db.organization.create({
    data: { name: "Other recovery tenant" },
  });
  const foreignRole = await db.role.create({
    data: {
      organizationId: foreignOrganization.id,
      code: "foreign",
      name: "Other role",
    },
  });
  const { hashPassword } = await import("../../src/shared/security.js");
  const foreignUser = await db.user.create({
    data: {
      organizationId: foreignOrganization.id,
      roleId: foreignRole.id,
      name: "Foreign account",
      email: `foreign-${randomUUID()}@example.test`,
      passwordHash: await hashPassword(oldPassword),
    },
  });
  await admin.post(`/users/${foreignUser.id}/recovery`).send(issue).expect(404);
  const response = await admin
    .post(`/users/${target.id}/recovery`)
    .send(issue)
    .expect(201);
  const code = response.body.data.code;
  assert.ok(code && response.headers["cache-control"]?.includes("no-store"));
  const stored = await db.passwordRecovery.findFirstOrThrow({
    where: { userId: target.id, usedAt: null },
  });
  assert.notEqual(stored.tokenHash, code);
  await request(app)
    .post("/auth/recover")
    .send({ code, password: newPassword })
    .expect(204);
  await recipient.get("/auth/me").expect(401);
  await request(app)
    .post("/auth/recover")
    .send({ code, password: newPassword })
    .expect(400);
  await request(app)
    .post("/auth/login")
    .send({ email, password: oldPassword })
    .expect(401);
  await request(app)
    .post("/auth/login")
    .send({ email, password: newPassword })
    .expect(200);
  const expiredCode = "expired-test-code-012345678901234567890123456789";
  const { tokenHash } = await import("../../src/shared/security.js");
  await db.passwordRecovery.create({
    data: {
      userId: target.id,
      tokenHash: tokenHash(expiredCode),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await request(app)
    .post("/auth/recover")
    .send({ code: expiredCode, password: newPassword })
    .expect(400);
  const second = await admin
    .post(`/users/${target.id}/recovery`)
    .send(issue)
    .expect(201);
  const simultaneous = await Promise.all(
    [0, 1].map(() =>
      request(app)
        .post("/auth/recover")
        .send({ code: second.body.data.code, password: newPassword }),
    ),
  );
  assert.deepEqual(simultaneous.map((r) => r.status).sort(), [204, 400]);
  const events = await db.auditEvent.findMany({
    where: {
      entityId: target.id,
      action: {
        in: ["PASSWORD_RECOVERY_ISSUED", "PASSWORD_RECOVERY_COMPLETED"],
      },
    },
  });
  assert.equal(events.length, 4);
  assert.ok(!JSON.stringify(events).includes(code));
});

test("security questions protect password changes and administrator resets", async () => {
  const isolatedApp = createApp(db, config),
    manager = request.agent(isolatedApp),
    reader = request.agent(isolatedApp),
    person = request.agent(isolatedApp);
  const seedPassword = process.env.SEED_PASSWORD!;
  await manager
    .post("/auth/login")
    .send({ email: "admin@waterhub.demo", password: seedPassword })
    .expect(200);
  await reader
    .post("/auth/login")
    .send({ email: "analyst@waterhub.demo", password: seedPassword })
    .expect(200);
  const role = await db.role.findFirstOrThrow({
    where: { organizationId, code: "analyst" },
  });
  const email = `question-${randomUUID()}@example.test`,
    original = `old-${randomUUID()}`,
    replacement = `new-${randomUUID()}`,
    answer = `answer-${randomUUID()}`,
    nextAnswer = `next-${randomUUID()}`;
  const created = await manager
    .post("/users")
    .send({
      name: "Question test",
      email,
      password: original,
      roleId: role.id,
      reason: "Create isolated question test",
    })
    .expect(201);
  const id = created.body.data.id;
  await person
    .post("/auth/login")
    .send({ email, password: original })
    .expect(200);
  await request(isolatedApp).get("/auth/security-question").expect(401);
  assert.equal(
    (await person.get("/auth/security-question").expect(200)).body.data,
    null,
  );
  const setup = {
    currentPassword: original,
    question: "What is your private test phrase?",
    answer,
  };
  await person.put("/auth/security-question").send(setup).expect(204);
  const stored = await db.securityQuestion.findUniqueOrThrow({
    where: { userId: id },
  });
  assert.notEqual(stored.answerHash, answer);
  const questionResponse = await person
    .get("/auth/security-question")
    .expect(200);
  assert.equal(questionResponse.body.data.question, setup.question);
  assert.ok(!JSON.stringify(questionResponse.body).includes(answer));
  await person
    .post("/auth/change-password")
    .send({
      currentPassword: original,
      newPassword: replacement,
      answer: `wrong-${randomUUID()}`,
    })
    .expect(401);
  await person
    .post("/auth/change-password")
    .send({
      currentPassword: `wrong-${randomUUID()}`,
      newPassword: replacement,
      answer,
    })
    .expect(401);
  await person
    .post("/auth/change-password")
    .send({ currentPassword: original, newPassword: replacement, answer })
    .expect(204);
  await person.get("/auth/me").expect(401);
  await person
    .post("/auth/login")
    .send({ email, password: original })
    .expect(401);
  await person
    .post("/auth/login")
    .send({ email, password: replacement })
    .expect(200);
  await person
    .put("/auth/security-question")
    .send({
      currentPassword: replacement,
      question: setup.question,
      answer: nextAnswer,
    })
    .expect(401);
  const reset = {
    administratorPassword: seedPassword,
    verificationMethod: "Verified in person",
    reason: "Reset verified account question",
    verified: true,
    question: "What is your new test phrase?",
    answer: nextAnswer,
  };
  await reader.put(`/users/${id}/security-question`).send(reset).expect(403);
  await manager
    .put(`/users/${id}/security-question`)
    .send({ ...reset, administratorPassword: `wrong-${randomUUID()}` })
    .expect(401);
  const foreign = await db.user.findFirstOrThrow({
    where: { organization: { name: "Other recovery tenant" } },
  });
  await manager
    .put(`/users/${foreign.id}/security-question`)
    .send(reset)
    .expect(404);
  const pending = await manager
    .post(`/users/${id}/recovery`)
    .send({
      administratorPassword: seedPassword,
      verificationMethod: "Verified in person",
      reason: "Test invalidation of recovery code",
      verified: true,
    })
    .expect(201);
  await manager.put(`/users/${id}/security-question`).send(reset).expect(204);
  await request(isolatedApp)
    .post("/auth/recover")
    .send({ code: pending.body.data.code, password: `new-${randomUUID()}` })
    .expect(400);
  await person.get("/auth/me").expect(401);
  await person
    .post("/auth/login")
    .send({ email, password: replacement })
    .expect(200);
  const nextPassword = `last-${randomUUID()}`;
  await person
    .post("/auth/change-password")
    .send({ currentPassword: replacement, newPassword: nextPassword, answer })
    .expect(401);
  await person
    .post("/auth/change-password")
    .send({
      currentPassword: replacement,
      newPassword: nextPassword,
      answer: nextAnswer,
    })
    .expect(204);
  const events = await db.auditEvent.findMany({
    where: {
      entityId: id,
      action: {
        in: [
          "SECURITY_QUESTION_UPDATED",
          "SECURITY_QUESTION_ADMIN_RESET",
          "PASSWORD_CHANGED",
        ],
      },
    },
  });
  assert.equal(events.length, 4);
  const json = JSON.stringify(events);
  assert.ok(
    !json.includes(answer) &&
      !json.includes(nextAnswer) &&
      !json.includes(original) &&
      !json.includes(replacement),
  );
});
