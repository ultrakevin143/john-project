import { mkdir,writeFile } from "node:fs/promises";
import { seedId } from "../prisma/seed.js";
import { csv } from "../src/shared/csv.js";

// Generates local demo files only; no environment loading or database connection.
const now = new Date().toISOString(),
  batch = Date.now().toString(36);
const base = {
  sourceRecordId: `manual-cebu-${batch}-1`,
  sourceUpdatedAt: now,
  sampleReference: `CEBU-MANUAL-${batch}-1`,
  samplingPointId: seedId("point:0"),
  parameterId: seedId("parameter:CL"),
  value: 0.29,
  unit: "mg/L",
  sampledAt: now,
  enteredBy: "Synthetic Cebu laboratory analyst",
};
await mkdir(".local/demo-samples", { recursive: true });
await writeFile(
  ".local/demo-samples/cebu-laboratory.csv",
  csv([
    base,
    {
      ...base,
      sourceRecordId: `manual-cebu-${batch}-2`,
      sampleReference: `CEBU-MANUAL-${batch}-2`,
      value: 0.45,
      unit: "wrong-unit",
    },
  ]),
);
await writeFile(
  ".local/demo-samples/START-HERE.txt",
  [
    "CEBU WATER HUB - LOCAL DEMONSTRATION",
    "",
    "Use http://localhost:3300. These files reference synthetic records in the populated local demo.",
    "Do not upload them to the intentionally empty Neon workspace at port 3200.",
    "",
    "1. Sign in as operator@waterhub.demo with your existing private demo password.",
    "2. Integrations > Load a source snapshot > Water-quality laboratory > water quality > CSV batch.",
    "3. Choose cebu-laboratory.csv and import. One valid row loads; the wrong-unit row is quarantined.",
    "4. Open the failed row, select Correct, change Unit to mg/L and retry that row only.",
    "5. Sign in as steward@waterhub.demo. Run Data quality and inspect the corrective-action finding.",
    "6. The 0.29 mg/L result is deliberately below the 0.3 mg/L reference; its precision stays visible.",
    "7. As lab@waterhub.demo, correct the sample or link the same-DMA quality work order with a reason.",
    "8. As field@waterhub.demo, dispatch/start/complete WO-201. Its linked LK-301 resolves automatically.",
    "9. As admin@waterhub.demo, inspect audit history. As billing@waterhub.demo, export NRW.",
    "",
    "Regenerate fresh sample timestamps with npm run demo:samples. All data, rates and supply zones are illustrative.",
    "No password is included in this file. Existing login details remain in .local/development-access.md.",
  ].join("\r\n"),
);
console.info(
  "Local demo files written to .local/demo-samples: START-HERE.txt and cebu-laboratory.csv. No database requests.",
);
