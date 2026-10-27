import { PrismaClient } from "@prisma/client";
import { config,parse } from "dotenv";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import { configureCebu,seed } from "../prisma/seed.js";
import { isLoopback } from "../src/config/env.js";
import { emptyWaterRecords } from "./empty-water-records.js";

const remote = process.argv.includes("--authorized-neon-empty");
const local = parse(await readFile(".local/local.env", "utf8"));
let databaseUrl: string;
if (remote) {
  if (
    process.env.CONFIRM_WATER_HUB_EMPTY !== "empty-operations-preserve-accounts"
  )
    throw new Error("Explicit maintenance scope is required.");
  config({ quiet: true });
  databaseUrl = process.env.DATABASE_URL!;
  for (const value of [databaseUrl, process.env.DIRECT_URL].filter(
    Boolean,
  ) as string[]) {
    const url = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      ![
        "ep-steep-sky-b579hmer-pooler.c-7.us-east-2.aws.neon.tech",
        "ep-steep-sky-b579hmer.c-7.us-east-2.aws.neon.tech",
      ].includes(url.hostname) ||
      url.pathname !== "/neondb" ||
      url.searchParams.get("schema") !== "water_hub" ||
      url.searchParams.get("sslmode") !== "require"
    )
      throw new Error(
        "Only the separately authorized Water Hub Neon schema is allowed.",
      );
  }
  databaseUrl = process.env.DIRECT_URL ?? databaseUrl;
} else {
  databaseUrl = local.DATABASE_URL!;
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    const url = new URL(local[key]!);
    if (!isLoopback(url.hostname) || url.pathname !== "/water_hub")
      throw new Error(
        "Local refresh requires the preserved local water_hub database.",
      );
  }
}
if (process.argv.includes("--check-only")) {
  console.info(
    "Target identity validated from private configuration; no database request made.",
  );
  process.exit(0);
}
const db = new PrismaClient({ datasourceUrl: databaseUrl });
const scope = remote ? "neon" : "local",
  stamp = new Date().toISOString().replaceAll(":", "-");
await mkdir(".local/cebu-maintenance", { recursive: true });
try {
  const result = await emptyWaterRecords(
    db,
    remote ? "water_hub" : "public",
    async (data) => {
      await writeFile(
        `.local/cebu-maintenance/${scope}-${stamp}-backup.json`,
        JSON.stringify({
          version: 1,
          scope,
          createdAt: new Date().toISOString(),
          data,
        }),
        { flag: "wx", mode: 0o600 },
      );
    },
    configureCebu,
  );
  if (!remote) await seed(db, local.SEED_PASSWORD!);
  await writeFile(
    `.local/cebu-maintenance/${scope}-result.json`,
    JSON.stringify(
      {
        ...result,
        completedAt: new Date().toISOString(),
        localDemoReseeded: !remote,
        automatedNeonTests: 0,
      },
      null,
      2,
    ),
  );
  console.info(
    `${scope === "neon" ? "Neon" : "Local"} Water Hub cleanup complete: ${result.after.length} operational tables empty at commit; ${result.usersPreserved} accounts preserved; all historical guards enabled.${remote ? " No remote demo seed was run." : " Cebu synthetic demo then seeded locally."}`,
  );
} catch (error) {
  // Do not print connection details or SQL arguments from driver errors.
  console.error(
    error instanceof Error &&
      !/Prisma|postgres|password|connection/i.test(error.name + error.message)
      ? error.message
      : "Maintenance failed; inspect the private local evidence. The transaction was rolled back.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
