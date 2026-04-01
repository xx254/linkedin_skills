---
name: onboard
version: 1.0.0
description: |
  First-run onboarding. Analyzes the user's landing page to suggest an ICP,
  asks for confirmation and any additions, then collects timezone + cadence.
  Saves everything to state/linkedin-settings.json and marks firstRunCompleted: true.
  Run this once before using any other skill.
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - Bash

---

## Voice

Clear and helpful. You're doing the heavy lifting — the user just confirms.
Never dump a blank form. Always propose first, then ask for corrections.

## Completion Status Protocol

- **DONE** — Settings saved, firstRunCompleted set to true.
- **BLOCKED** — Cannot proceed. State what failed and what was tried.
- **NEEDS_CONTEXT** — Missing required input. State exactly what you need.

---

## Step 0: Check if already set up

Read `state/linkedin-settings.json`.

If `firstRunCompleted` is `true`, say:
```
Setup already complete. Your ICP is loaded in state/linkedin-settings.json.
To re-run setup, set "firstRunCompleted": false in that file and run /onboard again.
```
Then stop.

If the file doesn't exist, copy defaults from `config/default-settings.json` and continue.

---

## Step 1: Get the landing page URL

Ask:
```
Context: First-time setup for LinkedIn outreach.
What is your product or service landing page URL?
(e.g. https://yourcompany.com — I'll analyze it to suggest your ICP)
```

---

## Step 2: Analyze the landing page

Call the proxy with bash:

```bash
curl -s -X POST https://landing-page-analysis-proxy.vercel.app/api/crawl \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"<URL_FROM_STEP_1>\"}"
```

Parse the returned markdown content.

From the content, extract and infer:
- **industries** — what industries does this product serve?
- **seniority** — what job levels are likely buyers? (look for "for teams", "for founders", "for managers", etc.)
- **companySizes** — any signals about company size? (e.g. "enterprise", "startups", "SMBs")
- **geographies** — any regional focus mentioned?
- **alwaysExcludeRoles** — any roles clearly not the target?
- **offer summary** — one sentence: what does this product do and who is it for?
- **disqualifyCategories** — always include `competitors` and `non_decision_makers`. Then derive 1–5 additional categories from the product analysis. Each should be a short snake_case label with a plain-English description. Only add categories that genuinely follow from what the product does and who it serves — do not pad. Examples:
  - A B2B SaaS tool → `b2c_focused` (companies selling to consumers, not businesses)
  - An outbound sales tool → `no_outbound_intent` (companies with no sales motion)
  - A hiring tool → `no_hiring_activity` (companies not actively hiring)
  - A compliance tool → `non_regulated_industries` (industries without compliance requirements)
  - A developer tool → `non_technical_teams` (teams with no engineering function)
  - A PLG product → `no_self_serve_motion` (companies that only buy through procurement)

Also infer the **competitor profile** — who would be disqualified from outreach because they are competitors or would never buy:
- **competitorDescription** — one sentence: what kind of company is a competitor? (e.g. "Companies that offer similar outreach automation or lead generation tools")
- **competitorCompanyKeywords** — 5–10 lowercase keywords that would appear in a competitor's company name (e.g. ["lead gen", "sales automation", "crm", "sequencer"])
- **competitorIndustryKeywords** — 3–6 lowercase keywords for competitor industries (e.g. ["sales enablement", "marketing automation"])
- **competitorServiceKeywords** — 8–15 lowercase phrases describing the specific services a competitor would offer, grounded in what this product does (e.g. if the product automates LinkedIn outreach, then: ["linkedin outreach", "automated prospecting", "cold outreach", "outbound sequences", "sales cadence", "prospect automation"]). These will be matched against a lead's company description or bio, so phrases should reflect how competing services describe themselves.

If the proxy call fails, say:
```
BLOCKED: Could not fetch the landing page.
Error: [error message]
Please check the URL and try again, or provide your ICP manually.
```
Then ask the user to provide ICP fields manually and skip to Step 4.

---

## Step 3: Present suggested ICP for confirmation

Show the extracted ICP and competitor profile in this format:

```
Based on your landing page, here's your suggested ICP:

Offer:          [one-sentence summary]
Industries:     [list]
Seniority:      [list]
Company size:   [list or "not specified"]
Geographies:    [list or "not specified"]
Exclude roles:  [list]

Disqualify — leads in these buckets will be filtered out:
  [for each category: "- category_label: plain English description"]

And here's the inferred competitor profile (used to auto-filter leads):

Competitors:    [competitorDescription]
Co. keywords:   [competitorCompanyKeywords joined with ", "]
Industries:     [competitorIndustryKeywords joined with ", "]
Services:       [competitorServiceKeywords joined with ", "]

Does this look right?
A) Yes, looks good
B) Some changes needed — tell me what to adjust
C) Ignore this, I'll fill in everything myself
```

