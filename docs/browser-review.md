# Mercado Chrome verification — 27 October 2026

The built-in browser connector remained disabled, so the user authorized testing in Mercado Chrome through the desktop Computer Use interface. The demo was `http://localhost:3300`, API 4300, backed by local PostgreSQL only.

## Completed browser checks

- The compact district login fit the observed 1366 × 720 window. Existing private local credentials opened the network-atlas overview. The browser password-saving suggestion was dismissed without saving credentials.
- The overview displayed actual local breaches, active leaks, DMA links, water balance, quality and source freshness.
- One explicit browser DQM run completed and saved: 1,036 passed observations out of 1,055, with 19 findings and a 98.20% score across 21 rules.
- The failed breach-trace inspection displayed a plain-language reason, sampling point, parameter, observed value, reference limits, corrective-action status and source-record link. Raw JSON was not displayed.
- Quality trends included the newly saved result and its timestamp.
- The governance catalog and edit form displayed owners, stewards, classification, retention metadata, policy and change reason. The editor was closed without saving.
- The integration workspace, ingestion-method selection and CSV form loaded. No import was submitted in the browser.
- The account list loaded all eight existing roles without showing passwords. No account was modified.
- Sign out returned the protected users URL to the district login form.

The browser-triggered changes were local session/audit activity and one DQM run. No Neon request, schema change, operational cleanup or credential change occurred.

The following reload check was interrupted by Computer Use because it could not confidently determine the browser URL for its policy check. No further input was issued in that turn. The observations above were completed before that stop; a reload-after-logout check is not claimed.

This is a bounded desktop walkthrough, not exhaustive cross-browser, mobile or all-role coverage. Separate automated local integration/access tests cover backend permissions and mutations. Screens were inspected live; no persistent screenshot files were captured for this report. No source change was needed for the observed Water Hub screens.
