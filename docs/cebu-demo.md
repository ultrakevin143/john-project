# Cebu Water Hub demonstration

The prototype keeps its Water Utility Data Hub identity and approved network-atlas design. The utility is **Cebu Demonstration Water Utility**. MCWD is an operational reference only; no affiliation, actual network boundaries, customer records, live integration or official tariff is represented.

## Which workspace to use

| Workspace                     | Address               | Data                                                                                            |
| ----------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| Configured application        | http://localhost:3200 | Separate Water Hub Neon schema; operational records intentionally emptied at the user's request |
| Populated local demonstration | http://localhost:3300 | Independent local PostgreSQL; synthetic Cebu records                                            |

Both use the existing eight role accounts. Private login details remain in the ignored `.local/development-access.md`; no password is included in this guide. The parent Waste Hub is unchanged.

Run `npm run demo:local` for the local interface, then `npm run demo:verify` for the HTTP walkthrough. It refuses remote database URLs, verifies the API identifies itself as local before sign-in, and never reads the runtime `.env`. No polling or automatic retries are enabled.

`npm run demo:samples` creates `.local/demo-samples/cebu-laboratory.csv` and a Notepad-readable `START-HERE.txt` with manual steps, without querying any database. Use the CSV only with the populated local demo. Its first result is deliberately 0.29 mg/L, so you can verify the interface preserves a value just below the reference boundary. The second row has an incorrect unit; its correction uses labelled fields.

## Manual walkthrough

1. Sign in as the administrator. The overview prioritizes quality breaches and active leaks. Open the schematic's Lahug demo area and trace its water-balance records. The diagram is not a geographic map.
2. Open **Reference setup**. Review Lahug, Talamban, Guadalupe and Banilad in Cebu City, Manila time, the four laboratory methods, and illustrative PHP tariffs.
3. Sign in as the integration operator. Load a laboratory CSV containing one valid `mg/L` chlorine row and one row with an incorrect unit. The good row loads; the other is quarantined. Correct and retry only the failed row. The automated local walkthrough performs this scenario and saves evidence.
4. Sign in as the data steward. Run **Data quality**. Inspect the readable rule descriptions, threshold labels and affected measurements. City/barangay agreement, tariff amounts, sampling reminders and standards provenance supplement the existing seventeen checks. Acknowledging a finding never increases the measured score.
5. Sign in as the laboratory analyst. Correct the new chlorine sample using a verified reason. An existing result's previous value remains in the immutable audit history. Linking a corrective action does not make an out-of-limit result pass.
6. Sign in as the field supervisor. Open leak **LK-301**, then its linked **WO-201** work order. Dispatch, start and complete the repair in order. Completion resolves the linked active leak and creates a separate `LEAK_RESOLVED` audit event. Refresh the overview on demand.
7. Sign in as the billing analyst. Review PHP water charges and export NRW as CSV. The NRW balance is simplified input minus billed volume, counts only marked boundary meters and includes whole intervals within the selected Manila calendar period.
8. As administrator or steward, use **Reference setup → New version** to define a future illustrative tariff. The prior version ends at the new date. Existing bills keep their referenced tariff; nothing reassigns them automatically. Import future accounts/bills using the new version. A billing interval crossing a rate change must be split in the source system.
9. Review the audit trail. Plant staff cannot open customer/billing records; lab staff cannot open field/customer records; read-only analysts cannot import or change policies.

## Local references and limits

The location subset and PSGC codes come from the [PSA Cebu City barangay list](https://psa.gov.ph/classification/psgc/barangays/0730600000). These are four selected demo locations, not a complete Cebu geography directory or a claim about MCWD coverage. Department ownership titles are also illustrative.

The four parameter comparisons reference [DOH AO 2017-0010, PNSDW 2017, official FDA copy](https://www.fda.gov.ph/wp-content/uploads/2021/08/Administrative-Order-No.-2017-0010.pdf): free residual chlorine 0.3–1.5 mg/L, turbidity up to 5 NTU, pH 6.5–8.5, and total coliform by membrane filtration below one colony per 100 mL. This numeric coliform configuration accepts integer colony counts; MPN and presence/absence results are not interchangeable. Invalid units/ranges are excluded from the within-limit percentage.

The 24/168/720-hour reminders are demonstration operating intervals, not regulatory sampling frequencies. Sampling obligations depend on the approved Water Safety Plan, population, supply context, method and applicable DOH requirements. This four-parameter prototype does not certify potability. Current applicability and laboratory accreditation need professional review before real operational use.

Both tariff classes use explicitly invented minimum charges and progressive brackets. Decimal arithmetic rounds water charges to centavos, half up. These are not MCWD rates, and exclude taxes, discounts, penalties and other charges. No current official MCWD schedule was imported.

Privacy work is informed by the [Philippine Data Privacy Act](https://privacy.gov.ph/data-privacy-act-/): purpose limitation, minimum necessary access and accountable handling. Server-enforced roles, masking, ownership, classification and immutable audit support governance. Retention days remain prototype metadata; automatic erasure/anonymization, a privacy impact assessment, lawful-basis review and formal certification are not implemented.

## Neon cleanup scope

Maintenance empties nineteen operational/import/DQM-output tables for the known Water Hub organization. It preserves tables, migrations, users/password hashes, roles/grants, sessions, source registrations, reference configuration, governance catalog and immutable audit history. Source cursors and successful-load timestamps reset so the empty system does not claim imported data.

Before deletion, a private ignored operational backup is saved under `.local/cebu-maintenance`. An exclusive transaction suspends only the billing and lab deletion guards, deletes in dependency order, restores both guards, checks all nineteen counts are zero and verifies all eight accounts are byte-for-byte unchanged. Any failure rolls back the transaction. An audit event records the authorized cleanup. The parent Waste Hub schema and separate Neon project are never targeted.

The maintenance tool is not an API endpoint. Remote demo seeding stays blocked. An empty overview deliberately says it is ready for source data; zero observations do not imply water is safe.
