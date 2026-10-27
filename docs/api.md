# API contracts

The Express API is exposed directly on 4200 and proxied under `/api` by Next.js. `/docs` links to `/openapi.json` (OpenAPI 3.1), which includes input schemas for every canonical entity. All operations use the same HttpOnly `water_session` cookie. No bearer token or password is returned by authentication.

Errors: `{ "error": { "code": "VALIDATION_FAILED", "message": "...", "requestId": "...", "details": [{"field":"...","message":"..."}] } }`. Details are present only where applicable. Success: `{data: ...}`. Collections add `pagination: {page,pageSize,total,pages}`. Defaults: page 1, page size 10, maximum 100. Search is submitted explicitly; `sort=asc|desc` controls stable chronological ordering (catalog sorts names).

For masked customer accounts, `search` accepts exactly the four visible trailing alphanumeric characters of the account number. Hidden names and full identifiers return `422 MASKED_ACCOUNT_SEARCH` without querying those hidden values. Full name/number search is available only when identity masking is off and the reader has `identity:reveal` permission.

## Access

`operations:read` is required for operations and overview. Each dataset additionally requires its `domain:<name>` permission. Global integration, quality, governance and audit routes require their named permissions. Writes check their separate write permission. Report access requires `reports:read`; NRW additionally requires `reports:nrw`; lab reports require `domain:quality`. A caller cannot bypass authorization using an ID, DMA, source or query filter from another district.

Overview is also permission-scoped: unavailable `quality`, `nrw`, `activeLeaks`, `openComplaints` and `dq` summaries are null, attention/work-order/source arrays omit inaccessible records, and DMA objects omit balance fields unless the reader has `reports:nrw`. Cache keys include the current permission set as well as organization/period/generation. The frontend hides unavailable sections and prevents links to unauthorized balance drill-downs; server checks remain authoritative.

## Endpoints

| Endpoint                                 | Contract                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| GET /health                              | Process health, service and configured local/remote database scope; no SQL                                                           |
| GET /ready                               | SQL connectivity, cached 30 seconds                                                                                                  |
| POST /auth/login                         | `{email,password}`; normalized email, rotated opaque cookie; 20 attempts/15 minutes                                                  |
| GET /auth/me                             | Public current identity, role and permission codes                                                                                   |
| POST /auth/refresh                       | Revoke current session and create a new cookie                                                                                       |
| POST /auth/logout                        | Revoke current session; 204                                                                                                          |
| GET /overview                            | Latest operational snapshot, current lab/leak attention, default complete-month balance, persisted DQM score and seven source states |
| GET /operations/lookups                  | Role-filtered DMAs, parameters, meter/connection IDs, facilities, points and corrective work orders                                  |
| GET /reference                           | Cebu profile and demo areas; tariffs and parameter references are filtered by domain access                                          |
| POST /reference/tariffs                  | Governance-write and billing-domain permission; new illustrative tariff version, effective-date guard and immutable audit            |
| GET /operations/:entity                  | Pagination/search/sort; optional valid `status`, `dmaId`, `sourceSystemId`                                                           |
| GET /operations/:entity/:id              | Canonical detail and source lineage; masked identity fields                                                                          |
| PATCH /operations/water-quality/:id      | `{value,unit,correctiveActionId: uuid                                                                                                | null,version,reason}`; lab correction permission, parameter bounds/units, optimistic correction version; audit before/after |
| PATCH /operations/work-orders/:id/status | `{status,updatedAt,dispatchedAt?,completedAt?,reason}`; field write permission and legal transition                                  |
| PATCH /operations/complaints/:id/status  | `{status,updatedAt,resolvedAt?,reason}`; field write permission and legal transition                                                 |
| POST /operations/:entity/:id/archive     | `{reason}`; admin archive permission; lab and billing archival explicitly denied; no DELETE endpoints                                |
| GET /integrations/sources                | Registry, connections and most recent run                                                                                            |
| POST /integrations/imports               | See ingestion contract below; 10 starts/retries per minute                                                                           |
| GET /integrations/runs                   | Page/search by source name/status/sort                                                                                               |
| GET /integrations/runs/:id               | Counters and raw quarantined record details; restricted to trusted integration roles                                                 |
| GET /integrations/errors                 | Page and remediation-status filter                                                                                                   |
| POST /integrations/runs/:id/retry        | `{corrections?:[{errorId,payload}]}`; selected errors only, or all unresolved errors when empty                                      |
| GET /dq/rules                            | Twenty-one rule definitions, executable check IDs and configuration                                                                  |
| PATCH /dq/rules/:id                      | `{active,reason}`; audited enable/disable                                                                                            |
| POST /dq/runs                            | Empty object; one active run per organization, consistent snapshot                                                                   |
| GET /dq/runs                             | Paginated history                                                                                                                    |
| GET /dq/scorecards                       | Latest successful run, or `runId`; persisted rule results/samples/formula                                                            |
| PATCH /dq/results/:id                    | `{remediation: OPEN                                                                                                                  | ACKNOWLEDGED                                                                                                                | RESOLVED,note}`; notes do not change score |
| GET /governance/domains                  | Domain accountability and asset counts                                                                                               |
| GET /governance/assets                   | Page/search/sort, `domainId`, `classification`                                                                                       |
| PATCH /governance/assets/:id             | `{owner,steward,classification,retentionDays,policy,version,reason}`; restricted identity/billing assets cannot be downgraded        |
| GET /audit-events                        | Page/search (action or actor), `entity`, chronological sort; detail metadata is included                                             |
| GET /reports/operations                  | Period-scoped service counts, dispatch/repair/resolution means, complaint categories and priority backlog                            |
| GET /reports/nrw                         | Period-scoped DMA balances; `dmaId` adds input/billing lineage                                                                       |
| GET /reports/water-quality               | Lab measurements, parameter limits and corrective-work references                                                                    |

