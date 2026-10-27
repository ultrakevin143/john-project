# Codex Project Plan: EDM Integration Platform for Water Utility Operations

## 1. Reference activity

The final activity requires a group to map:

> **Data sources → integration methods → governance → outputs**

This project applies Enterprise Data Management (EDM) concepts: integration (ETL/ELT, APIs, CDC-ready design), governance (ownership, classification, RBAC, audit), and Data Quality Management (DQM: cleansing, duplicate detection, standardization, validation, operational reporting).

The industry used here is **municipal / water-district utility operations**: water production, distribution, metering, billing, leak management, and customer service. It is intentionally different from healthcare, banking, retail, manufacturing, education, and waste management.

## 2. Recommended industry and project concept

### Industry
Water utility operations (water district or city water service provider).

### Proposed product
Build a multi-source **Water Utility Data Hub** that consolidates operational data from customer meters, billing, pump stations and treatment plants, water-quality laboratories, pipeline/leak work orders, and customer service channels.

The platform provides a governed operational data layer, data-quality monitoring, integration visibility, audit trails, and dashboards for non-revenue water (NRW), meter-reading reliability, billing accuracy, water-quality compliance, leak response, and service-level performance.

### Why this is a good example

- It is a different industry from the reference deck and from the waste-management example.
- It has real data silos: billing, metering, SCADA-style plant data, lab results, and field work orders rarely share identifiers.
- It allows a realistic full-stack MVP using only synthetic data (no real customer or financial data).
- It demonstrates ETL, API ingestion, entity matching (meter ↔ account ↔ service connection), quality rules, governance, RBAC, audit logs, and analytics.
- NRW (water produced vs. water billed) is a natural cross-source metric that only works if integration and DQM are done properly.

## 3. Target stack

- Frontend: Next.js with TypeScript and App Router.
- UI and styling: shadcn/ui with Tailwind CSS, using accessible Radix-based primitives and a consistent application theme.
- Backend: Express.js with TypeScript.
- ORM: Prisma.
- Database: PostgreSQL hosted on Neon where deployed; local PostgreSQL through Docker Compose for development.
- API style: REST with OpenAPI documentation.
- Validation: Zod or an equivalent TypeScript schema-validation library.
- Authentication: secure session or JWT-based authentication with refresh-token/session rotation; keep the implementation replaceable.
- Testing: unit tests, integration tests, API contract tests, and a small end-to-end smoke suite.
- Local development: Docker Compose for PostgreSQL and optional supporting services; `.env.example` with no secrets.
- Observability: structured logs, request correlation IDs, health/readiness endpoints, integration-run status, and error tracking hooks.

Do not introduce Kafka, Kubernetes, microservices, a separate data warehouse, a time-series database, or a complex event bus in the first implementation unless the existing repository already requires them. Use a modular monolith with clear integration boundaries first.

## 4. High-level architecture

Use a monorepo or clearly separated frontend/backend packages, depending on the existing repository structure:

```text
Next.js web app
        |
        | HTTPS REST API
        v
Express API
  |-- Auth and RBAC
  |-- Operational domain modules
  |-- Integration ingestion modules
  |-- DQM and rule engine
  |-- Governance and audit modules
  |-- Reporting/query modules
        |
        v
Prisma
        |
        v
PostgreSQL / Neon
```

The backend should expose explicit boundaries for:

1. **Source integrations**: import data from CSV files and mock REST systems first; design adapters so real providers can be added later.
2. **Canonical data model**: normalize source-specific records into governed operational entities.
3. **DQM**: execute reusable rules, persist results, and expose quality trends.
4. **Governance**: define data domains, owners/stewards, classifications, retention metadata, and access policies.
5. **Auditability**: record who changed what, when, from where, and why where applicable.
6. **Analytics/read models**: provide safe aggregate queries for dashboards without exposing unrestricted raw source data.

## 5. Core source-to-output mapping

### Source systems

- Customer billing system: accounts, service connections, tariff class, billed volume, billing period, payment status.
- Metering / AMR system: meter identity, meter readings, read timestamps, estimated vs. actual reads, meter status.
- Production and distribution system (SCADA-style): pump stations, reservoirs, flow volumes, pressure readings, outage events.
- Water-quality laboratory system: sampling points, parameters (chlorine residual, turbidity, pH, coliform), results, compliance limits.
- Work-order / field operations system: leak repairs, pipe breaks, meter replacements, crew assignment, status.
- Customer service channel: complaints (low pressure, no water, leaks, billing disputes), location, category, resolution status.
- Asset registry: pipelines, valves, pumps, DMAs (district metered areas), installation date, material.

### Integration methods

