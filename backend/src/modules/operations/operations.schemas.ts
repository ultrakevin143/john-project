import { z } from "zod";

export const correctWaterQualitySchema = z
  .object({
    value: z.number().finite(),
    unit: z.string().trim().min(1).max(40),
    correctiveActionId: z.uuid().nullable(),
    version: z.number().int().positive(),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();
export const statusEntitySchema = z.enum(["work-orders", "complaints"]);
export const updateOperationalStatusSchema = z
  .object({
    status: z.string().max(30),
    dispatchedAt: z.string().optional(),
    completedAt: z.string().optional(),
    resolvedAt: z.string().optional(),
    updatedAt: z.iso.datetime({ offset: true }),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();
export const archiveReasonSchema = z
  .object({ reason: z.string().trim().min(8).max(500) })
  .strict();
