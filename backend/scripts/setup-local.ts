import { parse } from "dotenv";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir,readFile,writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd(),
  envPath = path.join(root, ".env");
await mkdir(path.join(root, ".local"), { recursive: true });
if (!existsSync(envPath)) {
  const dbPassword = randomBytes(24).toString("base64url"),
    password = randomBytes(18).toString("base64url");
  const env = (await readFile(path.join(root, ".env.example"), "utf8"))
    .replaceAll("local-development-only", dbPassword)
    .replace("SEED_PASSWORD=\n", `SEED_PASSWORD=${password}\n`);
  await writeFile(envPath, env, { flag: "wx" });
  console.info("Created local .env with generated passwords.");
} else console.info("Preserved existing .env.");
const env = parse(await readFile(envPath, "utf8"));
const localPath = path.join(root, ".local", "local.env");
if (
  env.DATABASE_URL &&
  ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(env.DATABASE_URL).hostname,
  ) &&
  !existsSync(localPath)
) {
  await writeFile(localPath, await readFile(envPath, "utf8"), { flag: "wx" });
}
if (env.SEED_PASSWORD) {
  await writeFile(
    path.join(root, ".local", "development-access.md"),
    `# John project — Water Hub demo sign-in\n\nApplication: http://localhost:3200\nLocal verification demo: http://localhost:3300\n\nPassword for the synthetic accounts below: ${env.SEED_PASSWORD}\n\n- admin@waterhub.demo — Administrator\n- operator@waterhub.demo — Integration operator\n- steward@waterhub.demo — Data steward\n- analyst@waterhub.demo — District analyst (read only)\n- billing@waterhub.demo — Billing analyst\n- plant@waterhub.demo — Plant operator\n- lab@waterhub.demo — Lab analyst\n- field@waterhub.demo — Field supervisor\n\nThese are synthetic demonstration identities, not email inboxes. This file and both environment files are ignored by Git. Never use these accounts in public production.\n`,
  );
  console.info(
    "Local account details saved to .local/development-access.md (ignored by Git).",
  );
}
