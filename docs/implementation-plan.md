# Implementation plan

This independent Desktop npm workspace reuses the reviewed authentication, request-safety, import orchestration and accessible primitive foundations originally developed for Waste Hub. Domain models, seed data, DQM, reports and screen layouts are implemented for water operations. The projects have separate environments, generated Prisma clients, data and visual tokens.

1. Foundation: independent packages, local ports 3200/4200/54339, migration, deterministic synthetic seed and secure sessions.
2. Governance: role and domain permissions, restricted-data masking, tenant checks, immutable audit, optimistic catalog edits.
3. Integration: seven sources, CSV/JSON and synthetic mock REST adapters, canonical validation, idempotency, quarantine and failed-record retry.
4. Quality: twenty-one reusable checks, consistent snapshot, persisted scores, readable samples and remediation.
5. Operations: water-quality/leak overview, DMA NRW lineage, canonical tables/details, lab correction workflow, governance, audit and reports.
6. Acceptance: unit/integration/API/security tests against disposable local PostgreSQL, local HTTP demo, lint/typecheck/build, UI inspection where browser settings permit.

Neon deployment is documented but this new project never connects to it during implementation or tests. Mock REST adapters run in process; real CDC, provider scheduling and production identity integration remain future work.
