import { parse } from "dotenv";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isLoopback } from "../../backend/src/config/env.js";
import { csv } from "../../backend/src/shared/csv.js";
import { type Audit } from "../../frontend/src/features/audit/types.js";
import { type Asset } from "../../frontend/src/features/governance/types.js";
import {
  type Run,
  type Source,
} from "../../frontend/src/features/integrations/types.js";
import { type Lookups } from "../../frontend/src/features/operations/types.js";
import { type Overview } from "../../frontend/src/features/overview/types.js";
import { type QualityRun } from "../../frontend/src/features/quality/types.js";
import { type Nrw } from "../../frontend/src/features/water-balance/types.js";
import {
  type Envelope,
  type Page,
  type User,
} from "../../frontend/src/shared/api/contracts.js";
import { type Row } from "../../frontend/src/shared/types.js";

// Intentionally fixed to the separate local demo; never loads runtime .env.
const api = "http://127.0.0.1:4300",
  web = "http://localhost:3300",
  env = parse(await readFile(".local/local.env", "utf8"));
for (const name of ["DATABASE_URL", "DIRECT_URL"])
  if (!env[name] || !isLoopback(new URL(env[name]!).hostname))
    throw new Error("Demo verification requires both local database URLs.");
const id = randomUUID().slice(0, 8),
  cookies = new Map<string, string>(),
  checkpoints: {
    name: string;
    evidence: unknown;
  }[] = [],
  timings: number[] = [];