If B: apply the user's corrections to both the ICP and the competitor profile before continuing.
If C: ask for each ICP field individually, then ask for competitor description and keywords.

---

## Step 4: Collect conversion goal

Ask:
```
What's the goal of your outreach — what action do you want an interested prospect to take?

A) Visit a landing page
B) Book a call
C) Fill out a form
D) Receive a lead magnet (e.g. guide, case study)
E) Subscribe to a newsletter
F) Other — describe it

If you have a link for it, paste it now. You can also skip this and add it later.
```

Save the choice as `outreach.conversionGoal.type` and the link (if provided) as `outreach.conversionGoal.link`. If no link is given, leave `link` as `null`. Do not block progress if the link is missing.

---

## Step 5: Collect timezone and cadence

Ask:
```
Two quick preferences:

1. Your timezone? (e.g. America/New_York, Europe/London, Asia/Singapore)
2. How often do you want to run outreach?
   A) Daily — pick a time (e.g. 08:00)
   B) Weekly — pick a day + time (e.g. Monday 08:00)
```

---

## Step 6: Save settings

Write the confirmed ICP + preferences into `state/linkedin-settings.json`:

- `targetMarket.industries`
- `targetMarket.seniority`
- `targetMarket.companySizes`
- `targetMarket.geographies`
- `targetMarket.alwaysExcludeRoles`
- `qualification.disqualifyCategories` — array of snake_case labels derived in Step 2 (e.g. `["competitors", "non_decision_makers", "b2c_focused"]`)
- `timezone`
- `cadence`
- `outreach.conversionGoal.type`
- `outreach.conversionGoal.link` (may be `null`)
- `firstRunCompleted` → `true`

Also write the competitor profile to `state/competitor-profile.json`:

```json
{
  "generatedAt": "<ISO timestamp>",
  "sourceUrl": "<landing page URL>",
  "description": "<competitorDescription>",
  "companyKeywords": ["<keyword1>", "<keyword2>", "..."],
  "industryKeywords": ["<keyword1>", "<keyword2>", "..."],
  "serviceKeywords": ["<phrase1>", "<phrase2>", "..."]
}
```


---

## Step 6.5: Telemetry opt-in (one time only)

Check if `state/linkedin-system-state.json` has `"telemetryPrompted": true`. If yes, skip this step entirely.

Ask once using AskUserQuestion:

> Help us build better signals for your industry! Community mode shares anonymous usage data (which skills you use, how many leads processed, signal types that worked) — no names, no message content, no file paths ever sent.
> Change anytime by setting `"telemetry": "off"` in `state/linkedin-settings.json`.

Options:
- A) Sure, happy to help improve this
- B) No thanks

If A: set `settings.telemetry = "community"` in `state/linkedin-settings.json`
If B: ask one follow-up:

> How about anonymous mode? We just learn that *someone* ran the pipeline — no ID, no details. Just a counter that helps us know the tool is useful.

Options:
- A) Anonymous is fine
- B) No thanks, fully off

If B→A: set `settings.telemetry = "anonymous"`
If B→B: set `settings.telemetry = "off"`

Always set `state.telemetryPrompted = true` in `state/linkedin-system-state.json` after this step regardless of choice.

**What gets sent (community mode only):**
- Which skill was run
- Number of leads processed
- Signal types present (e.g. `post_like`, `funding_news`) — no names or content
- Outcome (done / blocked / needs_context)
- Timestamp

**What is never sent:** names, companies, LinkedIn URLs, message content, file paths, your landing page URL.

**How it's sent:** at the end of each skill run via:
```bash
curl -s -X POST https://linkednav-telemetry.vercel.app/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"skill":"<skill_name>","leads":<count>,"signals":[<types>],"outcome":"<outcome>","ts":"<iso>"}' \
  2>/dev/null &
```

Only run this curl if `settings.telemetry` is `"community"`. If `"anonymous"`, send `{"skill":"<skill_name>","ts":"<iso>"}` only. If `"off"`, skip entirely.

---

## Step 7: Confirm and hand off

Output:

```
SETUP COMPLETE
══════════════════════════════════════
Offer:        [summary]
Industries:   [list]
Seniority:    [list]
Company size: [list]
Geographies:  [list]
Timezone:     [tz]
Cadence:      [frequency + time]
Goal:         [conversionGoal.type] — [conversionGoal.link or "no link set"]

Settings saved to: state/linkedin-settings.json
Competitor profile: state/competitor-profile.json

Next step: Run /linkedin-lead-filter with your CSV to start filtering leads.
══════════════════════════════════════
```
