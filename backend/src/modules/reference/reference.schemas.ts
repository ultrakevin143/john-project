import { z } from "zod";
import { cebuLocations } from "./reference.data.js";

export function validDemoLocation(city: unknown, barangay: unknown) {
  return cebuLocations.some((p) => p.city === city && p.barangay === barangay);
}
export const tariffBlockSchema = z
  .object({
    upToM3: z.number().positive().max(1000000).multipleOf(0.001).nullable(),
    rate: z.number().finite().nonnegative().max(100000).multipleOf(0.0001),
  })
  .strict();
export const tariffScheduleSchema = z
  .object({
    baseVolumeM3: z.coerce
      .number()
      .finite()
      .nonnegative()
      .max(1000000)
      .multipleOf(0.001),
    baseCharge: z.coerce
      .number()
      .finite()
      .nonnegative()
      .max(100000000)
      .multipleOf(0.01),
    ratePerM3: z.coerce
      .number()
      .finite()
      .nonnegative()
      .max(100000)
      .multipleOf(0.0001),
    blocks: z.array(tariffBlockSchema).max(20),
  })
  .superRefine((v, ctx) => {
    let previous = v.baseVolumeM3;
    for (const [i, block] of v.blocks.entries()) {
      if (block.upToM3 === null) {
        if (i !== v.blocks.length - 1)
          ctx.addIssue({
            code: "custom",
            message: "Only the last bracket may be open-ended.",
            path: ["blocks", i],
          });
      } else if (block.upToM3 <= previous) {
        ctx.addIssue({
          code: "custom",
          message:
            "Bracket upper limits must increase above the included volume.",
          path: ["blocks", i],
        });
      } else previous = block.upToM3;
    }
    if (v.blocks.length && v.blocks.at(-1)?.upToM3 !== null)
      ctx.addIssue({
        code: "custom",
        message: "The last bracket must be open-ended.",
        path: ["blocks"],
      });
  });

export const tariffVersionSchema = z
  .object({
    supersedesId: z.uuid(),
    code: z
      .string()
      .trim()
      .regex(/^[A-Z0-9-]{3,30}$/),
    name: z.string().trim().min(3).max(100),
    effectiveFrom: z.iso.date(),
    baseVolumeM3: z.number().finite().nonnegative(),
    baseCharge: z.number().finite().nonnegative(),
    ratePerM3: z.number().finite().nonnegative(),
    blocks: z
      .array(
        z
          .object({
            upToM3: z.number().finite().positive().nullable(),
            rate: z.number().finite().nonnegative(),
          })
          .strict(),
      )
      .max(20),
    reason: z.string().trim().min(8).max(500),
  })
  .strict()
  .superRefine((v, ctx) => {
    const parsed = tariffScheduleSchema.safeParse(v);
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        ctx.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
  });
