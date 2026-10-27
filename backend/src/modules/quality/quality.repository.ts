import { repository } from "../canonical/canonical.repository.js";
import { entityNames, type Entity } from "../canonical/canonical.schemas.js";
import { type Canonical, type DB } from "../canonical/canonical.types.js";

export type Item = Record<string, unknown> & {
  id: string;
};
export type Snapshot = {
  entities: Record<Entity, Canonical[]>;
  dmas: Item[];
  tariffs: Item[];
  parameters: Item[];
  sources: Item[];
  raw: Item[];
  assets: Item[];
};
export async function snapshot(
  db: DB,
  organizationId: string,
): Promise<Snapshot> {
  const base = { where: { organizationId } };
  const entities = Object.fromEntries(
    await Promise.all(
      entityNames.map(async (e) => [
        e,
        await repository(db, e).findMany({
          where: { organizationId, archivedAt: null },
        }),
      ]),
    ),
  ) as Record<Entity, Canonical[]>;
  const [dmas, tariffs, parameters, sources, raw, assets] = await Promise.all([
    db.districtMeteredArea.findMany(base),
    db.tariff.findMany(base),
    db.waterQualityParameter.findMany(base),
    db.sourceSystem.findMany(base),
    db.rawImportRecord.findMany(base),
    db.dataAsset.findMany(base),
  ]);
  return { entities, dmas, tariffs, parameters, sources, raw, assets };
}
