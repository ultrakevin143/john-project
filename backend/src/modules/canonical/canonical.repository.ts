import { type Entity } from "./canonical.schemas.js";
import { type DB, type Repository } from "./canonical.types.js";

export const modelNames: Record<Entity, string> = {
  accounts: "CustomerAccount",
  "service-connections": "ServiceConnection",
  meters: "Meter",
  "meter-readings": "MeterReading",
  billing: "BillingRecord",
  facilities: "Facility",
  production: "ProductionReading",
  pipelines: "PipelineAsset",
  "sampling-points": "SamplingPoint",
  "water-quality": "WaterQualityResult",
  "work-orders": "WorkOrder",
  leaks: "LeakReport",
  complaints: "CustomerComplaint",
};
export function repository(db: DB, entity: Entity): Repository {
  const delegates = {
    accounts: db.customerAccount,
    "service-connections": db.serviceConnection,
    meters: db.meter,
    "meter-readings": db.meterReading,
    billing: db.billingRecord,
    facilities: db.facility,
    production: db.productionReading,
    pipelines: db.pipelineAsset,
    "sampling-points": db.samplingPoint,
    "water-quality": db.waterQualityResult,
    "work-orders": db.workOrder,
    leaks: db.leakReport,
    complaints: db.customerComplaint,
  };
  return delegates[entity] as unknown as Repository;
}
