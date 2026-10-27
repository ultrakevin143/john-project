# Delivery verification — John project

For the latest checks against the supplied PowerPoint, see the [integration review](integration-pptx-review.md). The delivery and browser sessions below are historical; current rule/test counts and the current browser-access limitation are recorded in that review.

Verification dates: 26–27 October 2026, Asia/Manila. All automated tests and workflow demonstrations used independent local PostgreSQL. No automated test, fixture seed or demo targeted Neon.

## Browser retest — 27 October 2026

Browser access became available. The stopped persistent local PostgreSQL and demo were restarted at 54339 and 3300/4300 without migration, reseeding or resetting existing demo records. All browser interactions below used this local demo; Neon and the parent project were untouched.

- Overview loaded its Cebu network, breach/leak queue and data-trust summary.
- One browser-triggered DQM run succeeded: 21 rules, 1,011 observations, 992 passed and 19 findings (98.12%). Findings are synthetic data issues, not test failures or a regulatory rating. WQ-012 displayed a plain-language finding and labelled chlorine result/reference values.
- The browser found a real defect: selecting an affected-record link could open the operations list without its selected-record dialog. Operations now receives the record query from Next's reactive search parameters and remounts when the selected record changes. Both client-side navigation from the DQM finding and a direct reload opened LAB-101 correctly after the fix. The search-parameter reader has a Suspense boundary for static builds.
- Cebu reference locations, sourced parameter methods/limits and illustrative peso tariffs rendered. Governance pagination showed billing, accounts and complaints classified Restricted with owners, stewards and retention values.
- A keyboard-committed Manila reporting period (2 October to 2 November, exclusive) refreshed the displayed counts and export URL. CSV download completed. Browser fill alone did not commit native date changes to React; keyboard date changes did, so this is not recorded as an application defect.
- Sign-out returned to login; one incorrect password was rejected; existing operator and administrator credentials succeeded. The operator lacked the Audit link and direct Audit navigation showed the access-denied page; administrator sign-in restored the Audit trail. Login/logout, failed-login, DQM and export events were visible there. This bounded UI check does not replace the earlier local API security suite or establish that all bypasses are impossible.
- Compact login had no document scrolling at 1280×720 or 390×844. The mobile overview had no horizontal document overflow, and its navigation sheet opened/closed. Temporary viewport overrides were reset.
- Lint, API/web/tools TypeScript and the full API/Next production build passed after the routing fix. No backend code/schema changed, so the already-passing unit, integration and security suites were not repeated in this browser pass. No browser console errors or warnings were observed at the final check.

Fresh screenshots and the run summary are in ignored `.local/browser-retest-2026-10-27`. This supersedes the browser-access blocker described in the historical Cebu delivery table below. Coverage is limited to these observed flows; no checkout/payment feature was present or tested, and no new independent visual-review approval or formal accessibility certification is claimed. The local demo remains running with its existing synthetic records and the added quality/auth/export audit events.

## Cebu adaptation — 27 October 2026

| Check                                | Result                                                                                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit checks                          | 13 passed, including Manila month/year rollover, progressive tariffs, fractional-volume boundaries and centavo rounding                                                                                          |
| Isolated local integration checks    | 39 passed: 18 workflows plus 21 individual DQM checks                                                                                                                                                            |
| Credential/security checks           | 46 passed locally, including domain-filtered reference data and denied tariff writes                                                                                                                             |
| Local HTTP walkthrough               | All 22 checkpoints passed; laboratory quarantine/retry, audited correction, completed leak repair, reporting and all eight sign-ins                                                                              |
| Lint, API/web/tools TypeScript       | Passed                                                                                                                                                                                                           |
| Production build                     | API and Next.js production build passed                                                                                                                                                                          |
| Schema and persistent local database | Prisma validation passed; all three migrations current; backed-up Cebu refresh and local seed passed                                                                                                             |
| Static design detector               | One pass, zero primary findings; 62 advisories in the existing CSS/design documentation were retained for review                                                                                                 |
| Source finish review                 | Laboratory and tariff precision findings resolved; existing network-atlas design and compact login preserved                                                                                                     |
| Browser verification                 | Unavailable: browser automation is disabled in Work settings. Prior screenshots are stale; the finish review remains `recapture` for visual evidence. No rendered-layout/overflow/interaction signoff is claimed |

Total automated test cases reported by the runners: **98 passed, zero failures**, plus the **22-checkpoint local walkthrough**. The unit and integration suites were repeated only after relevant precision/validation changes; no remote testing was performed. The local demo was refreshed afterward so manual testing starts with the original synthetic breaches and active leaks. Generated CSV examples and Notepad instructions are under ignored `.local/demo-samples`.

