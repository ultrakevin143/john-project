import assert from "node:assert/strict";
import test from "node:test";
import { dateTime,pesos } from "../../../frontend/src/shared/lib/utils.js";
import { getConfig } from "../../src/config/env.js";
import { openapi } from "../../src/docs/openapi.js";
import { canTransition } from "../../src/modules/canonical/canonical.policy.js";
import { schemas } from "../../src/modules/canonical/canonical.schemas.js";
import { score } from "../../src/modules/quality/quality.engine.js";
import {
tariffScheduleSchema,
validDemoLocation,
} from "../../src/modules/reference/reference.schemas.js";
import { demonstrationTariffs } from "../../src/modules/reference/reference.data.js";
import { tariffAmount } from "../../src/modules/reference/tariff.service.js";
import {
defaultPeriod,
reportingPeriod,
} from "../../src/modules/reports/reports.service.js";
import { csv } from "../../src/shared/csv.js";
import { manilaDate } from "../../src/shared/dates.js";
import { stableHash } from "../../src/shared/hash.js";
import { hashPassword,verifyPassword } from "../../src/shared/security.js";

test("password hashes verify without storing plaintext", async () => {
  const hash = await hashPassword("local-synthetic-password");
  assert.equal(await verifyPassword("local-synthetic-password", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
  assert.ok(!hash.includes("local-synthetic-password"));
});
test("canonical hashes ignore object-key ordering", () => {
  assert.equal(
    stableHash({ b: 2, a: { d: 4, c: 3 } }),
    stableHash({ a: { c: 3, d: 4 }, b: 2 }),
  );
  assert.notEqual(stableHash([1, 2]), stableHash([2, 1]));
  assert.notEqual(
    stableHash(new Date("2026-01-01")),
    stableHash(new Date("2026-02-01")),
  );
});
test("CSV export escapes formula injection and quotations", () => {
  const text = csv([{ name: "=HYPERLINK()", detail: 'quoted "text"' }]);
  assert.ok(text.includes("'=HYPERLINK()"));
  assert.ok(text.includes('quoted ""text""'));
});
test("database configuration blocks remote and insecure runtime URLs", () => {
  assert.throws(() =>
    getConfig({ DATABASE_URL: "postgresql://a:b@example.invalid/db" }),
  );
  assert.throws(() =>
    getConfig({
      DATABASE_URL: "postgresql://a:b@example.invalid/db",
      ALLOW_REMOTE_DATABASE: "true",
    }),
  );
  assert.throws(() =>
    getConfig({
      DATABASE_URL: "postgresql://a:b@localhost/db",
      NODE_ENV: "production",
      WEB_ORIGIN: "http://localhost:3200",
    }),
  );
  assert.equal(
    getConfig({ DATABASE_URL: "postgresql://a:b@127.0.0.1/db" })
      .ALLOW_REMOTE_DATABASE,
    "false",
  );
});
test("numeric validation rejects nulls, booleans, arrays and blank input", () => {
  const fixture = {
    sourceRecordId: "production-test",
    sourceUpdatedAt: new Date().toISOString(),
    facilityId: "22222222-2222-4222-a222-222222222222",
    dmaId: "33333333-3333-4333-a333-333333333333",
    volumeM3: 20,
    flowLs: 3,
    pressureBar: 2,
    periodStart: "2026-09-01T00:00:00Z",
    periodEnd: "2026-10-01T00:00:00Z",
    occurredAt: "2026-09-30T23:59:00Z",
    isSystemInput: true,
  };
  for (const value of [null, true, false, [], "", " ", "NaN", "Infinity", -1])
    assert.equal(
      schemas.production.safeParse({ ...fixture, volumeM3: value }).success,
      false,
    );
  assert.equal(
    schemas.production.safeParse({ ...fixture, volumeM3: "20.5" }).success,
    true,
  );
});
test("timestamps require an offset and normalize to UTC", () => {
  const common = {
    sourceRecordId: "a",
    sourceUpdatedAt: "2026-10-01T08:00:00+08:00",
    code: "SP",
    name: "Synthetic point",
    dmaId: "33333333-3333-4333-a333-333333333333",
  };
  assert.equal(
    schemas["sampling-points"].parse(common).sourceUpdatedAt.toISOString(),
    "2026-10-01T00:00:00.000Z",
  );
  assert.equal(
    schemas["sampling-points"].safeParse({
      ...common,
      sourceUpdatedAt: "2026-10-01T08:00:00",
    }).success,
    false,
  );
});
test("work and complaint transitions prevent lifecycle shortcuts", () => {
  assert.equal(canTransition("work-orders", "OPEN", "COMPLETED"), false);
  assert.equal(canTransition("work-orders", "OPEN", "DISPATCHED"), true);
  assert.equal(canTransition("complaints", "CLOSED", "OPEN"), false);
  assert.equal(canTransition("complaints", "ASSIGNED", "RESOLVED"), true);
});
test("DQM score formula is transparent and empty runs never pass", () => {
  assert.equal(score(100, 3), 97);
  assert.equal(score(3, 1), 66.67);
  assert.equal(score(0, 0), 0);
});
test("report periods reject reverse and excessive windows", () => {
  assert.throws(() =>
    reportingPeriod({ from: "2026-10-01", to: "2026-09-01" }),
  );
  assert.throws(() =>
    reportingPeriod({ from: "2020-01-01", to: "2026-01-01" }),
  );
  assert.equal(
    defaultPeriod(new Date("2026-01-15T00:00:00Z")).from.toISOString(),
    "2025-11-30T16:00:00.000Z",
  );
});
test("Manila calendar boundaries survive UTC month and year rollover", () => {
  const period = defaultPeriod(new Date("2026-01-31T17:00:00Z"));
  assert.equal(period.from.toISOString(), "2025-12-31T16:00:00.000Z");
  assert.equal(period.to.toISOString(), "2026-01-31T16:00:00.000Z");
  assert.equal(
    reportingPeriod({
      from: "2026-01-01",
      to: "2026-02-01",
    }).from.toISOString(),
    "2025-12-31T16:00:00.000Z",
  );
  assert.equal(
    manilaDate("2026-10-27").toISOString(),
    "2026-10-26T16:00:00.000Z",
  );
  assert.match(dateTime("2026-10-26T16:00:00Z"), /27.*2026.*PHT/);
  assert.match(pesos(1234.5), /1,234\.50/);
});
test("progressive PHP water charges cover base, tier edges and fractions", () => {
  const tariff = demonstrationTariffs[0]!;
  for (const [volume, amount] of [
    [0, 180],
    [10, 180],
    [15, 280],
    [20, 380],
    [25, 505],
    [30, 630],
    [31, 660],
    [20.125, 383.13],
  ])
    assert.equal(tariffAmount(volume!, tariff), amount);
  assert.equal(tariffAmount(15, demonstrationTariffs[1]!), 560);
  assert.equal(
    tariffAmount(10.002, {
      baseVolumeM3: 10,
      baseCharge: 0,
      ratePerM3: 10,
      blocks: [
        { upToM3: 10.001, rate: 1 },
        { upToM3: null, rate: 10 },
      ],
    }),
    0.01,
  );
  assert.equal(
    tariffScheduleSchema.safeParse({ ...tariff, baseVolumeM3: 10.0001 })
      .success,
    false,
  );
  assert.throws(() => tariffAmount(-1, tariff));
  assert.equal(
    tariffScheduleSchema.safeParse({
      ...tariff,
      blocks: [{ upToM3: 9, rate: 20 }],
    }).success,
    false,
  );
  assert.equal(
    tariffScheduleSchema.safeParse({
      ...tariff,
      blocks: [
        { upToM3: null, rate: 20 },
        { upToM3: 30, rate: 25 },
      ],
    }).success,
    false,
  );
});
test("Cebu demo locations require the configured city and barangay pair", () => {
  assert.equal(validDemoLocation("Cebu City", "Lahug"), true);
  assert.equal(validDemoLocation("Mandaue City", "Lahug"), false);
  assert.equal(validDemoLocation("Cebu City", "Unlisted"), false);
});
test("OpenAPI describes all canonical entities and secure sessions", () => {
  const spec = openapi();
  assert.equal(spec.openapi, "3.1.0");
  assert.equal(spec.components.securitySchemes.session.name, "water_session");
  assert.ok(spec.paths["/operations/water-quality/{id}"]?.patch);
  assert.ok("meter-readings" in spec.components.schemas);
  assert.ok(spec.paths["/reports/nrw"]);
});
