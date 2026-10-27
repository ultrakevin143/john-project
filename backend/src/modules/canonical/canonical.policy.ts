import { type Entity } from "./canonical.schemas.js";

export const entityDomain: Record<Entity, string> = {
  accounts: "billing",
  "service-connections": "metering",
  meters: "metering",
  "meter-readings": "metering",
  billing: "billing",
  facilities: "production",
  production: "production",
  pipelines: "assets",
  "sampling-points": "quality",
  "water-quality": "quality",
  "work-orders": "field",
  leaks: "field",
  complaints: "customer",
};
export const permittedEntities: Record<string, Entity[]> = {
  billing: ["accounts", "billing"],
  "meter-readings": ["service-connections", "meters", "meter-readings"],
  production: ["facilities", "production"],
  "water-quality": ["sampling-points", "water-quality"],
  "work-orders": ["work-orders", "leaks"],
  complaints: ["complaints"],
  pipelines: ["pipelines"],
};
export const transitions: Record<string, Record<string, string[]>> = {
  "work-orders": {
    OPEN: ["DISPATCHED"],
    DISPATCHED: ["OPEN", "IN_PROGRESS"],
    IN_PROGRESS: ["COMPLETED"],
    COMPLETED: ["CLOSED"],
    CLOSED: [],
  },
  complaints: {
    OPEN: ["ASSIGNED"],
    ASSIGNED: ["OPEN", "RESOLVED"],
    RESOLVED: ["ASSIGNED", "CLOSED"],
    CLOSED: [],
  },
};
export const canTransition = (entity: string, from: string, to: string) =>
  from === to || transitions[entity]?.[from]?.includes(to) === true;

export const allowedTransition = (from: string, to: string) =>
  from === to ||
  (
    {
      OPEN: ["ASSIGNED"],
      ASSIGNED: ["OPEN", "RESOLVED"],
      RESOLVED: ["ASSIGNED", "CLOSED"],
      CLOSED: [],
    } as Record<string, string[]>
  )[from]?.includes(to) === true;
