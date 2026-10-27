import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { type Config } from "../../config/env.js";
import { requirePermission } from "../../middleware/authentication.js";
import { createOperationsController } from "./operations.controller.js";

export function operationRoutes(db: PrismaClient, config: Config) {
  const router = Router();
  const controller = createOperationsController(db, config);
  router.use(requirePermission("operations:read"));
  router.get("/lookups", controller.getLookups);
  router.get("/:entity", controller.getEntity);
  router.get("/:entity/:id", controller.getEntityId);
  router.patch(
    "/water-quality/:id",
    requirePermission("lab:correct"),
    controller.patchWaterQualityId,
  );
  router.patch(
    "/:entity/:id/status",
    requirePermission("field:write"),
    controller.patchEntityIdStatus,
  );
  router.post(
    "/:entity/:id/archive",
    requirePermission("operations:archive"),
    controller.postEntityIdArchive,
  );
  return router;
}
