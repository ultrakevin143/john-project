[Project map: frontend, backend and request flow](docs/project-map.md)

[Latest PowerPoint alignment review, flowchart and verification](docs/integration-pptx-review.md)

# Water Utility Data Hub — John project

An independent water-utility EDM application at `C:/Users/Hp/Desktop/john project`. Next.js/TypeScript, Tailwind and locally maintained shadcn-style Radix primitives, Express, Prisma and PostgreSQL. A modular monolith with typed canonical water records, seven integration sources, twenty-one DQM rules, domain-scoped roles and an immutable audit trail.

The overview leads with water-quality breaches and leaks. The distinct network-atlas design uses horizontal navigation, an ink-blue operational band and selectable DMAs. All dashboard values come from the API. The Cebu adaptation uses selected Cebu City barangays, Manila reporting periods, sourced PNSDW reference limits and explicitly illustrative PHP tariffs. See [the Cebu demo guide](docs/cebu-demo.md) for the walkthrough and reference scope. Synthetic results do not certify water safety.

## Run locally

Prerequisites: Node.js 22.12+ and npm. Run commands from this folder, not the parent application. PostgreSQL 17 works through Compose; the fallback embedded distribution installed by npm uses PostgreSQL 18. Do not run both database methods on the same port.

```powershell
npm ci
npm run setup:local
npm run db:generate
npm run db:local
```

Keep that database terminal open. In another terminal, from this folder:

```powershell
npm run db:migrate
npm run db:seed
npm run db:status
npm run dev
```

Before initial Neon provisioning, these commands use the generated local `.env`. On this delivered workstation `.env` is the authorized Neon runtime configuration, and `.local/local.env` preserves the local database. To run local database commands after that switch:

```powershell
$env:WATER_HUB_ENV_FILE='.local/local.env'
npm run db:local
# In a second terminal, set the same selector before local migrate/status/seed.
npm run dev:local
```

For Docker, use `docker compose --env-file .local/local.env up -d` on this configured workstation. Fresh installations can use `docker compose up -d` after setup. Compose data uses the independent `john-water-hub` project volume.

| Service                           | Address                          |
| --------------------------------- | -------------------------------- |
| Application runtime               | http://localhost:3200            |
| Express runtime                   | http://127.0.0.1:4200            |
| Independent local demo            | http://localhost:3300            |
| Local demo API                    | http://127.0.0.1:4300            |
| Local PostgreSQL                  | 127.0.0.1:54339 / water_hub      |
| Disposable integration PostgreSQL | 127.0.0.1:54340 / water_hub_test |

`npm run demo:local` starts the separate demo from `.local/local.env`, with an isolated `.next-demo` output. `npm run demo:verify` performs a finite twenty-two-checkpoint HTTP walkthrough there and saves ignored evidence under `.local/demo-evidence`. It first confirms the API reports a local database scope. It never loads the runtime Neon environment.

## Demo accounts

The configured Neon workspace keeps tables, accounts, reference configuration and audit history, with its operational/import/DQM-output tables intentionally empty. Populated Cebu records are available only in the local demo. `npm run cebu:local` privately backs up and refreshes that local demo while preserving accounts; remote hosts are refused. See [the Cebu guide](docs/cebu-demo.md) before refreshing.

Easy-to-remember role emails:

- `admin@waterhub.demo` — administrator
- `operator@waterhub.demo` — integration operator
- `steward@waterhub.demo` — data steward
- `analyst@waterhub.demo` — district analyst, read only
- `billing@waterhub.demo` — billing and metering
- `plant@waterhub.demo` — production and asset registry
- `lab@waterhub.demo` — laboratory results and audited corrections
- `field@waterhub.demo` — field response and customer complaints

The generated password is in ignored `.local/development-access.md`, which opens in Notepad. Synthetic addresses are login identifiers, not real mailboxes. The same hashes are copied only during the authorized initial Neon provisioning; session tokens are excluded. Passwords never belong in committed documentation.

## Data sources → integration → governance → outputs

| Source                    | Methods and canonical records                          | Governance                                                  | Outputs                                    |
| ------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------ |
| Customer billing          | CSV/JSON; accounts and billing                         | Restricted identities and financial records; Billing owner  | Billed volume and NRW lineage              |
| Metering / AMR            | CSV/JSON; connections, meters, readings                | Metering owner; normalized serials and reading history      | Actual/estimated ratio, consumption checks |
| Production / distribution | Synthetic REST adapter or CSV; facilities and readings | Production owner; boundary-input flags                      | System input, pressure exceptions, NRW     |
| Laboratory                | CSV/JSON; points and typed parameter results           | Quality owner; entered-by, versions and audited corrections | Limit breaches and corrective-action trace |
| Field operations          | Synthetic REST adapter or CSV; work orders and leaks   | Field owner; legal status transitions                       | Dispatch, repairs and backlog              |
| Customer service          | Synthetic REST adapter or CSV; complaints              | Restricted identity fields; customer-service owner          | Categories and resolution time             |
| Asset registry            | Synthetic REST adapter or CSV; pipelines               | Asset owner and retention metadata                          | DMA-linked pipeline and leak context       |

