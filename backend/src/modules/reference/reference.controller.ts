import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { actor } from "../../shared/request-context.js";
import { createReferenceService } from "./reference.service.js";
export function createReferenceController(db: PrismaClient) {
  const service = createReferenceService(db);
  const getIndex: RequestHandler = async (req, res) => {
    const requestInput = {
      body: req.body,
      query: req.query,
      params: req.params,
    };
    const requestContext = {
      user: req.identity,
      requestId: req.requestId,
      audit: () => actor(req),
    };
    const result = await service.getIndex(requestInput, requestContext);
    res.json(result);
  };
  const postTariffs: RequestHandler = async (req, res) => {
    const requestInput = {
      body: req.body,
      query: req.query,
      params: req.params,
    };
    const requestContext = {
      user: req.identity,
      requestId: req.requestId,
      audit: () => actor(req),
    };
    const result = await service.postTariffs(requestInput, requestContext);
    res.status(201).json(result);
  };
  return { getIndex, postTariffs };
}
