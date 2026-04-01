# LinkedIn Productized Skill System

This project now runs as a productized skill system with four layers:

1. Method layer: `standards/skill-method.md`
2. Contract layer: `contracts/lead-artifact-contract.md`
3. State/config layer: `state/*.json`, `config/*.json`
4. Execution layer: `scripts/*.js`

## Quick Start

From repo root:

```bash
node scripts/bootstrap-system.js
node scripts/run-lead-filter.js sample_contacts.csv
node scripts/run-draft-outreach.js --registry output/leads_YYYY_MM_DD/lead_registry_YYYY_MM_DD.json
node scripts/generate-weekly-report.js
```

Reply thread (after a prospect messages you):

```bash
node scripts/run-reply-handler.js --lead-key "<from lead_registry or state>" --message "paste their message"
node scripts/record-outcome.js --lead-key "<same key>" --outcome positive
```

Valid `--outcome` values: `positive`, `rejected`, `not_interested`, `booked`.

## Main Outputs

- Lead filter artifacts: `output/leads_YYYY_MM_DD/*`
- Outreach artifacts: `output/outreach_YYYY_MM_DD/*`
- Reply drafts: `output/replies_YYYY_MM_DD/*`
- Weekly ops report: `reports/weekly-summary_YYYY-WNN.md`

## Persistent Memory

- Settings: `state/linkedin-settings.json`
- Operational state and metrics: `state/linkedin-system-state.json`

## Skill Contracts

- `linkedin-lead-filter` must write canonical `lead_registry_*.json`.
- `draft-outreach` should consume `lead_registry_*.json` via `--registry`.
- `reply-handler` and `campaign-retro` must update/read weekly metrics.
