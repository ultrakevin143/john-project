import { z } from "zod";

export const startQualityRunSchema = z.object({}).strict();
export const updateRemediationSchema = z
  .object({
    remediation: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED"]),
    note: z.string().trim().min(8).max(500),
  })
  .strict();
export const updateQualityRuleSchema = z
  .object({
    active: z.boolean(),
    reason: z.string().trim().min(8).max(500),
  })
  .strict();
