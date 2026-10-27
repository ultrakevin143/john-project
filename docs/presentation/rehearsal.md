# Water Hub presentation rehearsal

Use the local demo at `http://localhost:3300`; it uses local PostgreSQL. Start the local database and `npm run demo:local` as described in the [runbook](../runbook.md). Existing sign-in details are in the ignored local access file; do not put passwords into slides.

1. **Business outcome:** show the overview, water-quality breaches and active leaks. Explain that the district and readings are synthetic.
2. **Sources:** open Integrations and show the seven source registrations. CSV and the simulated provider snapshots feed the application; real external provider connections are not implemented.
3. **Extract, transform, load:** choose **New import → Field work orders → work-orders → CSV batch** and use [work-orders-example.csv](work-orders-example.csv). The first row is valid and the second has an invalid category, so it should be quarantined. The DMA ID refers to the seeded local Lahug demo area; replace it with an ID from local `/api/operations/lookups` if your local setup differs. Change both sourceRecordId and reference values for a genuinely new demonstration; a replay of identical content is deliberately idempotent. The local demo will retain the imported synthetic record and audit history.
4. **Correct and retry:** inspect the run, change only the failed row's category to `LEAK_REPAIR`, and retry it. The original successful row should not be duplicated.
5. **DQM:** run checks once, inspect a finding and its labeled values, then view trends. Explain the score counts record-rule observations; it does not certify water safety.
6. **Governance and output:** show the asset owner, steward, classification and audit trail; show a DMA water balance and the source records behind it. Retention periods are metadata, not automated deletion.

The source → integration → governance → output flowchart and comparison with Waste Hub are in [the PowerPoint alignment review](../integration-pptx-review.md). The activity's five named industries do not include water utilities; check with the instructor whether this chosen domain is acceptable.