Dates use ISO 8601 with an explicit offset. Query report dates are `from=YYYY-MM-DD&to=YYYY-MM-DD`, at midnight Asia/Manila, end exclusive, ordered and at most 366 days. NRW/operations default to the last complete Manila calendar month. Lab reports default to the last seven days. `format=csv` exports are audited. Dispatch/repair/resolution means exclude unfinished records; zero observations are null rather than zero.

## Canonical ingestion

Accounts accept structured `city` and `barangay` fields. Missing values remain loadable for source repair but fail the Cebu-location DQM rule. The configured location list covers only four selected demo barangays. No customer geography is inferred from an address string.

Tariff version requests require `supersedesId`, unique uppercase `code`, `name`, `effectiveFrom` (Manila date), `baseVolumeM3`, `baseCharge`, `ratePerM3`, `blocks` and `reason`. Each bracket has an increasing cumulative `upToM3` and non-negative `rate`; only the final upper bound is null. Volumes support three decimals, base charges two, unit rates four. Decimal arithmetic rounds the final water charge half up to centavos. Prior billed intervals cannot be invalidated. Future account imports may reference the new tariff; historical bills keep their original class-compatible version. Complete billing intervals must fit the selected version; source systems split a period at a rate change.

Lab results use method-specific parameter units. Membrane-filtration coliform counts must be integers. The quality report returns `valid`, nullable `breach`, `invalid`, standard provenance and method. Invalid measurements are excluded from the within-limit percentage. Completion of a linked leak-repair work order resolves its active leaks in the same DMA and records `LEAK_RESOLVED` with the acting user.

Request: `{sourceSystemId, entity?, idempotencyKey, format:"csv"|"json"|"mock", csv?, records?}`. 1–500 rows, CSV payload at most 1 MB, whole request at most 2 MB. CSV header names must be unique canonical field names. Unknown canonical fields fail validation. Every record requires `sourceRecordId` and `sourceUpdatedAt`. Numeric fields accept finite numbers or non-empty numeric strings, not null, booleans or arrays. Boolean CSV fields accept `true`/`false` only.

