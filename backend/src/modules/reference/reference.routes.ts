import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { requirePermission } from "../../middleware/authentication.js";
import { createReferenceController } from "./reference.controller.js";

export function referenceRoutes(db: PrismaClient) {
  const router = Router();
  const controller = createReferenceController(db);
  router.use(requirePermission("operations:read"));
  router.get("/", controller.getIndex);
  router.post(
    "/tariffs",
    requirePermission("governance:write"),
    requirePermission("domain:billing"),
    controller.postTariffs,
  );
  return router;
}
