# School presentation walkthrough

Start with the [PowerPoint alignment review](integration-pptx-review.md), which includes the source-to-output flowchart, comparison with Waste Hub, verified capabilities and assignment limitations.

Use the isolated local demo at `http://localhost:3300`, API 4300 and PostgreSQL 54339. Start the persistent local database with `.local/local.env`, then `npm run demo:local`. Never seed or test Neon.

## User management

Sign in with the existing administrator account and open **Users**. Search accounts; open **Create account** to explain name, memorable email, initial password, role and audit reason. Creation is immediate; no invitation email is sent. Choose a distinct password privately, never in slides or screenshots.

Edit an account to explain role/access changes. Deactivation preserves history. Role/access changes revoke sessions; timestamps reject stale edits; the server enforces organization scope and administrator access. Your own role/access controls are disabled; another administrator must change them. The last active administrator is protected. Local administrator-assisted recovery is described in [the recovery guide](password-recovery-plan.md); MFA remains future work.

## DQM trends

Open **Data quality → View trends**. The graph and exact-value table show up to 12 real successful snapshots; failed/in-progress runs are excluded. Select **Inspect run** to review saved results. Domain scores use checked observations as their denominator, rather than averaging rule percentages. Changes are percentage points against the previous successful run. Different rule coverage can affect comparisons; no observations is unavailable in the trend. This is not a water-safety certificate.

Mobile charts/tables scroll within their own regions. No polling or automatic runs occur. Demonstrate improvement by correcting a local synthetic record with a reason, running checks once and comparing snapshots. No fabricated history is created for the chart.

## Meter reliability

Open **Operations → Open meter reliability**. Explain the selected Manila period and DMA, then compare eligible meters, meters read, missing meters, actual/estimated readings, estimated share and anomalous readings. The default is the previous complete Manila month.

A missing meter has no complete reading interval contained in the period. Eligibility uses currently active, unarchived meters on unarchived connections, installed by the start; this is not a historical inventory or scheduled-read SLA. Register inconsistencies and the configured DQM consumption threshold produce labelled findings. Search filters the table; summary totals retain the period/DMA scope. Open a meter or flagged reading for lineage. Empty periods show actual missing coverage rather than sample figures.

## Boundaries

The additions require no schema migration and do not change the eight existing demo credentials. Screenshots are in ignored `.impeccable/review/school`. All testing uses local PostgreSQL; runtime operational tables on Neon remain intentionally empty. Live providers, notifications, automated retention and production identity recovery are future work.
