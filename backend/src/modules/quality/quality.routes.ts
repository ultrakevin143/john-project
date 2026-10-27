import { type PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requirePermission } from "../../middleware/authentication.js";
import { createQualityController } from "./quality.controller.js";

export function qualityRoutes(db: PrismaClient) {
  const router = Router();
  const controller = createQualityController(db);
  router.use(requirePermission("dq:read"));
  router.get("/rules", controller.getRules);
  router.post("/runs", requirePermission("dq:write"), controller.postRuns);
  router.get("/runs", controller.getRuns);
  router.get("/scorecards", controller.getScorecards);
  router.patch(
    "/results/:id",
    requirePermission("dq:write"),
    controller.patchResultsId,
  );
  router.patch(
    "/rules/:id",
    requirePermission("dq:write"),
    controller.patchRulesId,
  );
  return router;
}