- CSV batch import for legacy exports (billing runs, meter-reading files, lab result sheets).
- REST API ingestion for production/distribution, work-order, and customer-service sources.
- CDC-ready design through `source_updated_at`, source version, idempotency keys, and integration cursors; do not implement a real CDC broker for the MVP.
- ETL-style pipeline: extract into import records, validate and transform, then load canonical entities.
- Optional ELT-style raw landing tables for source payloads (for example, raw SCADA readings) where useful.
- Retryable integration runs with error records and replay capability.

### Governance needs

- Data ownership and stewardship by domain (Billing, Metering, Production, Quality, Field Operations, Customer Service).
- Data classification: public, internal, confidential, and restricted (customer identity and billing data are restricted).
- RBAC by role and data domain (for example: billing analyst, plant operator, lab analyst, field supervisor, data steward, administrator).
- Immutable audit events for sensitive operations and governance changes.
- Retention metadata and deletion/anonymization policy hooks.
- Least-privilege access and server-side authorization checks.
- Tenant/organization boundary if the repository is intended to support multiple water districts.
- No real customer PII in seed data; use synthetic identities and configurable masking of names, addresses, and account numbers.
- Regulatory traceability for water-quality results (who entered, who changed, when).

### Outputs

- Operations overview dashboard.
- Non-revenue water (NRW) dashboard: system input volume vs. billed volume by DMA and period.
- Meter-reading reliability dashboard: actual vs. estimated reads, missing reads, anomalous consumption.
- Water-quality compliance dashboard: results vs. limits by sampling point and parameter.
- Leak and work-order response dashboard: time to dispatch, time to repair, backlog by priority.
- Customer service dashboard: complaints by category and area, resolution time.
- Data-quality scorecards by source/domain/rule.
- Integration-run monitoring and failed-record replay screen.
- Governance catalog showing domains, owners, classifications, and rules.
- Auditable compliance and operational reports downloadable as CSV.

## 6. Canonical data model

Design Prisma models around the following entities. Adapt names to the existing codebase if appropriate, but preserve the concepts:

- `Organization` or `Tenant`
- `User`
- `Role`
- `Permission`
- `DataDomain`
- `DataAsset`
- `DataOwner` / `DataSteward`
- `SourceSystem`
- `IntegrationConnection`
- `IntegrationRun`
- `IntegrationRecordError`
- `RawImportRecord`
- `DistrictMeteredArea` (DMA)
- `CustomerAccount`
- `ServiceConnection`
- `Meter`
- `MeterReading`
- `BillingRecord`
- `Tariff`
- `Facility` (treatment plant, pump station, reservoir)
- `ProductionReading` (flow, pressure, volume)
- `PipelineAsset`
- `SamplingPoint`
- `WaterQualityParameter`
- `WaterQualityResult`
- `WorkOrder`
- `LeakReport`
- `CustomerComplaint`
- `DQRule`
- `DQRun`
- `DQResult`
- `AuditEvent`

Include UUID/CUID primary keys, source-system identifiers, created/updated timestamps, and appropriate indexes. Enforce uniqueness for natural keys such as `(sourceSystemId, sourceRecordId)` and use idempotency keys for imports. Use explicit enums for statuses, read types (actual/estimated), and classifications where that improves integrity.

Do not store arbitrary unvalidated JSON as the only representation of core operational data. JSON may be retained as a raw source payload or provider-specific extension, but canonical fields must be typed and queryable.

## 7. Minimum DQM rule set

Implement a reusable rule framework rather than hard-coding only one validation script. Each rule should include a code, name, domain/entity, severity, description, active flag, and executable check identifier.

At minimum include:

1. Required-field completeness for accounts, meters, service connections, and lab results.
2. Valid timestamp and timezone normalization (including billing-period boundaries).
3. Non-negative volume, flow, and consumption checks.
4. Valid reference checks (tariff class, DMA, sampling point, water-quality parameter).
5. Duplicate source-record detection.
6. Duplicate or conflicting meter serial numbers and account numbers.
7. Referential integrity between meter readings and known meters/service connections.
8. Meter reading sequence consistency (current reading must not be lower than previous unless a meter replacement is recorded).
9. Billed volume consistency with consumption (billed volume = current reading − previous reading within tolerance).
10. Estimated-read ratio threshold per billing cycle.
11. Water-quality result within physically plausible range and units consistent with the parameter.
12. Water-quality limit breach flagging with required corrective-action record.
13. Work-order status transition validation (for example, cannot close without a completion timestamp).
14. Customer-complaint status transition validation.
15. Freshness/staleness checks per source system (for example, no SCADA readings for a pump station in the expected interval).
16. Outlier detection for unusually high/low consumption, flow, or pressure, initially using configurable thresholds.
17. PII/classification tagging completeness for governed assets.

