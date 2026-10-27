import { ApiError } from "../../shared/errors.js";
import { canTransition } from "../canonical/canonical.policy.js";
import { entityNames, type Entity } from "../canonical/canonical.schemas.js";
import { type Canonical } from "../canonical/canonical.types.js";
import { validDemoLocation } from "../reference/reference.schemas.js";
import { tariffAmount } from "../reference/tariff.service.js";
import { type Item, type Snapshot } from "./quality.repository.js";

export const num = (v: unknown) => Number(v);
export const time = (v: unknown) =>
  v instanceof Date ? v.getTime() : new Date(String(v)).getTime();
export type Observation = {
  id: string;
  failed: boolean;
  reason: string;
};
export function evaluate(
  checkId: string,
  s: Snapshot,
  config: Record<string, unknown> = {},
  now = new Date(),
): Observation[] {
  const e = s.entities,
    all = entityNames.flatMap((k) => e[k]),
    obs: Observation[] = [];
  const add = (r: Item, failed: boolean, reason: string) =>
    obs.push({ id: r.id, failed, reason });
  const has = (rows: Item[], id: unknown) => rows.some((r) => r.id === id);
  const duplicate = (rows: Item[], key: (r: Item) => string) => {
    const seen = new Set<string>();
    for (const r of rows) {
      const value = key(r);
      add(r, seen.has(value), "Duplicate normalized identifier or source row.");
      seen.add(value);
    }
  };
  switch (checkId) {
    case "completeness": {
      const fields: Partial<Record<Entity, string[]>> = {
        accounts: ["accountNumber", "customerName", "address", "tariffId"],
        meters: ["serialNumber", "connectionId"],
        "service-connections": ["code", "accountId", "dmaId"],
        "water-quality": [
          "sampleReference",
          "samplingPointId",
          "parameterId",
          "unit",
          "enteredBy",
        ],
      };
      for (const [entity, keys] of Object.entries(fields))
        for (const r of e[entity as Entity])
          add(
            r,
            keys.some((k) => typeof r[k] !== "string" || !String(r[k]).trim()),
            "A required field is missing or blank.",
          );
      break;
    }
    case "timestamps":
      for (const r of all) {
        const fields = Object.entries(r).filter(
          ([k, v]) =>
            v !== null &&
            v !== undefined &&
            (k.endsWith("At") || k === "periodStart" || k === "periodEnd"),
        );
        const bad =
          fields.some(([, v]) => !Number.isFinite(time(v))) ||
          fields.some(
            ([k, v]) =>
              !["createdAt", "updatedAt", "periodEnd"].includes(k) &&
              time(v) > now.getTime() + num(config.futureMinutes ?? 5) * 60000,
          ) ||
          !!(
            r.periodStart &&
            r.periodEnd &&
            time(r.periodStart) >= time(r.periodEnd)
          );
        add(
          r,
          bad,
          "Invalid/future event timestamp or reversed billing period.",
        );
      }
      break;
    case "quantities":
      for (const r of all) {
        const values = Object.entries(r).filter(([k]) =>
          [
            "previousM3",
            "currentM3",
            "consumptionM3",
            "billedM3",
            "volumeM3",
            "flowLs",
            "pressureBar",
            "amount",
            "ratePerM3",
            "estimatedLossM3Day",
            "capacityM3Day",
          ].includes(k),
        );
        if (values.length)
          add(
            r,
            values.some(([, v]) => !Number.isFinite(num(v)) || num(v) < 0),
            "Quantity is negative or not finite.",
          );
      }
      break;
    case "references":
      for (const r of all) {
        let bad = false;
        for (const [field, rows] of [
          ["dmaId", s.dmas],
          ["tariffId", s.tariffs],
          ["samplingPointId", e["sampling-points"]],
          ["parameterId", s.parameters],
        ] as [string, Item[]][])
          if (r[field] && !has(rows, r[field])) bad = true;
        add(r, bad, "Unknown DMA, tariff, sampling point or parameter.");
      }
      break;
    case "source-duplicates":
      duplicate(
        s.raw.filter((r) => r.sourceRecordId),
        (r) => `${r.runId}:${String(r.sourceRecordId).trim()}`,
      );
      break;
    case "identifiers":
      duplicate(e.accounts, (r) =>
        String(r.accountNumber).trim().toUpperCase(),
      );
      duplicate(e.meters, (r) => String(r.serialNumber).trim().toUpperCase());
      break;
    case "lineage":
      for (const r of e["meter-readings"]) {
        const meter = e.meters.find((m) => m.id === r.meterId);
        add(
          r,
          !meter ||
            !has(e["service-connections"], r.connectionId) ||
            meter.connectionId !== r.connectionId,
          "Meter and service connection lineage is broken.",
        );
      }
      break;
    case "sequence": {
      const sorted = [...e["meter-readings"]].sort(
          (a, b) => time(a.occurredAt) - time(b.occurredAt),
        ),
        previous = new Map<string, Canonical>();
      for (const r of sorted) {
        const meter = e.meters.find((m) => m.id === r.meterId),
          before = previous.get(String(r.meterId));
        const reset =
          r.replacementRecorded === true &&
          !!meter?.replacedAt &&
          time(meter.replacedAt) <= time(r.occurredAt);
        add(
          r,
          (!reset &&
            (num(r.currentM3) < num(r.previousM3) ||
              (!!before && num(r.previousM3) < num(before.currentM3)))) ||
            (r.replacementRecorded === true && !reset),
          "Register sequence decreases without a recorded replacement.",
        );
        previous.set(String(r.meterId), r);
      }
      break;
    }
    case "billing":
      for (const r of e.billing) {
        const reading = e["meter-readings"].find(
            (m) => m.id === r.meterReadingId,
          ),
          connection = e["service-connections"].find(
            (c) => c.id === r.connectionId,
          );
        const consumption = reading
          ? reading.replacementRecorded &&
            num(reading.currentM3) < num(reading.previousM3)
            ? num(reading.currentM3)
            : num(reading.currentM3) - num(reading.previousM3)
          : NaN;
        add(
          r,
          !reading ||
            !connection ||
            connection.accountId !== r.accountId ||
            connection.dmaId !== r.dmaId ||
            reading.connectionId !== r.connectionId ||
            Math.abs(num(r.billedM3) - consumption) >
              num(config.toleranceM3 ?? 0.01) ||
            time(r.periodStart) !== time(reading.periodStart) ||
            time(r.periodEnd) !== time(reading.periodEnd),
          "Billing volume, period or connection disagrees with the linked reading.",
        );
      }
      break;
    case "estimated": {
      const groups = new Map<string, Canonical[]>();
      for (const r of e["meter-readings"]) {
        const key = `${time(r.periodStart)}:${time(r.periodEnd)}`;
        groups.set(key, [...(groups.get(key) ?? []), r]);
      }
      for (const [period, rows] of groups) {
        const ratio =
          rows.filter((r) => r.readType === "ESTIMATED").length / rows.length;
        add(
          { id: period },
          ratio > num(config.maxRatio ?? 0.2),
          `${Math.round(ratio * 100)}% estimated reads exceed cycle threshold.`,
        );
      }
      break;
    }
    case "lab-range":
      for (const r of e["water-quality"]) {
        const p = s.parameters.find((p) => p.id === r.parameterId);
        add(
          r,
          !p ||
            r.unit !== p.unit ||
            !Number.isFinite(num(r.value)) ||
            num(r.value) < num(p.plausibleMin) ||
            num(r.value) > num(p.plausibleMax) ||
            (p.code === "COLI" && !Number.isInteger(num(r.value))),
          "Measurement range or parameter unit is invalid.",
        );
      }
      break;
    case "lab-action":
      for (const r of e["water-quality"]) {
        const p = s.parameters.find((p) => p.id === r.parameterId),
          breach =
            !!p &&
            r.unit === p.unit &&
            num(r.value) >= num(p.plausibleMin) &&
            num(r.value) <= num(p.plausibleMax) &&
            (p.code !== "COLI" || Number.isInteger(num(r.value))) &&
            (num(r.value) < num(p.limitMin) || num(r.value) > num(p.limitMax)),
          work = e["work-orders"].find((w) => w.id === r.correctiveActionId);
        const point = e["sampling-points"].find(
          (p) => p.id === r.samplingPointId,
        );
        add(
          r,
          breach &&
            (!work ||
              work.category !== "WATER_QUALITY" ||
              work.dmaId !== point?.dmaId),
          "Limit breach has no linked water-quality corrective work order.",
        );
      }
      break;
    case "work-status":
      for (const r of e["work-orders"])
        add(
          r,
          (!!r.previousStatus &&
            !canTransition(
              "work-orders",
              String(r.previousStatus),
              String(r.status),
            )) ||
            (["COMPLETED", "CLOSED"].includes(String(r.status)) &&
              !r.completedAt) ||
            (!!r.completedAt &&
              time(r.completedAt) < time(r.dispatchedAt ?? r.reportedAt)) ||
            (!!r.dispatchedAt && time(r.dispatchedAt) < time(r.reportedAt)),
          "Work-order transition or completion/dispatch date is invalid.",
        );
      break;
    case "complaint-status":
      for (const r of e.complaints)
        add(
          r,
          (!!r.previousStatus &&
            !canTransition(
              "complaints",
              String(r.previousStatus),
              String(r.status),
            )) ||
            (["RESOLVED", "CLOSED"].includes(String(r.status)) &&
              !r.resolvedAt) ||
            (!!r.resolvedAt && time(r.resolvedAt) < time(r.reportedAt)),
          "Complaint transition or resolution date is invalid.",
        );
      break;
    case "freshness":
      for (const source of s.sources) {
        add(
          source,
          !source.lastSuccessAt ||
            now.getTime() - time(source.lastSuccessAt) >
              num(source.freshnessHours) * 3600000,
          "Source last success is outside its expected interval.",
        );
        if (source.entity === "production")
          for (const facility of e.facilities) {
            const readings = e.production.filter(
              (r) => r.facilityId === facility.id,
            );
            const latest = Math.max(...readings.map((r) => time(r.occurredAt)));
            add(
              facility,
              !Number.isFinite(latest) ||
                now.getTime() - latest > num(source.freshnessHours) * 3600000,
              "Facility has no recent production observation.",
            );
          }
      }
      break;
    case "outliers":
      for (const r of e["meter-readings"])
        add(
          r,
          num(r.consumptionM3) > num(config.maxConsumptionM3 ?? 150),
          "Consumption exceeds the configured threshold.",
        );
      for (const r of e.production)
        add(
          r,
          num(r.flowLs) > num(config.maxFlowLs ?? 200) ||
            num(r.pressureBar) > num(config.maxPressureBar ?? 8) ||
            num(r.pressureBar) < num(config.minPressureBar ?? 1.5),
          "Flow or pressure is outside the configured operational band.",
        );
      break;
    case "classification":
      for (const r of s.assets)
        add(
          r,
          !String(r.owner ?? "").trim() ||
            !String(r.steward ?? "").trim() ||
            num(r.retentionDays) <= 0 ||
            !String(r.policy ?? "").trim() ||
            ((r.containsPii ||
              ["accounts", "billing", "complaints"].includes(
                String(r.entity),
              )) &&
              r.classification !== "RESTRICTED"),
          "Owner, retention or restricted-data classification is incomplete.",
        );
      break;
    case "cebu-location":
      for (const account of e.accounts) {
        const connections = e["service-connections"].filter(
          (c) => c.accountId === account.id,
        );
        add(
          account,
          !validDemoLocation(account.city, account.barangay) ||
            connections.some((c) => {
              const dma = s.dmas.find((d) => d.id === c.dmaId);
              return (
                !dma ||
                dma.city !== account.city ||
                dma.barangay !== account.barangay
              );
            }),
          "City or barangay is missing, outside the configured demo list, or disagrees with the linked supply area.",
        );
      }
      break;
    case "tariff-amount":
      for (const bill of e.billing) {
        const tariff = s.tariffs.find((t) => t.id === bill.tariffId),
          account = e.accounts.find((a) => a.id === bill.accountId);
        const accountTariff = s.tariffs.find((t) => t.id === account?.tariffId);
        let amount = NaN;
        try {
          if (tariff)
            amount = tariffAmount(num(bill.billedM3), {
              baseVolumeM3: num(tariff.baseVolumeM3),
              baseCharge: num(tariff.baseCharge),
              ratePerM3: num(tariff.ratePerM3),
              blocks: tariff.blocks,
            });
        } catch {
          /* Invalid configuration is a finding, not a failed run. */
        }
        add(
          bill,
          !tariff ||
            !account ||
            !accountTariff ||
            accountTariff.customerClass !== tariff.customerClass ||
            accountTariff.meterSizeMm !== tariff.meterSizeMm ||
            tariff.currency !== "PHP" ||
            !Number.isFinite(amount) ||
            Math.abs(num(bill.amount) - amount) >
              num(config.tolerancePhp ?? 0.01) + 1e-8 ||
            time(bill.periodStart) < time(tariff.effectiveFrom) ||
            (!!tariff.effectiveTo &&
              time(bill.periodEnd) > time(tariff.effectiveTo)),
          "Tariff version, effective period or PHP water charge disagrees with the configured schedule.",
        );
      }
      break;
    case "sampling-interval":
      for (const point of e["sampling-points"])
        for (const parameter of s.parameters) {
          const interval = num(parameter.monitoringIntervalHours) * 3600000;
          const recent = e["water-quality"].some(
            (r) =>
              r.samplingPointId === point.id &&
              r.parameterId === parameter.id &&
              r.unit === parameter.unit &&
              num(r.value) >= num(parameter.plausibleMin) &&
              num(r.value) <= num(parameter.plausibleMax) &&
              (parameter.code !== "COLI" || Number.isInteger(num(r.value))) &&
              time(r.sampledAt) <= now.getTime() &&
              time(r.sampledAt) >= now.getTime() - interval,
          );
          add(
            { id: `${point.id}|${parameter.id}` },
            !recent,
            "No valid observation within the demo reminder interval. Review the sampling plan; this is not a regulatory frequency assessment.",
          );
        }
      break;
    case "standards-provenance":
      for (const p of s.parameters)
        add(
          p,
          !String(p.standardCode ?? "").startsWith("PNSDW-") ||
            !/^https:\/\/(?:www\.)?(?:fda|doh)\.gov\.ph\//.test(
              String(p.standardUrl),
            ) ||
            !String(p.referenceSection ?? "").trim() ||
            !String(p.method ?? "").trim() ||
            num(p.limitMin) > num(p.limitMax) ||
            num(p.monitoringIntervalHours) <= 0,
          "Parameter reference version, government source, method or limits require review.",
        );
      break;
    default:
      throw new ApiError(
        422,
        "UNKNOWN_DQ_CHECK",
        `Rule check ${checkId} is not implemented.`,
      );
  }
  return obs;
}
export const score = (checked: number, failed: number) =>
  checked ? Math.round((1 - failed / checked) * 10000) / 100 : 0;
