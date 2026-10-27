import { entityNames } from "../canonical/canonical.schemas.js";
import { tariffAmount } from "../reference/tariff.service.js";
import { type Observation } from "./quality.engine.js";
import { type Snapshot } from "./quality.repository.js";

// Store a small, readable snapshot of the finding. Identity fields and raw
// provider payloads are deliberately excluded from these investigation samples.
export function readableSample(s: Snapshot, observation: Observation) {
  const values: {
    label: string;
    value: string;
  }[] = [];
  const add = (label: string, value: unknown) => {
    if (value !== undefined && value !== null)
      values.push({
        label,
        value:
          value instanceof Date
            ? new Intl.DateTimeFormat("en-PH", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Manila",
              }).format(value) + " PHT"
            : String(value),
      });
  };
  for (const entity of entityNames) {
    const row = s.entities[entity].find((r) => r.id === observation.id);
    if (!row) continue;
    const label = String(
      row.reference ??
        row.sampleReference ??
        row.serialNumber ??
        row.code ??
        row.sourceRecordId,
    );
    if (entity === "billing") {
      const reading = s.entities["meter-readings"].find(
        (r) => r.id === row.meterReadingId,
      );
      add("Billed volume (m³)", row.billedM3);
      add("Meter consumption (m³)", reading?.consumptionM3);
      add("Billing period start", row.periodStart);
      add("Billing period end (exclusive)", row.periodEnd);
      add("Water charge (PHP)", row.amount);
      const tariff = s.tariffs.find((t) => t.id === row.tariffId);
      add("Tariff version", tariff?.name);
      if (tariff) {
        try {
          add(
            "Expected water charge (PHP)",
            tariffAmount(Number(row.billedM3), {
              baseVolumeM3: Number(tariff.baseVolumeM3),
              baseCharge: Number(tariff.baseCharge),
              ratePerM3: Number(tariff.ratePerM3),
              blocks: tariff.blocks,
            }),
          );
        } catch {
          add("Tariff configuration", "Invalid schedule; review required");
        }
      }
    } else if (entity === "water-quality") {
      const parameter = s.parameters.find((p) => p.id === row.parameterId),
        point = s.entities["sampling-points"].find(
          (p) => p.id === row.samplingPointId,
        );
      add("Sampling point", point?.name);
      add("Parameter", parameter?.name);
      add("Result", `${row.value} ${row.unit}`);
      add(
        "Reference limits",
        parameter
          ? `${parameter.limitMin}–${parameter.limitMax} ${parameter.unit}`
          : undefined,
      );
      add(
        "Corrective work order",
        s.entities["work-orders"].find((w) => w.id === row.correctiveActionId)
          ?.reference ?? "Not linked",
      );
      add("Reference standard", parameter?.standardCode);
      add("Analysis method", parameter?.method);
    } else if (entity === "meter-readings") {
      add(
        "Meter serial",
        s.entities.meters.find((m) => m.id === row.meterId)?.serialNumber,
      );
      add("Previous register (m³)", row.previousM3);
      add("Current register (m³)", row.currentM3);
      add("Consumption (m³)", row.consumptionM3);
      add("Read type", row.readType);
    } else if (entity === "production") {
      add(
        "Facility",
        s.entities.facilities.find((f) => f.id === row.facilityId)?.name,
      );
      add("Flow (L/s)", row.flowLs);
      add("Pressure (bar)", row.pressureBar);
      add("Volume (m³)", row.volumeM3);
      add("Observed (PHT)", row.occurredAt);
    } else if (entity === "accounts") {
      add("City", row.city || "Missing");
      add("Barangay", row.barangay || "Missing");
      add("Location check", "Must match the linked demo area");
    } else {
      add("Status", row.status);
      add("Source record", row.sourceRecordId);
      add("Reported (PHT)", row.reportedAt);
      add("Completed (PHT)", row.completedAt);
      add("Resolved (PHT)", row.resolvedAt);
    }
    return {
      id: observation.id,
      label:
        entity === "accounts"
          ? `Account ending ${String(row.accountNumber).slice(-4)}`
          : label,
      reason: observation.reason,
      entity,
      values,
    };
  }
  const [pointId, parameterId] = observation.id.split("|");
  if (parameterId) {
    const point = s.entities["sampling-points"].find((p) => p.id === pointId),
      parameter = s.parameters.find((p) => p.id === parameterId);
    add("Sampling point", point?.name);
    add("Parameter", parameter?.name);
    add("Demo reminder interval (hours)", parameter?.monitoringIntervalHours);
    return {
      id: observation.id,
      label: `${point?.name ?? "Sampling point"} · ${parameter?.name ?? "Parameter"}`,
      reason: observation.reason,
      values,
    };
  }
  const parameter = s.parameters.find((p) => p.id === observation.id);
  if (parameter) {
    add("Standard", parameter.standardCode);
    add("Source", parameter.standardUrl);
    add("Method", parameter.method);
    return {
      id: observation.id,
      label: String(parameter.name),
      reason: observation.reason,
      values,
    };
  }
  const source = s.sources.find((r) => r.id === observation.id),
    asset = s.assets.find((r) => r.id === observation.id),
    raw = s.raw.find((r) => r.id === observation.id);
  if (source) {
    add("Last successful load", source.lastSuccessAt ?? "None");
    add("Expected interval (hours)", source.freshnessHours);
    return {
      id: observation.id,
      label: String(source.name),
      reason: observation.reason,
      values,
    };
  }
  if (asset) {
    add("Classification", asset.classification);
    add("Owner", asset.owner);
    add("Steward", asset.steward);
    add("Retention (days)", asset.retentionDays);
    return {
      id: observation.id,
      label: String(asset.name),
      reason: observation.reason,
      values,
    };
  }
  if (raw) {
    add("Source record", raw.sourceRecordId);
    add("Row outcome", raw.status);
    return {
      id: observation.id,
      label: `Import row ${raw.rowNumber}`,
      reason: observation.reason,
      values,
    };
  }
  const [start, end] = observation.id.split(":").map(Number);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    add("Period start", new Date(start!));
    add("Period end (exclusive)", new Date(end!));
    return {
      id: observation.id,
      label: "Billing cycle",
      reason: observation.reason,
      values,
    };
  }
  return {
    id: observation.id,
    label: "Affected observation",
    reason: observation.reason,
    values,
  };
}
