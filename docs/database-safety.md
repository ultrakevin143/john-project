# Database isolation and Neon

The parent Waste Hub and this Water Hub never share environment files or application schemas. Water Hub runtime uses the user-authorized Neon project in schema `water_hub`. Local PostgreSQL is `water_hub` on 54339; the disposable test database is `water_hub_test` on 54340.

`.env`, `.local/local.env`, `.local/development-access.md` and demo evidence are ignored. Do not print them or add them to version control. The first contains runtime configuration; the second is the preserved local configuration. Set `WATER_HUB_ENV_FILE=.local/local.env` for local database administration. `dev:local` and `demo:local` explicitly load that local file and force remote access off. The integration runner never loads `.env` and rejects non-loopback/non-test database URLs, even if `ALLOW_REMOTE_DATABASE=true` is inherited.

For initial Neon setup, use the pooled connection for the app and a direct hostname for migrations, `sslmode=require`, the dedicated schema and a conservative `connection_limit=5`. Keep channel binding when supplied. Use a least-privileged runtime role for a real deployment; the user-supplied owner role is only suitable for setup/private demonstration.

The first metadata inspection must confirm the dedicated application schema is absent or empty. Apply pending migrations once, with explicit remote migration confirmation. Initial synthetic provisioning copies a verified local snapshot in a single transaction, refuses any nonempty application target and excludes sessions/locks. It preserves all other database schemas. Routine remote seed is deliberately blocked. Future migrations are run only when the schema actually changes; do not repeatedly invoke remote migration, status, seed or demos as connectivity tests.

In Neon Console's Tables screen, choose schema **water_hub**. The **public** schema can remain empty while the application has all its tables.

## Migrations

1. `202610260001_water_foundation`: identity/governance/integration/DQM and typed water models.
2. `202610260002_governed_integrity`: composite organization/reference foreign keys, water/billing constraints, restricted-policy constraints, immutable audit and retained-record deletion guards.

Some composite integrity constraints are expressed in SQL because several independent relationships share the same organization field. Keep them in migration history; do not replace migration deployment with `prisma db push`. Prisma validation/generation does not contact a database. A rollback is not automatic: restore a reviewed backup into a separate database or ship a corrective forward migration. Never drop an application schema to retry a failed deployment.

## Backup and restore

Before a production migration, create an approved Neon branch/restore point or take a PostgreSQL custom-format dump using the direct SSL connection. Supply credentials through protected environment/secret tooling, never command arguments or repository files. Include `water_hub` schema, roles/grants and migration history; establish retention and encryption. For local development, `pg_dump -Fc --schema=public --file=water-hub.dump` uses the protected `PG*` environment for this project's database.

Restore with `pg_restore` into a new isolated database, apply reviewed grants and verify migration history, canonical counts, sample balances and audit continuity there. Do not use `--clean` against a shared Neon database. A restore drill, measured recovery objectives and access-controlled backups are production acceptance work; this implementation does not claim they were exercised.
