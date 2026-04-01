# Lead Artifact Contract

This contract defines what `linkedin-lead-filter` writes and what
`draft-outreach` must read.

## Canonical fields

Required:
- `lead_key`
- `name`
- `title`
- `company`
- `linkedin_url`
- `qualification_status`
- `score`
- `signal_type`
- `reason`
- `last_scored_at`

Optional:
- `recent_activity`
- `engagement_signal`
- `source_file`
- `owner`

## File contract

`linkedin-lead-filter` must write:
- `output/leads_{date}/qualified_leads_{date}.csv`
- category disqualification files
- `output/leads_{date}/lead_registry_{date}.json`

The registry JSON must include an array `leads[]` with canonical fields.

## Key derivation

`lead_key` is:
`lowercase(trim(name) + "|" + trim(company) + "|" + trim(linkedin_url))`

If `linkedin_url` is missing, use:
`lowercase(trim(name) + "|" + trim(company) + "|missing_url")`

## Conflict policy

If the same `lead_key` appears multiple times in one run:
1. Keep the highest `score`.
2. Keep the most recent `signal_type` detail if available.
3. Record `duplicate_count` in state.

If a required field is missing:
- Stop downstream draft generation for that lead.
- Log it as `contract_violation`.
- Ask for field mapping or repair.