The source registry owns allowed entities: BILL accounts/billing; AMR connections/meters/readings; SCADA facilities/production; LAB sampling points/results; FIELD work orders/leaks; CARE complaints; ASSET pipelines. Only the selected enabled adapter runs. Both CSV and canonical JSON use the csv/batch adapter; mock uses its independent mock switch.

CSV example for a new work order (replace the DMA placeholder with a local lookup ID):

```csv
sourceRecordId,sourceUpdatedAt,reference,title,dmaId,category,priority,status,assignee,reportedAt
DEMO-WO-NEW,2026-10-26T10:00:00Z,DEMO-WO-NEW,Inspect a synthetic leak,DMA_UUID,LEAK_REPAIR,WARNING,OPEN,Demonstration crew,2026-10-26T09:00:00Z
```

Canonical schemas in `/openapi.json` specify every field. Accounts and billing link to tariffs; meters link to connections; readings link to the meter's actual connection; billing must match its account/connection/DMA and reading period; production DMA must match the facility. Same natural identifier cannot be duplicated across source IDs in one district. Equal unchanged canonical observations are skipped. Changed observations require a newer source timestamp; more than five minutes in the future is quarantined.

Idempotency is scoped by organization/source/key. Same snapshot replays the original run, changed content with the same key returns 409. Each raw row and error is retained. Duplicate source IDs within a batch are quarantined. Corrected retries cannot overwrite a successful row using the same source ID in that run. A source lease prevents overlapping imports. Successful records are never re-extracted by retry. Newer lab versions record the actual importing actor and request ID in the correction audit.

Lab limits are operational flags: physically plausible breaches may load and become visible for response. Invalid units or physically impossible ranges quarantine. A breach's missing corrective action fails WQ-012. Linking an action does not remove the operational breach. Work-order and complaint transition graphs reject shortcuts and require completion/resolution timestamps.

## Observability and limits

`X-Request-ID` is generated or accepts a constrained supplied ID. Responses are `no-store`. Request logs include method/path/status/duration, not cookies, payloads, credentials or database URLs. `/ready` errors are sanitized. Overview caching lasts 15 seconds and invalidates after successful writes. No polling, focus/reconnect refresh or automatic error retry is enabled.

Imports and DQM execute within the request in this MVP; source leases are ten minutes. A crashed DQM process may require an administrator to mark a stale RUNNING record failed after confirming no worker remains. No real provider scheduler, external REST connector, CDC broker or background retention worker is deployed.

## School presentation additions

`GET /users` uses page/pageSize/search and returns only safe profile/role fields; `GET /users/roles` lists roles within the organization. Both require the authenticated database role code `admin`, as do writes. `POST /users` requires name (2–100), email, password (12–128), roleId and reason (8–500); it creates an active account and records USER_CREATED without password data. No email is sent. `PATCH /users/:id` requires name, roleId, active, updatedAt (ISO timestamp) and reason. Cross-organization targets/roles, stale updates, self-lockout and removal of the last active administrator are rejected. Role/access changes revoke sessions. Account records and audit are retained.

`GET /insights/quality-trends?limit=12` requires dq:read. Limit is 2–30; returns chronological successful snapshots, weighted latest-domain scores and changes against the preceding successful snapshot. No observations yields a null trend score. Rule/coverage changes can affect comparability.

`GET /insights/meter-reliability` requires reports:read plus domain:metering; accepts from/to (Manila dates, end exclusive, maximum 366 days), optional dmaId and page/pageSize/search. Returns period/DMA summary, permitted DMA options, coverage definition, configured consumption threshold and paginated meter rows with reading findings. Search affects table rows only. No customer identity is returned. See school-presentation.md for eligibility and the demonstration sequence.