Every source also supports an in-process synthetic snapshot for demonstration. These adapters exercise the pipeline without contacting external providers. Raw payloads are retained alongside typed canonical fields. Source timestamps, source versions, idempotency keys, cursors and source leases prepare the boundaries for future CDC; there is no running CDC broker or scheduler.

## DQM and water balance

Twenty-one active seeded rules cover completeness, UTC instants/Manila periods, quantities, reference values, source duplicates, identifier conflicts, meter lineage, register sequence, billing consistency, estimated ratio, lab range/units, corrective-action trace, work-order/complaint lifecycles, freshness, outliers, classification, Cebu location agreement, tariff amounts, sampling reminders and standards provenance. Metadata includes check identifiers, severity, descriptions, active flags and configuration.

Runs read a repeatable database snapshot, persist results and five offending sample IDs per rule, and score `100 × (1 − failed record-rule checks / total checks)`, rounded to two decimals. No observations returns zero, not a pass. Acknowledgement does not alter measurements; correct data and rerun to verify improvement. A rule may be enabled/disabled through an audited endpoint. Threshold editing is an administrative configuration task, not a dashboard control in this MVP.

NRW is a simplified `100 × (system input − billed volume) / system input` calculation. It includes unbilled authorized consumption, so it must not be described as measured leakage. Only boundary observations marked `isSystemInput` count, and only complete intervals contained within the requested reporting window are included. Internal transfer readings are excluded. Zero input is unavailable; negative balances carry a warning. DMA drill-down exposes exact contributing records. See the [API contracts](docs/api.md).

The local seed deliberately includes quality issues: an unlinked chlorine breach, a billing mismatch, elevated estimated-read share, low pressure/high consumption and a stale registry source. These make investigation workflows demonstrable. Four method-specific PNSDW 2017 references are configured; current applicability, laboratory accreditation and the approved sampling plan require review before real use. Sampling reminders and tariffs remain illustrative.

## Security and governance

Scrypt password hashes; hashed opaque server-side sessions; manual rotation and logout; HttpOnly/SameSite Strict cookies, Secure under production HTTPS; origin allowlist and cross-site mutation blocking; 2 MB request cap; authentication/import rate limits; parameterized Prisma operations; safe structured logs and correlation IDs. Organization filters are reinforced by composite database foreign keys. Audit events reject update, deletion and truncation. Billing and lab records cannot be hard-deleted; governed corrections retain history.

Role permissions include operational domains. A plant operator cannot read billing or customer accounts. Identity masking is on by default. Revealing identities requires both `MASK_CUSTOMER_IDENTITIES=false` and explicit `identity:reveal` permission. Catalog edits enforce restricted classification and optimistic versions. Retention is policy metadata; automatic erasure/anonymization is not implemented.

Overview responses and their caches are permission-scoped, including summaries, DMA balance fields, attention records and source/DQM metadata. A hidden navigation item is never the authorization boundary. With identities masked, account search accepts only the four visible trailing account characters; hidden names/full numbers cannot be probed through result counts. The eight delivered demo identities share a demonstration password: anyone who knows that password can sign in using another demo role's email. Give real users distinct passwords or an approved identity provider before distributing access.

## Verification and deployment

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:security
npm run build
npm run db:validate
npm audit --omit=dev --audit-level=moderate
```

The integration runner ignores `.env`, creates an isolated local database, applies all three migrations and seeds it before testing. Custom `TEST_DATABASE_URL` must use loopback and the name `water_hub_test` or `water_hub_test_<suffix>`. Remote hosts are rejected. The test cluster is stopped and its verified local directory removed afterward.

The security suite uses the same eight demo emails and private password from `.local/local.env`, checks that it matches the private access file, and recreates those identities only in a disposable local test database. It never logs the password or changes runtime/Neon accounts. See [the credential and bypass review](docs/security-review.md) for reproduced findings, fixes, access matrix and remaining limits.

`npm start` runs the compiled Express API and Next application using runtime configuration. Neon requires SSL, a pooled application connection, a direct migration connection, a dedicated `water_hub` schema and a separate least-privileged application role in production. Remote seeding is blocked. Intentional migrations require `ALLOW_REMOTE_DATABASE=true` and `CONFIRM_REMOTE_WRITE=water-hub-migrations`. Do not repeat remote migration/status/demo operations without a concrete need. Never copy the parent application's credentials or schema.

See [verification evidence](docs/verification.md), [database safety and Neon setup](docs/database-safety.md), [API contracts](docs/api.md), and the [operations runbook](docs/runbook.md). The supplied [project plan](PROJECT_PLAN.md) remains the requirements reference; this README describes the implemented scope.

Production hardening still includes live provider adapters, durable jobs and crash recovery, organization-specific identity onboarding, SSO/MFA/password recovery, distributed throttling, formal accessibility/regulatory review, load/restore exercises and retention execution. This MVP does not claim certification or readiness for public deployment with demo accounts.

## School presentation features

Administrators can create accounts and edit roles/access under **Users**, with reasoned audit events, session revocation, stale-edit checks and lockout protection. No invitation email or password-recovery service is implied. **Data quality → View trends** compares real successful snapshots with weighted domain scores. **Operations → Open meter reliability** identifies missing, estimated and anomalous readings with source-record links and Manila periods. See [the presentation walkthrough](docs/school-presentation.md). These features use existing tables; no migration or remote seed is required.
