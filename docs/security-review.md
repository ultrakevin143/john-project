# Demo-credential and authorization review

Date: 27 October 2026, Asia/Manila. Scope: John project's eight demo identities, their API authorization, session behavior, privacy boundaries and role-aware overview. This is a bounded code and local security-test review, not a certification that no vulnerability exists.

## Environment and credentials

The subsequent Cebu extension increased the local security suite to **46 checks**, all passed, adding reference-domain isolation and denied/forged/cross-site tariff-write cases. The integration suite now has 39 checks and the unit suite 13. These tests remain loopback-only. The separately authorized Neon cleanup preserved all eight complete user records and their existing password hashes; it was maintenance, not a remote security test. See [the delivery verification](verification.md) and [Cebu guide](cebu-demo.md).

`npm run test:security` reads the existing demo password only from ignored `.local/local.env`, checks that it matches ignored `.local/development-access.md`, and recreates the eight existing email identities in a fresh loopback-only `water_hub_test` database. All pending migrations apply before tests. The test database and sessions are discarded afterward. The runtime `.env` is never used as a database target, and no test connects to Neon or changes its account passwords, roles or data.

The tested emails are admin, operator, steward, analyst, billing, plant, lab and field at `waterhub.demo`. No passwords, cookie values or password hashes are included in this report or the test output.

## Findings reproduced and fixed

| Finding                                       | Reproduction before the fix                                                                                                                                                                                                        | Final behavior                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview bypassed domain/report boundaries    | Specialist accounts denied access to lab/billing/report endpoints could still read cross-domain summaries and record details through `/overview`. The overview cache was keyed by organization/period, without a permission scope. | Unauthorized queries are skipped; inaccessible summaries become null, record arrays are restricted, and DMA balance fields are omitted. Cache keys include the current permission set. The UI handles unavailable sections and does not link unauthorized users to balance drill-downs. |
| Masked identities could be probed with search | A masked-account reader could submit a hidden customer name or full account number and infer matches from returned rows/counts.                                                                                                    | Masked searches accept only the four visible trailing account characters. Names/full numbers are rejected before the hidden-field query. Unmasked search requires both the configuration switch and `identity:reveal`.                                                                  |

The initial security run failed on these regressions. An additional initial expectation about NoSQL-style nested filter syntax was corrected: Express treats that unsupported syntax as inert, and the authorized administrator's organization scope remains intact. It was not counted as an authorization bypass. Direct invalid classification values are rejected.

## Expected role matrix

| Login prefix | Canonical domains                             | Additional access / changes                                                                                        |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| admin        | All seven domains                             | All implemented administrative permissions                                                                         |
| operator     | All seven domains                             | Source ingestion/retry; read DQM and governance; reports; no direct governance/DQM/lab/field administrative writes |
| steward      | All seven domains                             | Integration repair, DQM, governance and lab corrections; audit; no direct field lifecycle or archive permission    |
| analyst      | All seven domains                             | Read-only operations/integrations/DQM/governance/reports; no audit or mutation access                              |
| billing      | Billing and metering                          | NRW analysis and lineage; no laboratory records or system administration                                           |
| plant        | Production and assets                         | No billing/identity/laboratory records or NRW report                                                               |
| lab          | Water quality                                 | Laboratory reports and audited result corrections; no billing/identity access                                      |
| field        | Field operations, customer service and assets | Field/complaint lifecycle updates; masked customer aliases; no billing/NRW/lab data                                |

Integration operators and stewards are intentionally trusted to ingest canonical source records across domains, including newer laboratory versions, with an audit trail. Their ingestion permission is broader than direct operational-edit permissions; this is part of the written role contract. Raw quarantined source payloads are accessible to these trusted integration roles for correction. Specialist roles cannot access them.

Operations reports expose district-level service aggregates to roles with `reports:read`; they contain no customer names, addresses or individual billing records. Record-level domain restrictions remain separate. NRW's cross-source production/billing lineage is intentionally granted by `reports:nrw`.

## Checks exercised

Final local results: **44 security checks passed, 31 integration checks passed, and 10 unit checks passed — 85 total, zero failures.** Lint, TypeScript and the API/Next.js production build also passed. The initial failing security log and final passing log are retained privately for comparison.

The security suite contains 44 checks (12 parent cases and 32 role subcases): all eight sign-ins; all thirteen canonical list/detail access paths; independent integration/governance/DQM/audit/CSV gates; direct mutation attempts with forged administrator headers; both privileged-first and specialist overview responses; hidden identity search; foreign district IDs, forged tenant headers, read and write IDOR attempts; invented/JSON/JWT-shaped cookies; anonymous access; inactive accounts, expired sessions and revoked grants; login/refresh/logout cookie invalidation; HttpOnly/SameSite attributes; authentication throttling with changing client-identity headers; cross-site requests; method overrides; UUID/query validation and literal SQL-injection-shaped searches.

Successful authorized mutations remain covered by the separate 31-check integration suite. The unit suite contains 10 checks. Browser automation is disabled, so direct browser-address-bar behavior was not freshly exercised; the API calls target the backend gates that remain authoritative even when navigation is bypassed.

## Remaining credential limitation

All eight demonstration accounts currently share one password. Someone who knows it can sign in to another demo role by entering that role's email. That is successful authentication with a reused secret, rather than a forged-session exploit, but it defeats separation if accounts are distributed to different people. Existing credentials were deliberately preserved during this requested review. Use distinct per-user credentials or approved SSO before sharing role accounts with separate users; the current setup remains a private synthetic demonstration.

No schema migration or Neon data change is required for the two code fixes. The application was rebuilt and restarted with the new code. Saved local evidence is under ignored `.local/security-initial.txt`, `.local/security-final.txt`, `.local/integration-security-review.txt` and `.local/security-summary.json`; these contain test names/statuses, not passwords. Prior demo walkthrough evidence remains historical rather than a new security certification.
