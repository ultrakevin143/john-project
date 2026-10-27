import { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test,{ after,before } from "node:test";
import request from "supertest";
import { organizationId,seed,seedId } from "../../prisma/seed.js";
import { createApp } from "../../src/app.js";
import { getConfig,isLoopback } from "../../src/config/env.js";
import { tokenHash } from "../../src/shared/security.js";

const database = new URL(process.env.DATABASE_URL!);
assert.ok(
  isLoopback(database.hostname) &&
    /^\/water_hub_test(?:_[a-z0-9]+)?$/.test(database.pathname),
  "Security verification refuses remote/non-test databases.",
);
const db = new PrismaClient(),
  config = getConfig({ ...process.env, NODE_ENV: "test" }),
  app = createApp(db, config);
const roles = [
  "admin",
  "operator",
  "steward",
  "analyst",
  "billing",
  "plant",
  "lab",
  "field",
] as const;
type Role = (typeof roles)[number];
const agents = Object.fromEntries(
  roles.map((role) => [role, request.agent(app)]),
);
// Expected access is a written security contract, independent of seeded grants.
const allDomains = [
  "billing",
  "metering",
  "production",
  "quality",
  "field",
  "customer",
  "assets",
];
const domains: Record<Role, string[]> = {
  admin: allDomains,
  operator: allDomains,
  steward: allDomains,
  analyst: allDomains,
  billing: ["billing", "metering"],
  plant: ["production", "assets"],
  lab: ["quality"],
  field: ["field", "customer", "assets"],
};
const entities: Record<string, string> = {
  accounts: "billing",
  billing: "billing",
  "service-connections": "metering",
  meters: "metering",
  "meter-readings": "metering",
  facilities: "production",
  production: "production",
  pipelines: "assets",
  "sampling-points": "quality",
  "water-quality": "quality",
  "work-orders": "field",
  leaks: "field",
  complaints: "customer",
};
const core = ["admin", "operator", "steward", "analyst"];
const entityIds: Record<string, string> = {};
let foreign: {
  org: string;
  dma: string;
  source: string;
  lab: string;
  work: string;
  asset: string;
  run: string;
  error: string;
  rule: string;
  dqRun: string;
  result: string;
  label: string;
};
const cookies = new Map<Role, string[]>();
before(async () => {
  await seed(db, process.env.SEED_PASSWORD!);
  for (const role of roles) {
    const login = await agents[role]!.post("/auth/login")
      .send({
        email: `${role}@waterhub.demo`,
        password: process.env.SEED_PASSWORD,
      })
      .expect(200);
    const setCookie = login.headers["set-cookie"];
    assert.ok(setCookie);
    cookies.set(role, Array.isArray(setCookie) ? setCookie : [setCookie]);
    assert.equal("passwordHash" in login.body.data, false);
    assert.equal("sessionId" in login.body.data, false);
  }
  for (const entity of Object.keys(entities)) {
    const rows = await agents
      .admin!.get(`/operations/${entity}?pageSize=1`)
      .expect(200);
    entityIds[entity] = rows.body.data[0].id;
  }
  const org = randomUUID(),
    dma = randomUUID(),
    source = randomUUID(),
    label = `FOREIGN-SECRET-${randomUUID()}`,
    domainId = randomUUID(),
    parameterId = randomUUID(),
    pointId = randomUUID(),
    work = randomUUID(),
    lab = randomUUID(),
    asset = randomUUID(),
    run = randomUUID(),
    rawId = randomUUID(),
    error = randomUUID(),
    rule = randomUUID(),
    dqRun = randomUUID(),
    result = randomUUID();
  await db.organization.create({ data: { id: org, name: label } });
  await db.districtMeteredArea.create({
    data: {
      id: dma,
      organizationId: org,
      code: label,
      name: label,
      connections: 1,
      diagramX: 10,
      diagramY: 10,
    },
  });
  await db.dataDomain.create({
    data: {
      id: domainId,
      organizationId: org,
      code: "quality",
      name: label,
      description: label,
      owner: label,
      steward: label,
    },
  });
  await db.sourceSystem.create({
    data: {
      id: source,
      organizationId: org,
      code: label,
      name: label,
      entity: "water-quality",
      domain: "quality",
      method: "CSV",
    },
  });
  await db.waterQualityParameter.create({
    data: {
      id: parameterId,
      organizationId: org,
      code: label,
      name: label,
      unit: "mg/L",
      plausibleMin: 0,
      plausibleMax: 10,
      limitMin: 0.2,
      limitMax: 1,
      guidance: label,
    },
  });
  const canonical = {
    organizationId: org,
    sourceSystemId: source,
    sourceUpdatedAt: new Date(),
    sourceVersion: "security-fixture",
  };
  await db.samplingPoint.create({
    data: {
      ...canonical,
      id: pointId,
      sourceRecordId: "foreign-point",
      code: label,
      name: label,
      dmaId: dma,
    },
  });
  await db.workOrder.create({
    data: {
      ...canonical,
      id: work,
      sourceRecordId: "foreign-work",
      reference: label,
      title: label,
      dmaId: dma,
      category: "WATER_QUALITY",
      priority: "ERROR",
      status: "OPEN",
      assignee: label,
      reportedAt: new Date(),
    },
  });
  await db.waterQualityResult.create({
    data: {
      ...canonical,
      id: lab,
      sourceRecordId: "foreign-lab",
      sampleReference: label,
      samplingPointId: pointId,
      parameterId,
      value: 0.4,
      unit: "mg/L",
      sampledAt: new Date(),
      enteredBy: label,
    },
  });
  await db.dataAsset.create({
    data: {
      id: asset,
      organizationId: org,
      domainId,
      sourceSystemId: source,
      name: label,
      entity: "water-quality",
      owner: label,
      steward: label,
      classification: "INTERNAL",
      retentionDays: 30,
      policy: label,
    },
  });
  await db.integrationRun.create({
    data: {
      id: run,
      organizationId: org,
      sourceSystemId: source,
      idempotencyKey: label,
      payloadHash: label,
      entity: "water-quality",
      method: "csv",
      status: "FAILED",
      initiatedBy: label,
    },
  });
  await db.rawImportRecord.create({
    data: {
      id: rawId,
      organizationId: org,
      runId: run,
      rowNumber: 1,
      sourceRecordId: label,
      payload: { secret: label },
      payloadHash: label,
      status: "QUARANTINED",
    },
  });
  await db.integrationRecordError.create({
    data: {
      id: error,
      organizationId: org,
      runId: run,
      rawRecordId: rawId,
      code: "FOREIGN",
      message: label,
    },
  });
  await db.dQRule.create({
    data: {
      id: rule,
      organizationId: org,
      code: label,
      name: label,
      domain: "quality",
      entity: "water-quality",
      severity: "ERROR",
      description: label,
      checkId: "lab-range",
      config: {},
    },
  });
  await db.dQRun.create({
    data: {
      id: dqRun,
      organizationId: org,
      status: "SUCCEEDED",
      score: 100,
      initiatedBy: label,
    },
  });
  await db.dQResult.create({
    data: {
      id: result,
      organizationId: org,
      runId: dqRun,
      ruleId: rule,
      severity: "ERROR",
      checked: 1,
      failed: 0,
      passed: true,
      samples: [],
    },
  });
  await db.auditEvent.create({
    data: {
      organizationId: org,
      actorName: label,
      action: "FOREIGN_EVENT",
      entity: "security-fixture",
      requestId: label,
      metadata: { secret: label },
    },
  });
  foreign = {
    org,
    dma,
    source,
    lab,
    work,
    asset,
    run,
    error,
    rule,
    dqRun,
    result,
    label,
  };
});
after(async () => {
  await db.$disconnect();
});
test("eight real demo logins enforce operational list/detail domain permissions", async (t) => {
  for (const role of roles)
    await t.test(role, async () => {
      const me = await agents[role]!.get("/auth/me").expect(200);
      assert.ok(String(cookies.get(role)).includes("HttpOnly"));
      assert.ok(String(cookies.get(role)).includes("SameSite=Strict"));
      assert.equal(me.body.data.email, `${role}@waterhub.demo`);
      for (const [entity, domain] of Object.entries(entities)) {
        const expected = domains[role].includes(domain) ? 200 : 403;
        await agents[role]!.get(`/operations/${entity}`).expect(expected);
        await agents[role]!.get(
          `/operations/${entity}/${entityIds[entity]}`,
        ).expect(expected);
      }
    });
});
test("eight roles enforce independent governance, quality, audit and export gates", async (t) => {
  for (const role of roles)
    await t.test(role, async () => {
      for (const route of [
        "/integrations/sources",
        "/integrations/runs",
        "/integrations/errors",
        "/dq/rules",
        "/dq/runs",
        "/dq/scorecards",
        "/governance/domains",
        "/governance/assets",
      ])
        await agents[role]!.get(route).expect(core.includes(role) ? 200 : 403);
      await agents[role]!.get("/audit-events").expect(
        ["admin", "steward"].includes(role) ? 200 : 403,
      );
      for (const format of ["json", "csv"]) {
        await agents[role]!.get(`/reports/nrw?format=${format}`).expect(
          [...core, "billing"].includes(role) ? 200 : 403,
        );
        await agents[role]!.get(
          `/reports/water-quality?format=${format}`,
        ).expect([...core, "lab"].includes(role) ? 200 : 403);
      }
    });
});
test("forged role headers and body fields cannot unlock write operations", async (t) => {
  const fakeId = randomUUID();
  const routes: {
    method: "post" | "patch";
    path: string;
    allowed: string[];
    body: object;
  }[] = [
    {
      method: "post",
      path: "/integrations/imports",
      allowed: ["admin", "operator", "steward"],
      body: {},
    },
    {
      method: "post",
      path: "/integrations/runs/not-a-uuid/retry",
      allowed: ["admin", "operator", "steward"],
      body: {},
    },
    {
      method: "post",
      path: "/dq/runs",
      allowed: ["admin", "steward"],
      body: { unexpected: true },
    },
    {
      method: "patch",
      path: `/dq/results/${fakeId}`,
      allowed: ["admin", "steward"],
      body: {},
    },
    {
      method: "patch",
      path: `/governance/assets/${fakeId}`,
      allowed: ["admin", "steward"],
      body: {},
    },
    {
      method: "patch",
      path: `/operations/water-quality/${fakeId}`,
      allowed: ["admin", "steward", "lab"],
      body: {},
    },
    {
      method: "patch",
      path: `/operations/work-orders/${fakeId}/status`,
      allowed: ["admin", "field"],
      body: {},
    },
    {
      method: "post",
      path: "/operations/meters/not-a-uuid/archive",
      allowed: ["admin"],
      body: {},
    },
  ];
  for (const role of roles)
    await t.test(role, async () => {
      for (const route of routes)
        await agents[role]![route.method](route.path)
          .set("X-Role", "Administrator")
          .set("X-User-ID", seedId("user:admin"))
          .set("X-Permissions", "*")
          .send(route.body)
          .expect(route.allowed.includes(role) ? 422 : 403);
    });
});
test("overview never bypasses domain permissions or water-balance report access, including warmed caches", async (t) => {
  await agents.admin!.get("/overview").expect(200);
  for (const role of roles)
    await t.test(role, async () => {
      const d = (await agents[role]!.get("/overview").expect(200)).body.data;
      const canQuality = domains[role].includes("quality"),
        canField = domains[role].includes("field"),
        canBalance = [...core, "billing"].includes(role);
      assert.equal(
        d.quality !== null,
        canQuality,
        "Lab summary must match the reader's domain",
      );
      assert.equal(
        d.activeLeaks !== null,
        canField,
        "Leak summary must match field-domain access",
      );
      assert.equal(
        d.nrw !== null,
        canBalance,
        "A hidden report link must not expose its data through overview",
      );
      assert.equal(
        d.dq !== null,
        core.includes(role),
        "Quality-run metadata requires dq:read",
      );
      assert.ok(
        d.attention.every((a: { kind: string }) =>
          a.kind === "Quality breach" ? canQuality : canField,
        ),
        "Record-level attention must respect domain permissions",
      );
      if (!canField) assert.deepEqual(d.workOrders, []);
      if (!canBalance)
        for (const dma of d.dmas)
          for (const field of [
            "inputM3",
            "billedM3",
            "lossM3",
            "nrwPct",
            "billingRecords",
            "inputRecords",
          ])
            assert.equal(
              field in dma,
              false,
              "DMA diagram must not smuggle restricted balance values",
            );
      if (!core.includes(role)) assert.deepEqual(d.sources, []);
    });
  const admin = (await agents.admin!.get("/overview").expect(200)).body.data;
  assert.ok(
    admin.nrw && admin.quality && admin.attention.length,
    "Restricted cache entries must not replace administrator data",
  );
});
test("masked customer names and full account numbers cannot be inferred through search", async () => {
  const account = await db.customerAccount.findFirstOrThrow({
    where: { organizationId },
  });
  await agents
    .analyst!.get("/operations/accounts")
    .query({ search: account.customerName })
    .expect(422);
  await agents
    .billing!.get("/operations/accounts")
    .query({ search: account.accountNumber })
    .expect(422);
  const visible = await agents
    .billing!.get("/operations/accounts")
    .query({ search: account.accountNumber.slice(-4) })
    .expect(200);
  assert.ok(visible.body.data.length);
  assert.ok(
    visible.body.data.every(
      (r: { customerName: string; accountNumber: string }) =>
        r.customerName === "Synthetic customer ••••" &&
        r.accountNumber.startsWith("••••"),
    ),
  );
});
test("foreign record IDs and forged tenant headers cannot read another district", async () => {
  for (const route of [
    `/operations/water-quality/${foreign.lab}`,
    `/operations/work-orders/${foreign.work}`,
    `/integrations/runs/${foreign.run}`,
    `/reports/nrw?dmaId=${foreign.dma}`,
  ])
    await agents
      .admin!.get(route)
      .set("X-Organization-ID", foreign.org)
      .expect(404);
  for (const route of [
    "/operations/water-quality",
    "/operations/lookups",
    "/integrations/sources",
    "/integrations/runs",
    "/integrations/errors",
    "/governance/domains",
    "/governance/assets",
    "/dq/rules",
    "/dq/runs",
    "/audit-events",
    "/overview",
  ]) {
    const response = await agents
      .admin!.get(route)
      .query({ organizationId: foreign.org, pageSize: 100 })
      .set("X-Tenant-ID", foreign.org)
      .expect(200);
    assert.equal(
      JSON.stringify(response.body).includes(foreign.label),
      false,
      route,
    );
  }
  const result = await agents
    .admin!.get(`/dq/scorecards?runId=${foreign.dqRun}`)
    .expect(200);
  assert.equal(result.body.data, null);
});
test("foreign object IDs cannot be used for governance, DQM, lab, status or retry mutations", async () => {
  await agents
    .steward!.patch(`/governance/assets/${foreign.asset}`)
    .send({
      owner: "Security owner",
      steward: "Security steward",
      classification: "INTERNAL",
      retentionDays: 30,
      policy: "Security test policy",
      reason: "Cross-tenant test attempt",
      version: 1,
    })
    .expect(404);
  await agents
    .steward!.patch(`/dq/results/${foreign.result}`)
    .send({ remediation: "ACKNOWLEDGED", note: "Cross-tenant test attempt" })
    .expect(404);
  await agents
    .steward!.patch(`/dq/rules/${foreign.rule}`)
    .send({ active: false, reason: "Cross-tenant test attempt" })
    .expect(404);
  await agents
    .lab!.patch(`/operations/water-quality/${foreign.lab}`)
    .send({
      value: 0.5,
      unit: "mg/L",
      correctiveActionId: null,
      version: 1,
      reason: "Cross-tenant test attempt",
    })
    .expect(404);
  await agents
    .field!.patch(`/operations/work-orders/${foreign.work}/status`)
    .send({
      status: "DISPATCHED",
      dispatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reason: "Cross-tenant test attempt",
    })
    .expect(404);
  await agents
    .operator!.post(`/integrations/runs/${foreign.run}/retry`)
    .send({})
    .expect(404);
  await agents
    .operator!.post("/integrations/imports")
    .send({
      sourceSystemId: foreign.source,
      idempotencyKey: randomUUID(),
      format: "mock",
    })
    .expect(404);
  assert.equal(
    (
      await db.waterQualityResult.findUniqueOrThrow({
        where: { id: foreign.lab },
      })
    ).value,
    0.4,
  );
  assert.equal(
    (await db.workOrder.findUniqueOrThrow({ where: { id: foreign.work } }))
      .status,
    "OPEN",
  );
});
test("anonymous callers, invented cookies and forged identities cannot authenticate", async () => {
  for (const token of [
    "fake-admin-token",
    `j:${JSON.stringify({ role: "Administrator", id: seedId("user:admin") })}`,
    "eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYWRtaW4ifQ.",
    "x".repeat(101),
  ])
    await request(app)
      .get("/auth/me")
      .set("Cookie", `water_session=${encodeURIComponent(token)}`)
      .set("X-User-ID", seedId("user:admin"))
      .expect(401);
  for (const route of [
    "/overview",
    "/operations/accounts",
    "/integrations/runs",
    "/dq/scorecards",
    "/governance/assets",
    "/audit-events",
    "/reports/nrw?format=csv",
  ])
    await request(app).get(route).expect(401);
  await request(app)
    .post("/auth/login")
    .send({
      email: "plant@waterhub.demo",
      password: process.env.SEED_PASSWORD,
      role: "Administrator",
    })
    .expect(422);
});
test("expired sessions, deactivated accounts and revoked grants take effect immediately", async () => {
  const user = await db.user.findUniqueOrThrow({
    where: { email: "plant@waterhub.demo" },
  });
  const expired = "local-security-expired-token";
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: tokenHash(expired),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await request(app)
    .get("/auth/me")
    .set("Cookie", `water_session=${expired}`)
    .expect(401);
  await db.user.update({ where: { id: user.id }, data: { active: false } });
  try {
    await agents.plant!.get("/auth/me").expect(401);
  } finally {
    await db.user.update({ where: { id: user.id }, data: { active: true } });
  }
  const grant = await db.permission.findUniqueOrThrow({
    where: { roleId_code: { roleId: user.roleId, code: "domain:production" } },
  });
  await db.permission.delete({ where: { id: grant.id } });
  try {
    await agents.plant!.get("/operations/production").expect(403);
  } finally {
    await db.permission.create({ data: grant });
  }
});
test("login rotation, refresh and logout invalidate older cookies", async () => {
  const fresh = request.agent(app),
    first = await fresh
      .post("/auth/login")
      .send({
        email: "analyst@waterhub.demo",
        password: process.env.SEED_PASSWORD,
      })
      .expect(200),
    old = first.headers["set-cookie"]!;
  await fresh
    .post("/auth/login")
    .send({
      email: "analyst@waterhub.demo",
      password: process.env.SEED_PASSWORD,
    })
    .expect(200);
  await request(app)
    .get("/auth/me")
    .set("Cookie", Array.isArray(old) ? old : [old])
    .expect(401);
  const rotated = await fresh.post("/auth/refresh").send({}).expect(200),
    latest = rotated.headers["set-cookie"]!;
  assert.ok(String(latest).includes("HttpOnly"));
  assert.ok(String(latest).includes("SameSite=Strict"));
  await fresh.post("/auth/logout").send({}).expect(204);
  await request(app)
    .get("/auth/me")
    .set("Cookie", Array.isArray(latest) ? latest : [latest])
    .expect(401);
});
test("login throttling cannot be evaded with invented client identity headers", async () => {
  const guarded = createApp(db, config);
  for (let i = 0; i < 20; i++)
    await request(guarded)
      .post("/auth/login")
      .set("X-User-ID", randomUUID())
      .set("X-Real-IP", `192.0.2.${i + 1}`)
      .send({
        email: "nobody@waterhub.demo",
        password: "deliberately-wrong-password",
      })
      .expect(401);
  await request(guarded)
    .post("/auth/login")
    .set("X-Real-IP", "198.51.100.1")
    .send({ email: "admin@waterhub.demo", password: process.env.SEED_PASSWORD })
    .expect(429);
});
test("query and cross-site request tricks do not bypass the backend", async () => {
  await agents
    .plant!.get("/operations/accounts")
    .set("X-HTTP-Method-Override", "GET")
    .query({ role: "admin", organizationId })
    .expect(403);
  await agents
    .analyst!.post("/dq/runs")
    .set("X-HTTP-Method-Override", "GET")
    .send({})
    .expect(403);
  await agents
    .admin!.post("/dq/runs")
    .set("Origin", "https://hostile.invalid")
    .send({})
    .expect(403);
  await agents
    .admin!.post("/dq/runs")
    .set("Sec-Fetch-Site", "cross-site")
    .send({})
    .expect(403);
  await agents
    .admin!.get("/operations/meters")
    .query({ dmaId: "' OR 1=1 --" })
    .expect(422);
  const search = await agents
    .admin!.get("/operations/meters")
    .query({ search: "' OR 1=1 --" })
    .expect(200);
  assert.equal(search.body.pagination.total, 0);
  const inert = await agents
    .admin!.get("/governance/assets")
    .query({ classification: { $ne: "RESTRICTED" } })
    .expect(200);
  assert.equal(
    JSON.stringify(inert.body).includes(foreign.label),
    false,
    "Unsupported nested filter syntax cannot change organization scope",
  );
  await agents
    .admin!.get("/governance/assets")
    .query({ classification: "NOT_A_CLASSIFICATION" })
    .expect(422);
});
test("Cebu reference setup enforces domains and does not reveal another district", async () => {
  await request(app).get("/reference").expect(401);
  for (const role of roles) {
    const reference = await agents[role]!.get("/reference")
      .query({ organizationId: foreign.org })
      .expect(200);
    assert.equal(JSON.stringify(reference.body).includes(foreign.label), false);
    assert.equal(
      reference.body.data.tariffs.length > 0,
      domains[role].includes("billing"),
    );
    assert.equal(
      reference.body.data.parameters.length > 0,
      domains[role].includes("quality"),
    );
  }
});
test("tariff writes reject forged grants, cross-district references and cross-site requests", async () => {
  const body = {
    supersedesId: randomUUID(),
    code: "SEC-TEST",
    name: "Synthetic security tariff",
    effectiveFrom: "2027-01-01",
    baseVolumeM3: 10,
    baseCharge: 100,
    ratePerM3: 20,
    blocks: [{ upToM3: null, rate: 20 }],
    reason: "Synthetic local security verification",
  };
  for (const role of [
    "operator",
    "analyst",
    "billing",
    "plant",
    "lab",
    "field",
  ] as const)
    await agents[role]!.post("/reference/tariffs")
      .set("X-Role", "admin")
      .send(body)
      .expect(403);
  await agents.admin!.post("/reference/tariffs").send(body).expect(404);
  await agents
    .admin!.post("/reference/tariffs")
    .set("Origin", "https://hostile.invalid")
    .send(body)
    .expect(403);
});
