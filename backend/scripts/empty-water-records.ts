import { Prisma,type PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { organizationId } from "../prisma/seed.js";

// An explicit maintenance operation, never exposed by an HTTP endpoint.
// Keep all auth, audit, catalog, source and reference tables intact.
export const operationalTables = [
  "IntegrationRecordError",
  "RawImportRecord",
  "IntegrationRun",
  "IntegrationLock",
  "DQResult",
  "DQRun",
  "CustomerComplaint",
  "LeakReport",
  "WaterQualityResult",
  "BillingRecord",
  "MeterReading",
  "ProductionReading",
  "Meter",
  "ServiceConnection",
  "CustomerAccount",
  "WorkOrder",
  "Facility",
  "SamplingPoint",
  "PipelineAsset",
] as const;
export type OperationalBackup = {
  table: string;
  rows: Record<string, unknown>[];
}[];
export async function emptyWaterRecords(
  db: PrismaClient,
  schema: "public" | "water_hub",
  saveBackup: (data: OperationalBackup) => Promise<void>,
  configure?: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  // Schema and table identifiers are closed constants; values remain parameters.
  if (!["public", "water_hub"].includes(schema))
    throw new Error("Unsupported application schema.");
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}))`;
      await tx.$executeRawUnsafe(
        `LOCK TABLE ${operationalTables.map((t) => `"${schema}"."${t}"`).join(", ")}, "${schema}"."User", "${schema}"."Session" IN ACCESS EXCLUSIVE MODE`,
      );
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org)
        throw new Error(
          "Expected Water Hub organization is missing; nothing changed.",
        );
      const users = await tx.user.findMany({
        where: { organizationId },
        orderBy: { id: "asc" },
      });
      if (
        users.length !== 8 ||
        users.some((u) => !u.email.endsWith("@waterhub.demo"))
      )
        throw new Error("Expected eight Water Hub accounts; cleanup refused.");
      const sessions = await tx.session.count();
      const union = operationalTables
        .map(
          (table) =>
            `SELECT '${table}' AS "table", COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS rows FROM "${schema}"."${table}" t WHERE t."organizationId" = $1`,
        )
        .join(" UNION ALL ");
      const before = await tx.$queryRawUnsafe<OperationalBackup>(
        union,
        organizationId,
      );
      await saveBackup(before);
      // Only these two named guards are suspended, inside the locked transaction.
      // PostgreSQL rolls this DDL back too if any step fails. Audit stays immutable.
      await tx.$executeRawUnsafe(
        `ALTER TABLE "${schema}"."WaterQualityResult" DISABLE TRIGGER lab_no_delete`,
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE "${schema}"."BillingRecord" DISABLE TRIGGER billing_no_delete`,
      );
      for (const table of operationalTables)
        await tx.$executeRawUnsafe(
          `DELETE FROM "${schema}"."${table}" WHERE "organizationId" = $1`,
          organizationId,
        );
      await tx.$executeRawUnsafe(
        `ALTER TABLE "${schema}"."WaterQualityResult" ENABLE TRIGGER lab_no_delete`,
      );
      await tx.$executeRawUnsafe(
        `ALTER TABLE "${schema}"."BillingRecord" ENABLE TRIGGER billing_no_delete`,
      );
      await tx.sourceSystem.updateMany({
        where: { organizationId },
        data: { lastSuccessAt: null, cursor: null },
      });
      await tx.integrationConnection.updateMany({
        where: { organizationId },
        data: { cursor: null },
      });
      await tx.districtMeteredArea.updateMany({
        where: { organizationId },
        data: { connections: 0 },
      });
      if (configure) await configure(tx);
      const counts = await tx.$queryRawUnsafe<
        {
          table: string;
          count: number;
        }[]
      >(
        operationalTables
          .map(
            (t) =>
              `SELECT '${t}' AS "table", count(*)::int AS count FROM "${schema}"."${t}" WHERE "organizationId" = $1`,
          )
          .join(" UNION ALL "),
        organizationId,
      );
      if (counts.some((t) => t.count !== 0))
        throw new Error("Operational cleanup did not reconcile; rolled back.");
      const afterUsers = await tx.user.findMany({
        where: { organizationId },
        orderBy: { id: "asc" },
      });
      if (
        JSON.stringify(users) !== JSON.stringify(afterUsers) ||
        sessions !== (await tx.session.count())
      )
        throw new Error(
          "Account/session preservation check failed; rolled back.",
        );
      const guards = await tx.$queryRaw<
        {
          tgname: string;
          tgenabled: string;
        }[]
      >`SELECT tgname, tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=${schema} AND tgname IN ('lab_no_delete','billing_no_delete','audit_immutable','audit_no_truncate')`;
      if (guards.length !== 4 || guards.some((g) => g.tgenabled !== "O"))
        throw new Error("Historical guards are not enabled; rolled back.");
      const summary = {
        schema,
        organizationId,
        deleted: before.map((t) => ({ table: t.table, count: t.rows.length })),
        after: counts,
        usersPreserved: users.length,
        sessionsPreserved: true,
        auditPreserved: true,
        historicalGuardsEnabled: guards.length,
      };
      await tx.auditEvent.create({
        data: {
          organizationId,
          actorName: "Authorized workspace maintenance",
          action: "OPERATIONAL_RECORDS_EMPTIED",
          entity: "workspace",
          requestId: randomUUID(),
          reason:
            "User requested empty Water Hub operational records while preserving tables and accounts.",
          metadata: summary,
        },
      });
      return summary;
    },
    {
      maxWait: 20000,
      timeout: 120000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