The single new migration, `202610270001_cebu_configuration`, was deployed once to the authorized `water_hub` Neon schema. Then the approved maintenance transaction removed **284 operational/import/DQM-output rows** across **19 tables**, verified all nineteen were empty and preserved **eight complete user records**, sessions, reference configuration, source registrations, governance and audit. All **four historical guards** were enabled before commit. A private operational backup and a cleanup audit event were created. There was no Neon demo seed and no parent Waste Hub change.

Safe evidence is stored in ignored `.local/cebu-unit.txt`, `.local/cebu-integration.txt`, `.local/cebu-security.txt`, `.local/cebu-lint.txt`, `.local/cebu-typecheck.txt`, `.local/cebu-build.txt`, `.local/demo-evidence/results.json`, and `.local/cebu-maintenance/neon-result.json`. Passwords, hashes and cookies are excluded from these summaries. See [the Cebu demo guide](cebu-demo.md) for the reference sources, manual steps and prototype limitations.

The table below records the earlier foundation delivery, before the Cebu extension.

| Check                                         | Result                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `npm install --no-fund`                       | Passed; independent lockfile, 595 installed packages, zero reported vulnerabilities                                            |
| `npm run db:generate`                         | Passed, Prisma 6.19.3 client generated only inside John project                                                                |
| `npm run db:validate`                         | Passed; no database query                                                                                                      |
| `npm run lint`                                | Passed after replacing the login brand anchor with Next Link                                                                   |
| `npm run typecheck`                           | Passed for API, web and tools                                                                                                  |
| `npm test`                                    | 10 passed                                                                                                                      |
| `npm run test:integration`                    | 31 passed: 14 top-level workflows plus 17 individual DQM checks                                                                |
| `npm run build`                               | Passed; API compiled and Next.js production build completed                                                                    |
| Local migration/seed/status                   | Both migrations applied cleanly to empty local databases; deterministic synthetic seed passed; local migration history current |
| `npm audit --omit=dev --audit-level=moderate` | Zero vulnerabilities                                                                                                           |
| `npm run demo:verify`                         | All 18 checkpoints passed on web 3300/API 4300, with a local database scope safety gate                                        |
| Secret isolation                              | Runtime/local/access files ignored by Git; no provider password pattern found in non-ignored source                            |

The latest integration run executed after runtime `.env` contained Neon configuration and still selected `127.0.0.1:54340/water_hub_test`. This verifies that remote runtime authorization does not redirect the test suite. Test data was torn down after completion.

## Behavioral evidence

The tests cover CSV success and quarantine, identical replay, changed-key content conflict, corrected selected retries, malformed/duplicate CSV headers, disabled adapters, unchanged synthetic snapshots, all seventeen rules on valid observations and targeted defects, persisted score arithmetic, acknowledgement without score inflation, boundary-input NRW reconciliation, role/domain denials, masked identities, laboratory correction reasons/versions/audits, actual import actor/request trace, stale governance edits, direct database tenant violations, immutable audit, retained lab deletion rejection, status transitions, origin/content-type/JSON errors, session rotation and logout.

The HTTP demonstration signed in all eight roles; loaded one valid and one invalid CSV row; replayed the same snapshot; corrected the failed row; persisted seventeen DQM results; acknowledged a finding without changing its score; reconciled a DMA to contributing input and billing rows; corrected a lab result and rejected a stale write; rejected plant billing access and analyst writes; confirmed masking; edited governance with a stale-version conflict; rejected a lifecycle shortcut; dispatched legally; exported CSV; checked audit actions and Next security headers; and revoked all eight demo sessions.

Ignored evidence: `.local/demo-evidence/results.json`, `.local/demo-evidence/nrw.csv`. This is a finite functional walkthrough, not a production load test. A later local browser DQM run verified the new readable sample presentation.

## Runtime Neon provisioning

The user explicitly supplied and authorized a separate John-project Neon connection during implementation. Credentials are stored only in ignored runtime configuration. One metadata inspection confirmed an empty dedicated target. Both migrations were applied once, then **486 synthetic rows in 31 application tables** were copied from a verified local snapshot in one transaction. No existing application data or other schemas were overwritten. Sessions and integration locks were excluded. Provisioning evidence is in ignored `.local/neon-provisioning.json`; routine remote seed remains blocked.

Use schema **water_hub** in Neon Console's Tables selector. An empty public schema is expected. App runtime is 3200/4200; all verification continues on local services or disposable local databases.

## Interface evidence and limits

The user selected the network-atlas direction and later rejected a split-screen login. The replacement is a centered district sign-in panel. Raw JSON in quality findings was replaced with a rule summary, named threshold values, affected-record links, plain-language findings and observed measurements. Generic nested record details also render labelled fields/lists.

Browser-observed local flows include sign-in, overview, navigation, DMA selection with underlying record lineage, a new quality run, and inspection of the billing discrepancy: BILL-2-2, billed 27 m³ versus meter consumption 24 m³. Desktop overview and mobile overview were captured; the mobile document width equaled its 390px viewport, with tables contained in their own scroll regions. Login and finding captures are saved under ignored `.impeccable/review`. The browser capture compositor produced artifacts in some resized captures; those are excluded from full fidelity claims. Mobile login DOM width was independently confirmed at 390px, but its bottom screenshot strip is a capture limitation.

