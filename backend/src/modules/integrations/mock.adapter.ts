import type { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "../../shared/errors.js";
import { repository } from "../canonical/canonical.repository.js";
import {
  entitySchema,
  schemas,
  type Entity,
} from "../canonical/canonical.schemas.js";

// Synthetic in-process REST-provider substitute, never an external network call.
export async function mockRecords(
  db: PrismaClient,
  organizationId: string,
  entity: Entity,
): Promise<Prisma.InputJsonObject[]> {
  entitySchema.parse(entity);
  const row = await repository(db, entity).findFirst({
    where: { organizationId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!row)
    throw new ApiError(
      422,
      "MOCK_SETUP",
      "Load records for this dataset through CSV before requesting a synthetic provider snapshot.",
    );
  const schema = schemas[entity];
  const fields = Object.keys(schema.shape);
  return [
    Object.fromEntries(
      fields
        .filter((k) => row[k] !== undefined && row[k] !== null)
        .map((k) => [
          k,
          row[k] instanceof Date
            ? (row[k] as Date).toISOString()
            : typeof row[k] === "object"
              ? String(row[k])
              : row[k],
        ]),
    ) as Prisma.InputJsonObject,
  ];
}
