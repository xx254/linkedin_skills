---
name: linkedin-skills-method
version: 1.0.0
description: Unified operating standard for all LinkedIn outreach skills.
---

# LinkedIn Skills Method Standard

This file is the top-level method for every skill in this repository.
Each skill must follow the same question protocol, failure policy, output
format, and state contract.

## 1) AskUserQuestion Protocol (required)

When a skill asks the user for a decision, use this structure:

1. Re-ground: current task, expected output, and what is missing.
2. Simplify: plain-language explanation of the decision.
3. Recommendation: pick one option and explain why in one line.
4. Options: A/B/C with explicit tradeoffs.

Template:

```
Context: [current step + goal]
Decision: [plain-language problem]
RECOMMENDATION: Choose [X] because [reason]
Options:
A) ...
B) ...
C) ...
```

## 2) Failure and Escalation Policy (required)

Use exactly one status at completion:
- DONE
- DONE_WITH_CONCERNS
- NEEDS_CONTEXT
- BLOCKED

Escalate to BLOCKED when:
- Required input artifact is missing after 2 clarification attempts.
- CSV cannot be parsed after 2 normalization attempts.
- Contract validation fails and user cannot resolve mapping quickly.

For BLOCKED, always include:
- REASON
- ATTEMPTED
- NEXT_ACTION

## 3) Output Standard (required)

Every run writes both machine-readable artifacts and a human summary.

Required output sections:
1. RESULT_COUNTS
2. QUALITY_FLAGS
3. FILE_PATHS_WRITTEN
4. STATE_UPDATES
5. STATUS

## 4) State Layer Contract (required)

Shared files:
- `state/linkedin-settings.json`
- `state/linkedin-system-state.json`

Skills must:
- Read settings before decision logic.
- Read state before processing.
- Write state after processing.
- Never silently reset state.

## 5) Settings Protocol (required)

All user preferences live in `state/linkedin-settings.json`.
Skills must support updates through conversation (no manual editing required).

Supported settings:
- `timezone`
- `targetMarket` (industries, geos, company size, seniority)
- `qualification` (score thresholds and disqualify rules)
- `outreach` (character cap, max questions, tone profile)
- `cadence` (daily or weekly processing preference)
- `prioritization` (score and signal weighting)

## 6) Cross-Skill Artifact Contract (required)

`linkedin-lead-filter` produces canonical lead records.
`draft-outreach` consumes canonical lead records.

Canonical key:
- `lead_key = lowercase(name|company|linkedin_url)`

Required lead fields:
- `lead_key`
- `name`
- `title`
- `company`
- `linkedin_url`
- `qualification_status` (`qualified` or disqualified category)
- `score` (1-3 for qualified leads)
- `signal_type`
- `reason`
- `last_scored_at`

If required fields are missing, do not proceed silently.
Ask for mapping or run a contract repair step.

## 7) First-Run and Recovery Rules

If settings/state files are missing, create defaults and mark:
- `"firstRunCompleted": false`

Then ask the user for required onboarding choices and persist them.
After successful run, set:
- `"firstRunCompleted": true`
- `"lastSuccessfulRunAt": <timestamp>`

## 8) Operational Metrics (required)

Each run updates weekly counters in state:
- leads_processed
- qualified_count
- drafted_count
- reply_drafts_count
- replied_count
- rejected_count
- score3_conversion_count

If a metric is unavailable, write `0` and add a concern note.