Persist each run, result count, pass/fail status, severity, sample offending records, and remediation status. Expose quality score calculations with transparent formulas.

## 8. API surface

Build REST endpoints with consistent error responses, pagination, filtering, sorting, and authorization. At minimum provide:

- `GET /health` and `GET /ready`
- `POST /auth/login`, `POST /auth/logout`, and current-user endpoint
- CRUD or governed read endpoints for accounts, service connections, meters, meter readings, billing records, facilities, production readings, sampling points, water-quality results, work orders, and customer complaints
- `POST /integrations/imports`
- `GET /integrations/runs`
- `GET /integrations/runs/:id`
- `POST /integrations/runs/:id/retry`
- `GET /integrations/errors`
- `GET /dq/rules`
- `POST /dq/runs`
- `GET /dq/runs`
- `GET /dq/scorecards`
- `GET /governance/domains`
- `GET /governance/assets`
- `PATCH /governance/assets/:id`
- `GET /audit-events`
- `GET /reports/operations`
- `GET /reports/nrw`
- `GET /reports/water-quality`

Generate and maintain OpenAPI documentation. Validate all request bodies, query parameters, and path parameters at the API boundary.

## 9. Frontend requirements

Create a usable administrative dashboard, not just a raw API demo. Include:

1. Login and role-aware navigation.
2. Overview page with operational KPIs (NRW %, active leaks, compliance rate, open complaints) and data-quality KPI cards.
3. Integration monitor showing source systems, last run, status, duration, records processed, failed records, and retry action.
4. DQM page with scorecards, rule results, severity filters, and remediation state.
5. Governance catalog with domains, data assets, owner/steward, classification, retention metadata, and quality rules.
6. Operations pages for meters and readings, billing records, facilities and production readings, water-quality results, work orders, and complaints.
7. NRW analysis page with DMA-level drill-down from summary to underlying records.
8. Audit log page with filters and detail view.
9. Reports page with export actions.

Use shadcn/ui components as the default UI system, including Card, Button, Input, Label, Select, Tabs, Table, Badge, Dialog, Sheet, DropdownMenu, Alert, Skeleton, Progress, Calendar/DatePicker, Tooltip, Breadcrumb, Sidebar, and Toast where appropriate. Use Tailwind CSS for layout and styling, and keep component customization in the project rather than introducing an unrelated UI framework.

Initialize and configure shadcn/ui according to the repository's current Next.js setup. Establish design tokens for light/dark themes, semantic colors for success/warning/error/info, spacing, borders, typography, and data-density appropriate for an operations dashboard. Keep visual styling consistent across the dashboard and avoid one-off inline styles.

Use loading, empty, error, and permission-denied states with shadcn/ui Skeleton, Alert, and related components. Make tables filterable and paginated. Use Badge and text/icon labels together; do not rely solely on color to communicate severity or status (especially for water-quality compliance). Use accessible labels, keyboard-friendly controls, visible focus states, sensible contrast, responsive layouts, and mobile-friendly navigation through the shadcn/ui Sidebar or Sheet patterns.

### Anti-AI-slop quality bar

The product must look and feel like a deliberate, human-designed operations platform, not a generic AI-generated dashboard. Do not use excessive gradients, decorative blobs, random glassmorphism, oversized hero sections, fake metrics, meaningless charts, emoji as UI, boilerplate copy, repetitive cards, or default-looking layouts assembled without hierarchy. Do not fill empty space with visual noise. Use realistic labels, meaningful units (m³, L/s, bar, NTU, mg/L), clear date ranges and billing periods, useful empty states, and domain-specific terminology.

Prioritize information hierarchy and decision-making: show the most important operational signal first (for example, compliance breaches and active leaks), group related controls, make table columns purposeful, use charts only when they answer a clear question, and provide drill-down paths from summary metrics to underlying records. Use restrained color, consistent spacing, intentional typography, and a compact but readable data density suitable for administrative users. Avoid placeholder text such as "Lorem ipsum," "John Doe," "Test User," or unexplained "+24%" metrics in the finished UI.

Before completion, review every screen for visual consistency, awkward copy, dead buttons, broken states, duplicated UI, fake functionality, unnecessary borders, alignment issues, overflow, and mobile behavior. Replace scaffolding with working interactions or clearly label unavailable functionality. Keep code maintainable: use reusable components and domain modules, but do not over-abstract simple UI or generate needless files and wrappers.

## 10. Security and system-administration requirements

Act as a system administrator as well as an application engineer:

- Inspect the repository before changing files.
- Document required runtimes, package-manager commands, ports, services, and environment variables.
- Add `.env.example`; never commit secrets.
- Use secure HTTP headers, CORS allowlists, request-size limits, rate limiting on authentication and ingestion endpoints, and centralized error handling.
- Hash passwords with a suitable password-hashing algorithm; never log credentials or tokens.
- Enforce authorization on the backend, not only in the UI.
- Add audit events for authentication, imports, retries, DQM execution, governance changes, exports, water-quality result corrections, and destructive actions.
- Make destructive operations explicit and protected; prefer soft deletion or archival for governed data. Lab results and billing records must never be hard-deleted through the API.
- Use parameterized queries through Prisma and validate all external input.
- Add database migrations and a deterministic seed script.
- Add health/readiness checks that verify database connectivity without exposing secrets.
- Add structured logs with correlation/request IDs and safe error messages.
- Provide backup/restore documentation for PostgreSQL/Neon and explain migration rollback considerations.
- Document production deployment assumptions, including Neon connection pooling, SSL, migrations, and environment separation.
- Add a basic incident/runbook document covering failed imports, bad migrations, database connectivity, leaked credentials, and rollback.

## 11. Delivery phases

### Phase 0: Reconnaissance

Inspect the repository, identify the current framework, package manager, database setup, conventions, existing tests, and deployment configuration. Do not overwrite working code without understanding it. Produce a short implementation plan before major edits.

### Phase 1: Foundation

Set up or normalize TypeScript, linting, formatting, environment validation, Prisma schema, PostgreSQL/Neon configuration, migrations, seed data, Express bootstrap, Next.js shell, error handling, logging, and health checks.

### Phase 2: Identity and governance

Implement users, roles, permissions, data domains, data assets, ownership/stewardship, classification, audit events, and protected routes.

### Phase 3: Integration framework

Implement source-system registry, import jobs, raw import records, canonical transforms, idempotency, integration-run tracking, failed-record storage, retries, and CSV/mock REST adapters.

### Phase 4: DQM

Implement rule metadata, DQ execution, results, severity, quality scoring, freshness checks, duplicate checks, validation checks, and remediation workflow.

### Phase 5: Operations and analytics

Implement operational entities, list/detail APIs, NRW and compliance aggregates, dashboard queries, filters, exports, and the main Next.js pages.

### Phase 6: Hardening

Add tests, authorization tests, migration/seed verification, API documentation, Docker workflow, CI checks, security review, performance indexes, runbooks, and final acceptance verification.

## 12. Testing and acceptance criteria

The implementation is complete only when:

- A new developer can run the project from documented setup instructions.
- Local PostgreSQL starts through the documented method.
- Prisma migrations apply cleanly to an empty database.
- Seed data creates multiple source systems, users/roles, DMAs, meters, readings, billing records, lab results, work orders, complaints, integration runs, DQ rules/results, governance assets, and audit events.
- A CSV import (for example, a meter-reading file) is idempotent and does not create duplicates on replay.
- Invalid records are rejected or quarantined with understandable error details.
- At least one import can be retried without rerunning successful records.
- DQM rules produce persisted results and visible scorecards.
- NRW per DMA is computed from API data and can be traced to the underlying production and billing records.
- Backend authorization prevents a user from accessing a protected operation without permission (for example, a plant operator cannot read restricted billing data).
- Audit events are created for the required administrative actions.
- Dashboard values come from API endpoints and not hard-coded frontend fixtures.
- API errors follow one documented shape.
- Unit and integration tests pass.
- Lint, typecheck, build, and migration checks pass.
- No secrets or real personal data are committed.
- The README explains architecture, source-to-output mapping, governance approach, DQM rules, local setup, Neon setup, deployment, and incident recovery.

## 13. Definition of done for Codex

Before declaring success, run and report:

```bash
# use the repository's actual package manager
install command
lint command
typecheck command
test command
build command
prisma migration/status command
seed command
```

Replace placeholders with the actual commands discovered in the repository. Report changed files, migration status, test results, known limitations, and the next recommended production-hardening steps.

---

# Copy/paste prompt for Codex

You are the senior system administrator, solution architect, backend/frontend engineer, data-governance lead, and DQM/integration engineer for this project.

Build or extend this repository into a production-minded MVP called **Water Utility Data Hub**. First inspect the repository and its conventions. Do not assume the repository is empty, and do not replace existing working infrastructure without explaining why. If there is an existing app, preserve compatible patterns and integrate into them.

