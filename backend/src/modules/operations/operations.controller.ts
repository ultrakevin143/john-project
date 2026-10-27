import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import { type Config } from "../../config/env.js";
import { actor } from "../../shared/request-context.js";
import { createOperationsService } from "./operations.service.js";
export function createOperationsController(db: PrismaClient, config: Config) {
  const service = createOperationsService(db, config);
  const getLookups: RequestHandler = async (req, res) => {
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
    const result = await service.getLookups(requestInput, requestContext);
    res.json(result);
  };
  const getEntity: RequestHandler = async (req, res) => {
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
    const result = await service.getEntity(requestInput, requestContext);
    res.json(result);
  };
  const getEntityId: RequestHandler = async (req, res) => {
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
    const result = await service.getEntityId(requestInput, requestContext);
    res.json(result);
  };
  const patchWaterQualityId: RequestHandler = async (req, res) => {
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
    const result = await service.patchWaterQualityId(
      requestInput,
      requestContext,
    );
    res.json(result);
  };
  const patchEntityIdStatus: RequestHandler = async (req, res) => {
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
    const result = await service.patchEntityIdStatus(
      requestInput,
      requestContext,
    );
    res.json(result);
  };
  const postEntityIdArchive: RequestHandler = async (req, res) => {
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
    const _result = await service.postEntityIdArchive(
      requestInput,
      requestContext,
    );
    res.status(204).end();
  };
  return {
    getLookups,
    getEntity,
    getEntityId,
    patchWaterQualityId,
    patchEntityIdStatus,
    postEntityIdArchive,
  };
}
