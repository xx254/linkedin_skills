---
name: campaign-retro
version: 1.0.0
description: |
  Post-campaign analysis for LinkedIn outreach. Turns results into a precise diff of
  changes to three levers: voice, signals, and reply logic. Not a post-mortem, a fix list.
  Use when a campaign has finished and the user wants to know what to change.
  Trigger on: "review my campaign results", "my campaign just finished", "reply rate was low",
  "what do I fix after this campaign?", or any time the user shares metrics, message
  examples, or reply data and wants actionable next steps.
  Always use over generic analysis when outreach improvement is the goal.
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - Bash

---

## Voice

Direct. Quote the data. Say "this suggests..." when inferring. Do not soften findings. A low reply rate is a low reply rate. Name which lever is broken before recommending anything.

## Completion Status Protocol

When completing a skill workflow, report status using one of:
- **DONE** — Analysis complete. Changes recommended for each relevant lever.
- **DONE_WITH_CONCERNS** — Completed, but dataset was too thin to draw strong conclusions. List the gaps.
- **BLOCKED** — Cannot analyze. State what is missing.
- **NEEDS_CONTEXT** — Need at least one data input before proceeding. State exactly what you need.

---

## Step 0: Load context

Read `context/brand-voice.md` to understand the baseline.

---

## Step 1: Gather campaign data

Work with whatever the user has. At minimum, one of:
- **Stats:** sends, acceptance rate, reply rate, positive/booked rate (by signal type if possible)
- **Message examples:** what got replies vs. what didn't
- **Reply examples:** especially confused, hesitant, or negative ones

Ask one follow-up if something critical is missing. Do not block on a perfect dataset.

Campaign goal comes from `context/brand-voice.md` → `## Outreach Goal`. Use it directly — do not ask the user again. Only ask if the field is missing or blank.

If available, also load:
- `state/linkedin-system-state.json` weeklyMetrics
- `reports/weekly-summary_<week>.md`

These are supplementary — if they exist, use them as the primary metrics source. If they don't exist, ask the user to share numbers manually. Do not block analysis on their absence.

---

## Step 2: Diagnose which lever is broken

Before recommending anything, determine which lever the data points to:

| Metric | Threshold | Lever |
|--------|-----------|-------|
| Acceptance rate | Under 25% | Signal or targeting problem |
| Reply rate on accepted connections | Low | Voice problem |
| Reply rate is good, positive rate is low | — | Reply handling problem |

State the diagnosis explicitly:

```
DIAGNOSIS: [lever] is broken.
Evidence: [metric] was [value], which points to [lever].
```

Recommendations should go to the right lever only. Do not scatter changes across all three when only one is broken.

---

## Step 3: Output the recommendations

Three sections, then a priority.

### Voice Profile Updates

For each change: what to stop + what to start (with an example line). Max 2-4 changes.

Format:
```
Stop: [behavior]
Start: [behavior]
Example: "[sample line that demonstrates the new approach]"
Evidence: [what in the data suggests this]
```

### Signal Brief Updates

For each signal type that performed differently: what to do with it.

Format:
```
Signal: [signal type]
Change: Add / Remove / Narrow / Broaden
Why: [one sentence from the data]
```

### Reply Configuration Updates

For each reply type that underperformed or caused confusion:

Format:
```
Reply type: [type]
Current handling: [what the skill currently does]
Recommended change: [what to do instead]
Evidence: [what in the data suggests this]
```

### One Thing to Prioritize

**Single bolded recommendation.** If they can only change one thing, this is it.

---

## Step 4: Write updates to context files

After confirming with the user:

1. If voice changes are approved, update `context/brand-voice.md` with the specific changes.
2. If signal changes are approved, note them in `context/brand-voice.md` under a "Signal Notes" section.

Do not overwrite the whole file. Make surgical edits to the relevant sections.

---

## Step 5: Confirm

```
RETRO REPORT
═════════════════════════════════════
Campaign goal:        [goal]
Acceptance rate:      [N]%
Reply rate:           [N]%
Positive/booked:      [N]%
Lever diagnosed:      [lever]
Changes recommended:  [N voice / N signal / N reply]
Files updated:        [list]
Status: DONE
═════════════════════════════════════
```

If Node.js is available:
```bash
command -v node >/dev/null 2>&1 && node scripts/generate-weekly-report.js
```
Include the generated report path if the script ran.

If NO_NODE: write the weekly report directly to `reports/weekly-summary_<weekKey>.md` using the Write tool, based on the metrics in `state/linkedin-system-state.json`.

Then say:

> Run `/calibrate-voice` if the voice changes are significant enough to need a full re-calibration. Otherwise the edits above take effect immediately on the next campaign.

---

## Important Rules

- Never recommend changes to all three levers if the data only supports one.
- "This suggests..." is always acceptable when inferring. "This proves..." is not unless the data is conclusive.
- If the sample size is under 20 sends, note that the conclusions are directional, not statistically reliable.
- Every recommendation must trace back to a specific data point, metric, or quoted example.
- The goal is to make the next campaign measurably better, not to explain what went wrong.
