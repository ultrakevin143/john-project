import { z } from "zod";

export const reportNameSchema = z.enum(["operations", "nrw", "water-quality"]);
export const reportFormatSchema = z.enum(["json", "csv"]).default("json");
export const reportDmaFilterSchema = z.uuid().optional();
