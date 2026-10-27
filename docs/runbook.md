# Operations runbook

## Service start

Run from John project. For the current workstation, `npm start` serves the built Neon-backed runtime on 3200/4200. `npm run demo:local` uses preserved local PostgreSQL and 3300/4300 instead. Do not use the parent application's commands or environment. Start local PostgreSQL first when using local preview. A healthy `/health` process does not prove SQL readiness; `/ready` checks SQL with a thirty-second cache.

## Failed import

Inspect the run and row-specific quarantine reason. Confirm the canonical dataset, matching organization references, units and timestamp offsets. Correct only failed rows and retry selected errors. An unchanged snapshot retains its replay key; changed content requires a new key. A changed canonical observation requires a newer source timestamp. Successful records are not reprocessed. A SOURCE_BUSY conflict means an active source lease; verify the worker is gone before allowing an expired lease to be replaced.

Do not restart a failed import against Neon in a loop. Reproduce malformed files locally using synthetic equivalents. A process crash can leave an incomplete RUNNING integration run. Inspect raw statuses and audit before any administrator recovery; durable job reconciliation is future work.

## Water-quality breach or bad data

Check the sampling point, parameter/unit, timestamp and configured limits. The supplied limits and records are synthetic, not a drinking-water decision system. Correct an erroneous laboratory value only with lab permission, a verified reason and its current version. The immutable audit retains before/after, actor and request. Link a water-quality corrective work order for a valid breach; linking it does not hide the breach. Run DQM after correcting data. Remediation notes never inflate the previous score.

## Stale or failed DQM

Review the last successful scorecard and the failure audit. An unknown executable check fails the run rather than silently passing. One RUNNING quality job blocks another for that district. After confirming no worker exists, an administrator can mark that abandoned run FAILED in a reviewed transaction and append a recovery audit event; never rewrite the audit history. Reproduce rule changes and run all tests locally before deploying.

## Database connectivity

Check the selected environment path and local/remote scope without printing URLs. For local use, confirm only this project's PostgreSQL listens on 54339 and the selected database is water_hub. For Neon, verify SSL, pooled versus direct host, pool limit, schema selection and role grants. Avoid repeated console/status requests during cold start. Correlate sanitized server errors using request IDs. Health and application data endpoints must not expose credentials.

## Migration failure and rollback

Stop dependent writes, retain the migration error privately and inspect pending/applied history once. Reproduce on a fresh local database first. Prefer a reviewed forward repair; use Prisma resolve only after confirming actual SQL state and backup coverage. Restore into a separate target for rollback; avoid destructive drops of shared databases/schemas. Keep the old deployable build until the new migration/app combination is verified.

## Credential incident

Treat a credential copied into chat as a secret that must stay out of committed files, logs and screenshots. If compromised, revoke/rotate through the provider's approved flow, update the protected runtime environment, invalidate affected sessions and restart the service. Review immutable access/change records and provider logs. Do not paste a replacement into source or incident documents. Replace demo identities and install the organization's identity/recovery controls before public production.

## Deployment assumptions

HTTPS terminates at the reverse proxy; production origin must be HTTPS. Express is bound privately, uses allowlisted origin, secure cookies and finite connection limits. Use an independent secret store, least-privileged runtime role, separate migrator role, restricted backup access and centralized rate limits/logging. The current CSP permits inline framework script/styles and development eval; nonce-based production tightening is future work. In-process rate limits and synchronous jobs assume a single API process. Define restore objectives, approved water-quality limits, data-retention execution and live-source credentials before live operation.