async function call<T = unknown>(
  role: string,
  path: string,
  method = "GET",
  body?: unknown,
  status = 200,
): Promise<T> {
  const start = performance.now(),
    response = await fetch(`${api}${path}`, {
      method,
      signal: AbortSignal.timeout(30000),
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(cookies.has(role) ? { Cookie: cookies.get(role)! } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  timings.push(performance.now() - start);
  assert.equal(
    response.status,
    status,
    `${method} ${path}: expected ${status}, received ${response.status}`,
  );
  const cookie = response.headers.get("set-cookie");
  if (cookie) cookies.set(role, cookie.split(";")[0]!);
  if (status === 204) return undefined as T;
  const type = response.headers.get("content-type") ?? "";
  return (
    type.includes("json") ? await response.json() : await response.text()
  ) as T;
}
function record(name: string, evidence: unknown) {
  checkpoints.push({ name, evidence });
  console.info(`${checkpoints.length}. ${name}`);
}
try {
  const health = await call<{
    databaseScope: string;
  }>("", "/health");
  assert.equal(health.databaseScope, "local");
  record("Local API safety gate", { databaseScope: health.databaseScope });
  for (const role of [
    "admin",
    "operator",
    "analyst",
    "plant",
    "lab",
    "field",
    "billing",
    "steward",
  ]) {
    const result = await call<Envelope<User>>(role, "/auth/login", "POST", {
      email: `${role}@waterhub.demo`,
      password: env.SEED_PASSWORD,
    });
    assert.ok(result.data.permissions.length);
  }
  record("Eight role-based accounts sign in", { roles: 8 });
  const overview = (await call<Envelope<Overview>>("admin", "/overview")).data;
  assert.ok(overview.quality);
  assert.equal(overview.synthetic, true);
  assert.equal(overview.dmas.length, 4);
  record("API-backed overview and four DMAs", {
    breaches: overview.quality.breached,
    activeLeaks: overview.activeLeaks,
    sources: overview.sources.length,
  });
  const reference = (
    await call<
      Envelope<{
        profile: {
          timezone: string;
        };
        areas: {
          city: string;
        }[];
        tariffs: {
          currency: string;
        }[];
        parameters: {
          standardCode: string;
        }[];
      }>
    >("admin", "/reference")
  ).data;
  assert.equal(reference.profile.timezone, "Asia/Manila");
  assert.ok(reference.areas.every((a) => a.city === "Cebu City"));
  assert.ok(reference.tariffs.every((t) => t.currency === "PHP"));
  assert.ok(reference.parameters.every((p) => p.standardCode.includes("2017")));
  record("Cebu reference setup includes Manila time, PHP and sourced limits", {
    areas: reference.areas.length,
    parameters: reference.parameters.length,
    tariffs: reference.tariffs.length,
  });
  const source = (
      await call<Envelope<Source[]>>("operator", "/integrations/sources")
    ).data.find((s: { code: string }) => s.code === "FIELD"),
    now = new Date().toISOString(),
    dmaId = overview.dmas[0]!.id;
  const good = {
      sourceRecordId: `demo-${id}-good`,
      sourceUpdatedAt: now,
      reference: `DEMO-${id}-1`,
      title: "Synthetic field demonstration",
      dmaId,
      category: "LEAK_REPAIR",
      priority: "WARNING",
      status: "OPEN",
      assignee: "Demonstration crew",
      reportedAt: now,
    },
    bad = {
      ...good,
      sourceRecordId: `demo-${id}-bad`,
      reference: `DEMO-${id}-2`,
      category: "UNKNOWN",
    };
  const input = {
    sourceSystemId: source!.id,
    entity: "work-orders",
    format: "csv",
    idempotencyKey: `walkthrough-${id}`,
    csv: csv([good, bad]),
  };
  const run = (
    await call<Envelope<Run>>(
      "operator",
      "/integrations/imports",
      "POST",
      input,
      201,
    )
  ).data;
  assert.equal(run.processed, 1);
  assert.equal(run.failed, 1);
  record("CSV load quarantines an invalid row", {
    loaded: run.processed,
    quarantined: run.failed,
  });
  const replay = (
    await call<Envelope<Run>>(
      "operator",
      "/integrations/imports",
      "POST",
      input,
      201,
    )
  ).data;
  assert.equal(replay.id, run.id);
  assert.equal(replay.replayed, true);
  record("Identical replay is idempotent", { sameRun: true });
  const detail = (
      await call<Envelope<Run>>("operator", `/integrations/runs/${run.id}`)
    ).data,
    retried = (
      await call<Envelope<Run>>(
        "operator",
        `/integrations/runs/${run.id}/retry`,
        "POST",
        {
          corrections: [
            {
              errorId: detail.errors![0]!.id,
              payload: { ...bad, category: "LEAK_REPAIR" },
            },
          ],
        },
      )
    ).data;
  assert.equal(retried.processed, 2);
  assert.equal(retried.failed, 0);
  record("Selected failed row corrected and retried", {
    loaded: retried.processed,
    failed: retried.failed,
  });
  const allLookups = (
    await call<Envelope<Lookups>>("admin", "/operations/lookups")
  ).data;
  const labSource = overview.sources.find((s) => s.code === "LAB")!;
  const chlorine = allLookups.parameters.find((p) => p.unit === "mg/L")!;
  const labGood = {
    sourceRecordId: `cebu-lab-${id}-good`,
    sourceUpdatedAt: now,
    sampleReference: `CEBU-LAB-${id}-1`,
    samplingPointId: allLookups.points[0]!.id,
    parameterId: chlorine.id,
    value: 0.12,
    unit: chlorine.unit,
    sampledAt: now,
    enteredBy: "Synthetic Cebu laboratory analyst",
  };
  const labBad = {
    ...labGood,
    sourceRecordId: `cebu-lab-${id}-bad`,
    sampleReference: `CEBU-LAB-${id}-2`,
    value: 0.45,
    unit: "unrecognized-unit",
  };
  const labRun = (
    await call<Envelope<Run>>(
      "operator",
      "/integrations/imports",
      "POST",
      {
        sourceSystemId: labSource.id,
        entity: "water-quality",
        format: "csv",
        idempotencyKey: `cebu-lab-${id}`,
        csv: csv([labGood, labBad]),
      },
      201,
    )
  ).data;
  assert.equal(labRun.processed, 1);
  assert.equal(labRun.failed, 1);
  record("Cebu lab CSV quarantines an invalid measurement unit", {
    loaded: labRun.processed,
    quarantined: labRun.failed,
  });
  const labDetail = (
    await call<Envelope<Run>>("operator", `/integrations/runs/${labRun.id}`)
  ).data;
  const labRetry = (
    await call<Envelope<Run>>(
      "operator",
      `/integrations/runs/${labRun.id}/retry`,
      "POST",
      {
        corrections: [
          {
            errorId: labDetail.errors![0]!.id,
            payload: { ...labBad, unit: chlorine.unit },
          },
        ],
      },
    )
  ).data;
  assert.equal(labRetry.processed, 2);
  assert.equal(labRetry.failed, 0);
  record("Selected laboratory row corrected without replaying the good row", {
    loaded: labRetry.processed,
    failed: labRetry.failed,
  });
  const qualityRun = (
      await call<Envelope<QualityRun>>("steward", "/dq/runs", "POST", {}, 201)
    ).data,
    quality = (
      await call<Envelope<QualityRun>>(
        "steward",
        `/dq/scorecards?runId=${qualityRun.id}`,
      )
    ).data;
  assert.equal(quality.results.length, 21);
  assert.equal(
    quality.score,
    Math.round((1 - quality.failed / quality.checked) * 10000) / 100,
  );
  record("Twenty-one persisted DQM results with recomputed score", {
    rules: quality.results.length,
    checked: quality.checked,
    failed: quality.failed,
    score: quality.score,
  });
  const finding = quality.results.find((r: { failed: number }) => r.failed > 0);
  assert.ok(finding);
  await call("steward", `/dq/results/${finding.id}`, "PATCH", {
    remediation: "ACKNOWLEDGED",
    note: `Demonstration investigation ${id}`,
  });
  const afterAck = (
    await call<Envelope<QualityRun>>(
      "steward",
      `/dq/scorecards?runId=${qualityRun.id}`,
    )
  ).data;
  assert.equal(afterAck.score, quality.score);
  record("Remediation acknowledgement preserves the measured score", {
    score: afterAck.score,
  });
  const nrw = (
    await call<Envelope<Nrw>>("billing", `/reports/nrw?dmaId=${dmaId}`)
  ).data;
  assert.equal(
    nrw.lineage!.production.reduce((n, r) => n + Number(r.volumeM3), 0),
    nrw.inputM3,
  );
  assert.equal(
    nrw.lineage!.billing.reduce((n, r) => n + Number(r.billedM3), 0),
    nrw.billedM3,
  );
  assert.ok(nrw.lineage!.production.every((r) => r.isSystemInput));
  record("DMA NRW reconciles to boundary and billing records", {
    dma: nrw.dmas[0]!.name,
    inputM3: nrw.inputM3,
    billedM3: nrw.billedM3,
    nrwPct: nrw.nrwPct,
  });
  const labRows = (await call<Page<Row>>("lab", "/operations/water-quality"))
      .data,
    labRow = labRows.find(
      (r) => r.sampleReference === labGood.sampleReference,
    )!,
    lookups = (await call<Envelope<Lookups>>("lab", "/operations/lookups"))
      .data,
    param = lookups.parameters.find(
      (p: { id: string }) => p.id === labRow.parameterId,
    ),
    correction = {
      value: (param!.limitMin + param!.limitMax) / 2,
      unit: param!.unit,
      correctiveActionId: null,
      version: Number(labRow.correctionVersion),
      reason: `Synthetic verified correction ${id}`,
    };
  const corrected = (
    await call<Envelope<Row>>(
      "lab",
      `/operations/water-quality/${labRow.id}`,
      "PATCH",
      correction,
    )
  ).data;
  assert.equal(
    corrected.correctionVersion,
    Number(labRow.correctionVersion) + 1,
  );
  await call(
    "lab",
    `/operations/water-quality/${labRow.id}`,
    "PATCH",
    correction,
    409,
  );
  record("Laboratory correction is audited and rejects stale versions", {
    version: corrected.correctionVersion,
    staleWrite: 409,
  });
  await call("plant", "/operations/billing", "GET", undefined, 403);
  await call("plant", "/operations/accounts", "GET", undefined, 403);
  await call("analyst", "/integrations/imports", "POST", {}, 403);
  await call("analyst", "/dq/runs", "POST", {}, 403);
  record("Domain and write permissions are enforced", {
    plantBilling: 403,
    plantIdentity: 403,
    analystImport: 403,
    analystDqmWrite: 403,
  });
  const accounts = (await call<Page<Row>>("admin", "/operations/accounts"))
    .data;
  assert.equal(accounts[0]!.customerName, "Synthetic customer ••••");
  assert.ok(String(accounts[0]!.accountNumber).startsWith("••••"));
  record("Restricted customer identities are masked", { masking: true });
  const asset = (await call<Page<Asset>>("steward", "/governance/assets"))
      .data[0]!,
    policy = {
      owner: asset.owner,
      steward: asset.steward,
      classification: asset.classification,
      retentionDays: asset.retentionDays,
      policy: asset.policy,
      version: asset.version,
      reason: `Demonstration policy review ${id}`,
    };
  await call("steward", `/governance/assets/${asset.id}`, "PATCH", policy);
  await call("steward", `/governance/assets/${asset.id}`, "PATCH", policy, 409);
  record("Governance edit rejects a stale policy version", { staleWrite: 409 });
  // Each run owns its repair scenario; previous walkthroughs may have completed
  // the seeded work orders and resolved their leaks.
  const workRows = (
    await call<Page<Row>>(
      "field",
      `/operations/work-orders?q=${encodeURIComponent(good.reference)}`,
    )
  ).data;
  const work = workRows.find(
    (row) => row.sourceRecordId === good.sourceRecordId,
  );
  assert.ok(work, "The walkthrough's new work order must exist.");
  assert.equal(work.status, "OPEN");
  const pipelines = (
    await call<Page<Row>>(
      "field",
      `/operations/pipelines?dmaId=${dmaId}&pageSize=1`,
    )
  ).data;
  assert.ok(pipelines[0], "The demo DMA must have a pipeline.");
  const leakReference = `DEMO-LEAK-${id}`;
  const leakImport = (
    await call<Envelope<Run>>(
      "operator",
      "/integrations/imports",
      "POST",
      {
        sourceSystemId: source!.id,
        entity: "leaks",
        format: "json",
        idempotencyKey: `walkthrough-leak-${id}`,
        records: [
          {
            sourceRecordId: `demo-${id}-leak`,
            sourceUpdatedAt: now,
            reference: leakReference,
            dmaId,
            pipelineId: pipelines[0]!.id,
            workOrderId: work.id,
            location: "Synthetic demonstration pipeline",
            estimatedLossM3Day: 1,
            reportedAt: now,
          },
        ],
      },
      201,
    )
  ).data;
  assert.equal(leakImport.processed, 1);
  assert.equal(leakImport.failed, 0);
  const leak = (
    await call<Page<Row>>(
      "field",
      `/operations/leaks?q=${encodeURIComponent(leakReference)}`,
    )
  ).data.find((row) => row.reference === leakReference);
  assert.ok(leak, "The walkthrough's new leak must exist.");
  const beforeRepair = (await call<Envelope<Overview>>("admin", "/overview"))
    .data;
  await call(
    "field",
    `/operations/work-orders/${work.id}/status`,
    "PATCH",
    {
      status: "COMPLETED",
      updatedAt: work.updatedAt,
      reason: `Invalid shortcut demonstration ${id}`,
    },
    422,
  );
  await call("field", `/operations/work-orders/${work.id}/status`, "PATCH", {
    status: "DISPATCHED",
    dispatchedAt: new Date().toISOString(),
    updatedAt: work.updatedAt,
    reason: `Demonstration dispatch ${id}`,
  });
  record("Field response permits legal lifecycle transitions", {
    shortcut: 422,
    dispatch: 200,
  });
  let currentWork = (
    await call<Envelope<Row>>("field", `/operations/work-orders/${work.id}`)
  ).data;
  for (const status of ["IN_PROGRESS", "COMPLETED"]) {
    currentWork = (
      await call<Envelope<Row>>(
        "field",
        `/operations/work-orders/${work.id}/status`,
        "PATCH",
        {
          status,
          updatedAt: currentWork.updatedAt,
          ...(status === "COMPLETED"
            ? { completedAt: new Date().toISOString() }
            : {}),
          reason: `Synthetic Cebu repair ${status.toLowerCase()} ${id}`,
        },
      )
    ).data;
  }
  const repairedLeak = (
    await call<Envelope<Row>>("field", `/operations/leaks/${leak.id}`)
  ).data;
  assert.ok(repairedLeak.resolvedAt);
  const afterRepair = (await call<Envelope<Overview>>("admin", "/overview"))
    .data;
  assert.equal(afterRepair.activeLeaks, beforeRepair.activeLeaks! - 1);
  record(
    "Completed leak repair resolves its linked report and overview count",
    {
      workStatus: currentWork.status,
      resolvedAt: repairedLeak.resolvedAt,
      activeLeaks: afterRepair.activeLeaks,
    },
  );
  const exportCsv = await call<string>("billing", "/reports/nrw?format=csv");
  assert.ok(exportCsv.includes("inputM3"));
  await mkdir(".local/demo-evidence", { recursive: true });
  await writeFile(".local/demo-evidence/nrw.csv", exportCsv);
  record("Operational CSV export succeeds", {
    file: ".local/demo-evidence/nrw.csv",
  });
  const audits = (
      await call<Page<Audit>>("admin", "/audit-events?pageSize=100")
    ).data,
    actions = new Set(audits.map((a: { action: string }) => a.action));
  for (const action of [
    "AUTH_LOGIN",
    "IMPORT_STARTED",
    "IMPORT_COMPLETED",
    "IMPORT_RETRIED",
    "DQ_COMPLETED",
    "DQ_REMEDIATED",
    "LAB_RESULT_CORRECTED",
    "GOVERNANCE_ASSET_CHANGED",
    "STATUS_CHANGED",
    "LEAK_RESOLVED",
    "REPORT_EXPORTED",
  ])
    assert.ok(actions.has(action), action);
  record("Required administrative actions have audit events", {
    actions: actions.size,
  });
  const response = await fetch(web, { signal: AbortSignal.timeout(60000) });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  record("Next.js HTTP smoke and security headers", {
    status: response.status,
    note: "HTTP only; browser interactions are verified separately where available.",
  });
  for (const role of cookies.keys()) {
    await call(role, "/auth/logout", "POST", {}, 204);
    await call(role, "/auth/me", "GET", undefined, 401);
    cookies.delete(role);
  }
  record("All walkthrough sessions are revoked", { roles: 8 });
  const result = {
    id,
    completedAt: new Date().toISOString(),
    api,
    web,
    databaseScope: "local",
    checkpoints,
    requests: timings.length,
    meanMs: Math.round(timings.reduce((n, v) => n + v, 0) / timings.length),
    maxMs: Math.round(Math.max(...timings)),
    neonRequests: 0,
  };
  await writeFile(
    ".local/demo-evidence/results.json",
    JSON.stringify(result, null, 2),
  );
  console.info(
    `Completed ${checkpoints.length} checkpoints using local services only. Evidence: .local/demo-evidence/results.json`,
  );
} finally {
  // Revoke walkthrough sessions even if an assertion or request fails.
  for (const role of cookies.keys()) {
    try {
      await call(role, "/auth/logout", "POST", {}, 204);
      cookies.delete(role);
    } catch {
      console.error(`Could not revoke the local ${role} walkthrough session.`);
      process.exitCode = 1;
    }
  }
}
