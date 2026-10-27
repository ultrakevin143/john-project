import { z } from "zod";
import {
  entityNames,
  schemas,
} from "../modules/canonical/canonical.schemas.js";

export function openapi() {
  const responses = {
    "200": {
      description: "Success",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/Envelope" },
        },
      },
    },
    "201": { description: "Created" },
    "204": { description: "Session revoked or record archived" },
    "401": { description: "Sign in required" },
    "403": { description: "Permission or domain denied" },
    "404": { description: "Record not found" },
    "409": { description: "Version, replay-key or active-run conflict" },
    "422": {
      description: "Validation failed",
      content: {
        "application/json": { schema: { $ref: "#/components/schemas/Error" } },
      },
    },
    "429": { description: "Rate limited" },
    "503": { description: "Database unavailable" },
  };
  const operation = (summary: string, write = false) => ({
    summary,
    security: [{ session: [] }],
    responses,
    ...(write
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  description:
                    "Field contracts: docs/api.md. Unknown fields are rejected.",
                },
              },
            },
          },
        }
      : {}),
  });
  const paths: Record<string, Record<string, unknown>> = {
    "/health": {
      get: {
        summary: "Process health; no database query",
        responses: { "200": { description: "Healthy" } },
      },
    },
    "/ready": {
      get: {
        summary: "Database readiness, cached for 30 seconds",
        responses: {
          "200": { description: "Ready" },
          "503": { description: "Unavailable" },
        },
      },
    },
  };
  for (const route of [
    "/auth/login",
    "/auth/refresh",
    "/auth/logout",
    "/integrations/imports",
    "/integrations/runs/{id}/retry",
    "/dq/runs",
    "/reference/tariffs",
  ])
    paths[route] = { post: operation(`Execute ${route}`, true) };
  for (const route of [
    "/auth/me",
    "/overview",
    "/operations/lookups",
    "/reference",
    "/integrations/sources",
    "/integrations/runs",
    "/integrations/runs/{id}",
    "/integrations/errors",
    "/dq/rules",
    "/dq/runs",
    "/dq/scorecards",
    "/users",
    "/users/roles",
    "/insights/quality-trends",
    "/insights/meter-reliability",
    "/governance/domains",
    "/governance/assets",
    "/audit-events",
    "/reports/operations",
    "/reports/nrw",
    "/reports/water-quality",
  ])
    paths[route] = { ...paths[route], get: operation(`Read ${route}`) };
  paths["/users"]!.post = operation(
    "Create a district user; administrator only; name, email, password (12–128), roleId and reason required",
    true,
  );
  paths["/users/{id}"] = {
    patch: operation(
      "Update user name, roleId and active flag with updatedAt and reason; administrator only",
      true,
    ),
  };
  paths["/users/{id}/recovery"] = {
    post: operation(
      "Administrator reauthenticates and records independent verification to issue a single-use recovery code",
      true,
    ),
  };
  paths["/auth/recover"] = {
    post: {
      ...operation(
        "Redeem a recovery code and set a new password; revokes existing sessions",
        true,
      ),
      security: [],
    },
  };
  paths["/auth/security-question"] = {
    get: operation("Read your security question; the answer is never returned"),
    put: operation(
      "Set a security question using your password and, if configured, your existing answer",
      true,
    ),
  };
  paths["/auth/change-password"] = {
    post: operation(
      "Change your password using your current password and security answer; revoke sessions",
      true,
    ),
  };
  paths["/users/{id}/security-question"] = {
    put: operation(
      "Administrator reauthenticates and records independent verification to reset a user's question",
      true,
    ),
  };
  for (const entity of entityNames) {
    paths[`/operations/${entity}`] = {
      get: {
        ...operation(
          `List ${entity}; organization and domain authorization required`,
        ),
        parameters: [
          "page",
          "pageSize",
          "search",
          "sort",
          "status",
          "dmaId",
          "sourceSystemId",
        ].map((name) => ({ in: "query", name, schema: { type: "string" } })),
      },
    };
    paths[`/operations/${entity}/{id}`] = {
      get: operation(`Read ${entity} with source lineage`),
    };
    paths[`/operations/${entity}/{id}/archive`] = {
      post: operation(
        `Archive ${entity}; billing and laboratory archival is denied`,
        true,
      ),
    };
  }
  for (const route of [
    "/operations/water-quality/{id}",
    "/operations/work-orders/{id}/status",
    "/operations/complaints/{id}/status",
    "/governance/assets/{id}",
    "/dq/results/{id}",
    "/dq/rules/{id}",
  ])
    paths[route] = {
      ...paths[route],
      patch: operation(`Governed update ${route}`, true),
    };
  for (const [route, item] of Object.entries(paths))
    if (route.includes("{id}"))
      item.parameters = [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ];
  const canonical = Object.fromEntries(
    entityNames.map((entity) => [
      entity,
      z.toJSONSchema(schemas[entity], { io: "input", unrepresentable: "any" }),
    ]),
  );
  paths["/auth/login"]!.post = {
    ...operation("Create a secure session", true),
    security: [],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["email", "password"],
            additionalProperties: false,
            properties: {
              email: { type: "string", format: "email" },
              password: { type: "string", minLength: 1, maxLength: 128 },
            },
          },
        },
      },
    },
  };
  paths["/integrations/imports"]!.post = {
    ...operation("Validate and load a canonical snapshot", true),
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["sourceSystemId", "idempotencyKey", "format"],
            additionalProperties: false,
            properties: {
              sourceSystemId: { type: "string", format: "uuid" },
              entity: { type: "string", enum: entityNames },
              idempotencyKey: { type: "string", minLength: 8, maxLength: 120 },
              format: { enum: ["csv", "json", "mock"] },
              csv: { type: "string", maxLength: 1000000 },
              records: {
                type: "array",
                maxItems: 500,
                items: {
                  oneOf: entityNames.map((e) => ({
                    $ref: `#/components/schemas/${e}`,
                  })),
                },
              },
            },
          },
        },
      },
    },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "Water Utility Data Hub API",
      version: "1.0.0",
      description:
        "Synthetic water-utility MVP. See docs/api.md for permission and request contracts.",
    },
    servers: [{ url: "/api" }],
    paths,
    components: {
      securitySchemes: {
        session: { type: "apiKey", in: "cookie", name: "water_session" },
      },
      schemas: {
        ...canonical,
        Envelope: {
          type: "object",
          properties: { data: {}, pagination: { type: "object" } },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "requestId"],
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                requestId: { type: "string" },
                details: { type: "array", items: { type: "object" } },
              },
            },
          },
        },
      },
    },
  };
}