The system must use Next.js + TypeScript for the frontend, shadcn/ui with Tailwind CSS for styling and UI components, Express.js + TypeScript for the backend, Prisma as ORM, and PostgreSQL as the database. PostgreSQL must work locally through Docker Compose and be deployable to Neon. Use a modular monolith with explicit boundaries; do not introduce microservices, Kafka, Kubernetes, a time-series database, or a separate warehouse in the MVP unless the repository already depends on them.

The finished product must not look like AI slop or a generic generated admin template. Follow the anti-AI-slop quality bar in this document: use a deliberate information hierarchy, domain-specific copy, restrained visual design, meaningful metrics, purposeful charts, realistic data, working interactions, and polished loading/empty/error states. Avoid gradients used as decoration, glassmorphism, oversized hero sections, emoji UI, fake statistics, repetitive cards, boilerplate labels, placeholder copy, and visual noise. Before declaring completion, manually review every screen for hierarchy, spacing, alignment, responsive behavior, accessibility, dead controls, fake functionality, duplicated components, and awkward wording.

The reference activity is: map **data sources → integration methods → governance → outputs**. Use water utility operations (production, distribution, metering, billing, water quality, leak response, and customer service) as the industry instead of healthcare, banking, retail, manufacturing, education, or waste management.

Implement the following source systems: customer billing, metering/AMR, production and distribution (SCADA-style), water-quality laboratory, work orders/field operations, customer service channel, and asset registry. Use CSV batch imports and mock REST adapters first. Design for future CDC using source IDs, source timestamps, idempotency keys, and integration cursors. Normalize all source data into a typed canonical model in PostgreSQL, including the link between customer accounts, service connections, meters, and district metered areas.

Implement data governance: source-system registry, data domains, data assets, owners/stewards, classification, retention metadata, role-based access control, least privilege, tenant/organization boundaries if appropriate, backend authorization, and immutable audit events. Customer identity and billing data are restricted; support configurable masking. Use synthetic data only. Never commit secrets or real customer PII.

Implement DQM as a reusable rule framework. Include completeness, timestamp/timezone, non-negative volume, reference validity, duplicate source record, meter/account identifier conflict, referential integrity, meter-reading sequence consistency, billed-volume consistency, estimated-read ratio, water-quality range and unit validity, water-quality limit breach with corrective-action tracking, work-order and complaint status transitions, source freshness, configurable outlier thresholds, and governance classification completeness rules. Persist DQ runs/results, severity, samples, remediation status, and transparent quality scores.

Implement APIs for authentication, health/readiness, operational entities, integration imports/runs/errors/retries, DQ rules/runs/scorecards, governance catalog, audit events, and reports (operations, NRW, water quality). Use validation at the API boundary, consistent error responses, pagination/filtering/sorting, authorization, and OpenAPI documentation.

Implement a usable Next.js dashboard with shadcn/ui and Tailwind CSS. Use shadcn/ui primitives and patterns for login, role-aware navigation, operations overview, NRW analysis with DMA drill-down, integration monitor, DQM scorecards, governance catalog, operational tables/details, audit log, reports, loading/error/empty/permission states, accessible controls, and CSV export. Define a consistent theme and responsive layout; do not mix in another component library unless the repository already requires it. Make every metric, chart, table, label, and action domain-specific and useful; do not ship generic placeholders, fake metrics, dead buttons, or decorative UI that does not support an operational task.

Act as a system administrator: document prerequisites, package-manager commands, ports, services, environment variables, local PostgreSQL, Neon SSL/connection pooling, migrations, seed, deployment, backups/restores, failed-import recovery, migration rollback, credential incident response, and database connectivity troubleshooting. Add `.env.example`, secure headers, CORS allowlist, request limits, rate limiting on auth/ingestion, safe structured logs, request correlation IDs, centralized errors, password hashing, and no token/secret logging.

Use the phased approach in the project plan: reconnaissance, foundation, identity/governance, integration framework, DQM, operations/analytics, and hardening. After each substantial phase, run relevant checks. Add deterministic seed data and tests for migrations, imports, idempotency, invalid-record quarantine, retry behavior, DQM results, NRW calculation, authorization, audit events, API error shape, lint, typecheck, tests, and production build.

Before making major changes, provide a concise implementation plan based on the actual repository. Then implement the work. Before finalizing, perform an anti-AI-slop UI and code review: remove generic or decorative patterns, placeholder copy, fake metrics, dead controls, duplicated components, unnecessary abstractions, and unfinished states; verify hierarchy, spacing, alignment, responsive behavior, accessibility, and meaningful domain-specific interactions on every screen. At the end, run the repository's real install/lint/typecheck/test/build/migration/seed commands, report exact results, list changed files, identify known limitations, and do not claim completion if a check fails.