import { PrismaClient } from "@prisma/client";
import { config,parse } from "dotenv";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { getConfig,isLoopback } from "../src/config/env.js";

config({ quiet: true });
const settings = getConfig();
if (process.env.CONFIRM_INITIAL_COPY !== "water-hub-initial-copy")
  throw new Error(
    "Initial provisioning needs explicit water-hub-initial-copy confirmation.",
  );
const targetUrl = new URL(settings.DIRECT_URL ?? settings.DATABASE_URL);
if (
  isLoopback(targetUrl.hostname) ||
  targetUrl.searchParams.get("schema") !== "water_hub" ||
  settings.DEMO_MODE !== "true"
)
  throw new Error(
    "Initial provisioning only supports the authorized remote water_hub demonstration schema.",
  );
const local = parse(await readFile(".local/local.env", "utf8")),
  localUrl = new URL(local.DATABASE_URL!);
if (!isLoopback(localUrl.hostname) || localUrl.pathname !== "/water_hub")
  throw new Error("Source must be the independent local water_hub workspace.");
const source = new PrismaClient({ datasourceUrl: localUrl.toString() }),
  target = new PrismaClient({ datasourceUrl: targetUrl.toString() });
const tables = [
  "Organization",
  "Role",
  "Permission",
  "User",
  "DataDomain",
  "SourceSystem",
  "IntegrationConnection",
  "DistrictMeteredArea",
  "Tariff",
  "WaterQualityParameter",
  "CustomerAccount",
  "ServiceConnection",
  "Meter",
  "MeterReading",
  "BillingRecord",
  "Facility",
  "ProductionReading",
  "PipelineAsset",
  "SamplingPoint",
  "WorkOrder",
  "WaterQualityResult",
  "LeakReport",
  "CustomerComplaint",
  "DataAsset",
  "IntegrationRun",
  "RawImportRecord",
  "IntegrationRecordError",
  "DQRule",
  "DQRun",
  "DQResult",
  "AuditEvent",
] as const;
try {
  // One metadata inspection. No rows or credentials are printed.
  const existing = await target.$queryRaw<
    {
      table_name: string;
    }[]
  >`SELECT table_name FROM information_schema.tables WHERE table_schema='water_hub' AND table_type='BASE TABLE'`;
  if (existing.length)
    throw new Error(
      "Dedicated target schema is not empty. Provisioning refused; existing data preserved.",
    );
  console.info(
    "Dedicated Neon application schema is empty; applying two pending migrations once.",
  );
  const require = createRequire(import.meta.url);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
      { env: process.env, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Migration deployment did not complete.")),
    );
  });
  const data = await source.$transaction(
    async (tx) =>
      Promise.all(
        tables.map(async (table) => ({
          table,
          rows: await tx.$queryRawUnsafe<Record<string, unknown>[]>(
            `SELECT * FROM "public"."${table}"`,
          ),
        })),
      ),
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
  await target.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(74126002)`;
      const union = tables
        .map(
          (table) =>
            `SELECT '${table}' AS name, count(*)::int AS count FROM "water_hub"."${table}"`,
        )
        .join(" UNION ALL ");
      const counts = await tx.$queryRawUnsafe<
        {
          name: string;
          count: number;
        }[]
      >(union);
      if (counts.some((t) => t.count > 0))
        throw new Error(
          "Target now contains application data. Copy refused without overwriting it.",
        );
      for (const { table, rows } of data)
        if (rows.length)
          await tx.$executeRawUnsafe(
            `INSERT INTO "water_hub"."${table}" SELECT * FROM json_populate_recordset(NULL::"water_hub"."${table}", $1::json)`,
            JSON.stringify(rows),
          );
      const org = data.find((t) => t.table === "Organization")?.rows[0];
      if (org)
        await tx.auditEvent.create({
          data: {
            organizationId: String(org.id),
            actorName: "Workspace provisioning",
            action: "WORKSPACE_INITIALIZED",
            entity: "organization",
            entityId: String(org.id),
            requestId: randomUUID(),
            reason: "User-authorized initial synthetic Water Hub provisioning",
            metadata: {
              source: "verified local synthetic workspace",
              sessionsCopied: false,
              tables: tables.length,
            },
          },
        });
    },
    { timeout: 120000, maxWait: 15000 },
  );
  const evidence = {
    completedAt: new Date().toISOString(),
    schema: "water_hub",
    migrations: 2,
    tables: tables.length,
    rows: data.reduce((n, t) => n + t.rows.length, 0),
    sessionsCopied: false,
    automatedTestsAgainstNeon: 0,
  };
  await mkdir(".local", { recursive: true });
  await writeFile(
    ".local/neon-provisioning.json",
    JSON.stringify(evidence, null, 2),
  );
  console.info(
    `Neon initial provisioning complete: ${evidence.rows} synthetic rows, ${tables.length} tables; sessions excluded.`,
  );
} finally {
  await Promise.all([source.$disconnect(), target.$disconnect()]);
}
