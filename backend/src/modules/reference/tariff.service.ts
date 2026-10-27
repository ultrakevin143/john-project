import { Prisma } from "@prisma/client";
import { tariffScheduleSchema } from "./reference.schemas.js";
export function tariffAmount(volumeM3: number, input: unknown) {
  if (!Number.isFinite(volumeM3) || volumeM3 < 0)
    throw new Error("A non-negative billed volume is required.");
  const tariff = tariffScheduleSchema.parse(input);
  const volume = new Prisma.Decimal(volumeM3);
  let total = new Prisma.Decimal(tariff.baseCharge),
    previous = new Prisma.Decimal(tariff.baseVolumeM3);
  if (!tariff.blocks.length)
    total = total.plus(
      Prisma.Decimal.max(0, volume.minus(previous)).times(tariff.ratePerM3),
    );
  for (const block of tariff.blocks) {
    total = total.plus(
      Prisma.Decimal.max(
        0,
        Prisma.Decimal.min(volume, block.upToM3 ?? volume).minus(previous),
      ).times(block.rate),
    );
    if (block.upToM3 === null) break;
    previous = new Prisma.Decimal(block.upToM3);
  }
  return total.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}
