import { Prisma } from "@prisma/client";

export type Definition = {
  code: string;
  name: string;
  domain: string;
  entity: string;
  severity: "ERROR" | "WARNING" | "INFO";
  description: string;
  checkId: string;
  config: Prisma.InputJsonObject;
};
export const ruleDefinitions: Definition[] = [
  {
    code: "WQ-001",
    name: "Required operational fields",
    domain: "cross-domain",
    entity: "multi",
    severity: "ERROR",
    description:
      "Accounts, meters, connections and samples have complete canonical fields.",
    checkId: "completeness",
    config: {},
  },
  {
    code: "WQ-002",
    name: "Timestamps and billing boundaries",
    domain: "cross-domain",
    entity: "multi",
    severity: "ERROR",
    description:
      "UTC instants are valid; reporting windows are ordered and actual events are not future-dated.",
    checkId: "timestamps",
    config: { futureMinutes: 5 },
  },
  {
    code: "WQ-003",
    name: "Non-negative water quantities",
    domain: "cross-domain",
    entity: "multi",
    severity: "ERROR",
    description:
      "Volumes, flows, consumption and monetary amounts are finite and non-negative.",
    checkId: "quantities",
    config: {},
  },
  {
    code: "WQ-004",
    name: "Governed reference values",
    domain: "cross-domain",
    entity: "multi",
    severity: "ERROR",
    description:
      "Tariffs, DMAs, sample points and parameters belong to this district.",
    checkId: "references",
    config: {},
  },
  {
    code: "WQ-005",
    name: "Duplicate source rows",
    domain: "integration",
    entity: "raw",
    severity: "WARNING",
    description:
      "A source ID occurs once in each import run; quarantined duplicate rows remain visible until corrected.",
    checkId: "source-duplicates",
    config: {},
  },
  {
    code: "WQ-006",
    name: "Meter and account identifiers",
    domain: "metering",
    entity: "multi",
    severity: "ERROR",
    description: "Normalized serial and account numbers do not conflict.",
    checkId: "identifiers",
    config: {},
  },
  {
    code: "WQ-007",
    name: "Meter-to-connection lineage",
    domain: "metering",
    entity: "meter-readings",
    severity: "ERROR",
    description: "Readings reference a known meter and its service connection.",
    checkId: "lineage",
    config: {},
  },
  {
    code: "WQ-008",
    name: "Register sequence consistency",
    domain: "metering",
    entity: "meter-readings",
    severity: "ERROR",
    description:
      "Register values and adjacent readings do not decrease without a documented replacement.",
    checkId: "sequence",
    config: {},
  },
  {
    code: "WQ-009",
    name: "Billing-to-consumption agreement",
    domain: "billing",
    entity: "billing",
    severity: "ERROR",
    description:
      "Billed volume agrees with the linked register difference and reporting window.",
    checkId: "billing",
    config: { toleranceM3: 0.01 },
  },
  {
    code: "WQ-010",
    name: "Estimated reading threshold",
    domain: "metering",
    entity: "meter-readings",
    severity: "WARNING",
    description:
      "Estimated readings stay within the configured ratio for each billing cycle.",
    checkId: "estimated",
    config: { maxRatio: 0.2 },
  },
  {
    code: "WQ-011",
    name: "Lab ranges and measurement units",
    domain: "quality",
    entity: "water-quality",
    severity: "ERROR",
    description:
      "Measurements use the parameter unit and physically plausible range.",
    checkId: "lab-range",
    config: {},
  },
  {
    code: "WQ-012",
    name: "Breach corrective-action trace",
    domain: "quality",
    entity: "water-quality",
    severity: "ERROR",
    description:
      "Every valid result outside its sourced reference limits links to a water-quality corrective work order in the same DMA.",
    checkId: "lab-action",
    config: {},
  },
  {
    code: "WQ-013",
    name: "Work-order lifecycle",
    domain: "field",
    entity: "work-orders",
    severity: "ERROR",
    description:
      "Status transitions, dispatch and completion dates follow the governed lifecycle.",
    checkId: "work-status",
    config: {},
  },
  {
    code: "WQ-014",
    name: "Complaint lifecycle",
    domain: "customer",
    entity: "complaints",
    severity: "ERROR",
    description:
      "Resolved complaints have a valid resolution date and legal status transition.",
    checkId: "complaint-status",
    config: {},
  },
  {
    code: "WQ-015",
    name: "Source and station freshness",
    domain: "production",
    entity: "multi",
    severity: "WARNING",
    description:
      "Sources and each active facility have a successful observation within the source interval.",
    checkId: "freshness",
    config: {},
  },
  {
    code: "WQ-016",
    name: "Consumption, flow and pressure outliers",
    domain: "production",
    entity: "multi",
    severity: "WARNING",
    description:
      "Thresholds are configurable; elevated values remain loaded for investigation.",
    checkId: "outliers",
    config: {
      maxConsumptionM3: 150,
      maxFlowLs: 200,
      maxPressureBar: 8,
      minPressureBar: 1.5,
    },
  },
  {
    code: "WQ-017",
    name: "Restricted-data policy completeness",
    domain: "governance",
    entity: "assets",
    severity: "ERROR",
    description:
      "Assets have owners, retention and classifications; customer and billing assets must be restricted.",
    checkId: "classification",
    config: {},
  },
  {
    code: "PH-018",
    name: "Cebu city and barangay agreement",
    domain: "billing",
    entity: "accounts",
    severity: "ERROR",
    description:
      "Customer city and barangay match the configured Cebu demo location list and each linked service area's location. This list covers only the four selected demo barangays.",
    checkId: "cebu-location",
    config: {},
  },
  {
    code: "PH-019",
    name: "Effective tariff and peso amount",
    domain: "billing",
    entity: "billing",
    severity: "ERROR",
    description:
      "The bill's tariff version matches its account class and meter size, covers the whole billing period and agrees with the configured PHP water-charge brackets. Historical bills retain their original version. Other charges are outside this prototype.",
    checkId: "tariff-amount",
    config: { tolerancePhp: 0.01 },
  },
  {
    code: "PH-020",
    name: "Sampling reminder coverage",
    domain: "quality",
    entity: "sampling-points",
    severity: "WARNING",
    description:
      "Each active sampling point has a valid observation for each configured parameter within its demo operational reminder interval. These intervals do not represent statutory PNSDW sampling frequencies.",
    checkId: "sampling-interval",
    config: {},
  },
  {
    code: "PH-021",
    name: "Water-quality reference provenance",
    domain: "quality",
    entity: "multi",
    severity: "ERROR",
    description:
      "Each parameter records a standard version, source URL, applicable method and valid ordered limits. Source metadata supports review; this check does not certify regulatory compliance.",
    checkId: "standards-provenance",
    config: {},
  },
];
