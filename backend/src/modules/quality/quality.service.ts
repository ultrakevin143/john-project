import { Prisma, type PrismaClient } from "@prisma/client";
import { audit, type AuditInput } from "../../shared/audit.js";
import { ApiError } from "../../shared/errors.js";
import {
  pageResponse,
  paginate,
  paging,
  uuid,
} from "../../shared/validation.js";
import { evaluate, score } from "./quality.engine.js";
import { snapshot } from "./quality.repository.js";
import { readableSample } from "./quality.samples.js";
import {
  updateRemediationSchema,
  updateQualityRuleSchema,
  startQualityRunSchema,
} from "./quality.schemas.js";

import {
  requireIdentity,
  serviceAudit,
  type ServiceContext,
  type ServiceInput,
} from "../../shared/service-context.js";
export async function runQuality(
  db: PrismaClient,
  context: Omit<AuditInput, "action" | "entity">,
) {
  const run = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${context.organizationId}))`;
    if (
      await tx.dQRun.findFirst({
        where: { organizationId: context.organizationId, status: "RUNNING" },
      })
    )
      throw new ApiError(
        409,
        "DQ_BUSY",
        "A quality run is active. Review it before starting another.",
      );
    const run = await tx.dQRun.create({
      data: {
        organizationId: context.organizationId,
        initiatedBy: context.actorName,
      },
    });
    await audit(tx, {
      ...context,
      action: "DQ_STARTED",
      entity: "dq-run",
      entityId: run.id,
    });
    return run;
  });
  try {
    const { s, rules } = await db.$transaction(
      async (tx) => ({
        s: await snapshot(tx, context.organizationId),
        rules: await tx.dQRule.findMany({
          where: { organizationId: context.organizationId, active: true },
          orderBy: { code: "asc" },
        }),
      }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30000,
      },
    );
    if (!rules.length)
      throw new ApiError(
        422,
        "NO_DQ_RULES",
        "No active rules. Configure rules before running quality checks.",
      );
    const results = rules.map((rule) => {
      const observations = evaluate(
        rule.checkId,
        s,
        rule.config as Record<string, unknown>,
      );
      const failed = observations.filter((o) => o.failed);
      return {
        organizationId: context.organizationId,
        runId: run.id,
        ruleId: rule.id,
        severity: rule.severity,
        checked: observations.length,
        failed: failed.length,
        passed: failed.length === 0,
        samples: failed.slice(0, 5).map((o) => readableSample(s, o)),
        remediation: failed.length ? ("OPEN" as const) : ("RESOLVED" as const),
      };
    });
    const checked = results.reduce((n, r) => n + r.checked, 0),
      failed = results.reduce((n, r) => n + r.failed, 0);
    return await db.$transaction(async (tx) => {
      await tx.dQResult.createMany({ data: results });
      const saved = await tx.dQRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCEEDED",
          finishedAt: new Date(),
          checked,
          failed,
          score: score(checked, failed),
        },
      });
      await audit(tx, {
        ...context,
        action: "DQ_COMPLETED",
        entity: "dq-run",
        entityId: run.id,
        metadata: { checked, failed, score: saved.score },
      });
      return saved;
    });
  } catch (error) {
    await db.dQRun.update({
      where: { id: run.id },
      data: { status: "FAILED", finishedAt: new Date() },
    });
    await audit(db, {
      ...context,
      action: "DQ_FAILED",
      entity: "dq-run",
      entityId: run.id,
    });
    throw error;
  }
}
export function createQualityService(db: PrismaClient) {
  const getRules = async (
    _requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    return {
      data: await db.dQRule.findMany({
        where: {
          organizationId: requireIdentity(requestContext.user).organizationId,
        },
        orderBy: { code: "asc" },
      }),
    };
  };
  const postRuns = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    startQualityRunSchema.parse(requestInput.body ?? {});
    return { data: await runQuality(db, serviceAudit(requestContext.audit)) };
  };
  const getRuns = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const q = paging.parse(requestInput.query),
      where = {
        organizationId: requireIdentity(requestContext.user).organizationId,
      };
    const [rows, total] = await Promise.all([
      db.dQRun.findMany({
        where,
        ...paginate(q.page, q.pageSize),
        orderBy: { startedAt: q.sort },
      }),
      db.dQRun.count({ where }),
    ]);
    return pageResponse(rows, total, q.page, q.pageSize);
  };
  const getScorecards = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const organizationId = requireIdentity(requestContext.user).organizationId,
      id = uuid.optional().parse(requestInput.query.runId);
    const data = await db.dQRun.findFirst({
      where: { organizationId, ...(id ? { id } : { status: "SUCCEEDED" }) },
      orderBy: { startedAt: "desc" },
      include: {
        results: {
          include: { rule: true },
          orderBy: { rule: { code: "asc" } },
        },
      },
    });
    return {
      data: data
        ? {
            ...data,
            formula:
              "100 × (1 − failed record-rule checks / total record-rule checks); rounded to two decimals. No observations = 0, not a pass.",
          }
        : null,
    };
  };
  const patchResultsId = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const id = uuid.parse(requestInput.params.id),
      body = updateRemediationSchema.parse(requestInput.body);
    const result = await db.dQResult.findFirst({
      where: {
        id,
        organizationId: requireIdentity(requestContext.user).organizationId,
      },
    });
    if (!result)
      throw new ApiError(404, "NOT_FOUND", "Quality result not found.");
    const data = await db.$transaction(async (tx) => {
      const updated = await tx.dQResult.update({
        where: { id },
        data: { remediation: body.remediation, remediationNote: body.note },
      });
      await audit(tx, {
        ...serviceAudit(requestContext.audit),
        action: "DQ_REMEDIATED",
        entity: "dq-result",
        entityId: id,
        reason: body.note,
        metadata: { from: result.remediation, to: body.remediation },
      });
      return updated;
    });
    return { data };
  };
  const patchRulesId = async (
    requestInput: ServiceInput,
    requestContext: ServiceContext,
  ) => {
    const id = uuid.parse(requestInput.params.id),
      body = updateQualityRuleSchema.parse(requestInput.body);
    const result = await db.dQRule.updateMany({
      where: {
        id,
        organizationId: requireIdentity(requestContext.user).organizationId,
      },
      data: { active: body.active },
    });
    if (!result.count) throw new ApiError(404, "NOT_FOUND", "Rule not found.");
    await audit(db, {
      ...serviceAudit(requestContext.audit),
      action: "DQ_RULE_CHANGED",
      entity: "dq-rule",
      entityId: id,
      reason: body.reason,
      metadata: { active: body.active },
    });
    return { data: { id, active: body.active } };
  };
  return {
    getRules,
    postRuns,
    getRuns,
    getScorecards,
    patchResultsId,
    patchRulesId,
  };
}