The interface uses labelled inputs, Radix keyboard/focus behavior, status words with color, focus outlines, reduced-motion styles, role-aware navigation and responsive sheets. This is not a formal WCAG audit, screen-reader certification or regulatory-compliance certification. Unpictured operations screens have code/HTTP verification rather than a complete browser interaction matrix. Hosted CI, Docker startup, live providers, production load/restore drills and deployment over public HTTPS were not executed here.

## Final review and resumed startup

The independent finish review identified four material fixes: the attention queue should occupy its own desktop row, selected-DMA refresh should also reload the district diagram data, mobile sign-out needs an accessible name after its visual label is hidden, and display typography should be self-hosted. All four were applied in one batch. The reviewer scored each **resolved** and returned **ship**, scoped to that fix list and the valid supplied evidence; this is not a new certification of every screen.

The final web production build passed after those changes, with lint and TypeScript checks also passing. The previously completed 10 unit and 31 integration checks, plus the 18-checkpoint local walkthrough, remain the behavioral evidence. Self-hosted Barlow Medium and SemiBold and their OFL license ship under `apps/web/public/fonts`; source: the official [Google Fonts Barlow directory](https://github.com/google/fonts/tree/main/ofl/barlow).

On resuming work on 27 October, the built runtime was restored on 3200/4200. One process-health call reported `status=ok` and the configured remote database scope; one web request returned HTTP 200 with `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`. These startup checks made no authenticated database requests. Browser automation was disabled in Work settings at this resumed stage, so the earlier bounded local UI evidence was retained rather than bypassing that setting or repeating a Neon walkthrough.

The user's later login feedback removed the project-folder name from rendered UI and browser metadata. The login's duplicate district block was removed, the panel reduced to 390px maximum, and form/header/footer spacing tightened to avoid scrolling at normal laptop heights. A source search confirmed the implementation labels no longer occur in delivered web source. A fresh independent review returned **ship** at this narrow source-review scope with no material fixes. Browser settings prevented a fresh rendered-height check, so earlier login screenshots describe the prior version and are not evidence of the final compact layout. No page-wide overflow clipping was added; unusually short windows, zoom or an on-screen keyboard retain access to controls.

After this last refinement, lint, TypeScript and the web production rebuild passed. The rebuilt app was restarted at 3200/4200; its page returned HTTP 200 with the title **Water Utility Data Hub** and no project-folder name. The design documentation was completed from final source in `DESIGN.md` and `.impeccable/design.json`, with YAML/JSON, token-reference, section-order and sidecar validation. No additional backend, integration or Neon tests were needed for these frontend-only changes.

## Reference scope

The subsequent credential/bypass review added a dedicated **44-check security suite**, reproduced and fixed two authorization/privacy gaps, and re-ran the 31 integration plus 10 unit checks. All **85 checks passed locally**, with lint and TypeScript passing. See [the security review](security-review.md) for the access matrix, shared-demo-password limitation, initial failures and final evidence. No Neon tests or data/account changes were performed for that review.

Routing and client/server boundaries were checked against the installed Next.js 16.4.3 documentation; the official [layouts and pages guide](https://nextjs.org/docs/app/getting-started/layouts-and-pages) and [server/client component guide](https://nextjs.org/docs/app/getting-started/server-and-client-components) are the external references. Security and accessibility controls are selected implementation safeguards, not a claim that every external standard has been satisfied. Synthetic water-quality limits require locally approved replacement before operational use.

## School presentation extension — 27 October 2026

User administration, on-demand DQM trends/domain comparisons and meter reliability were added without schema changes. Existing accounts and runtime Neon operational tables were not changed. Unit checks: 13 passed; isolated integration checks: 42 passed; security checks: 46 passed; lint, API/web/tools TypeScript and production API/Next build passed. All database verification used local PostgreSQL, with all three migrations applied to a fresh disposable test database. Early integration fixture failures were corrected by using Manila date boundaries and retaining audited test users until the disposable database is removed; no historical guard was weakened.

Browser verification covered account list/form, disabled self role/access controls, real trend selection (98.69% baseline vs 98.12% later snapshot), 24-meter coverage, 19 actual/5 estimated readings, a consumption anomaly, record links, search and desktop/mobile layouts. API tests cover creation, duplicate emails, administrator authorization, role scope, stale edits, deactivation and revoked sessions. Browser account/permission mutations were not performed. Existing credentials were preserved. Fresh captures are in .impeccable/review/school. The independent reviewer returned fix for the trend formula inset; after scoped desktop/mobile corrections it scored that issue resolved and returned ship at that fix-list scope. No full accessibility or regulatory certification is claimed. See school-presentation.md for the demonstration steps.
