---
name: reply-handler
version: 2.0.0
description: |
  Draft a reply to a LinkedIn prospect's message. Uses shared state, classification,
  and scripts for artifacts and metrics. Trigger on: "draft a reply", "they responded",
  or when the user pastes a prospect message.
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - Bash
---

## Voice

Responsive, not scripted. Every reply should feel like it was written by someone who actually read the message. No boilerplate. No repositioning as a pitch. Pull the real thread forward.

## Completion Status Protocol

When completing a skill workflow, report status using one of:
- **DONE** — Reply drafted. Reply type and strategy noted. Artifact written if script ran.
- **DONE_WITH_CONCERNS** — Drafted, but the prospect's intent was ambiguous. Note what to watch for.
- **BLOCKED** — Cannot draft without more context. State what's missing.
- **NEEDS_CONTEXT** — Missing voice profile or conversation history. State exactly what you need.

---

## Required shared standards

Read before running:
- `standards/skill-method.md`
- `state/linkedin-settings.json`
- `state/linkedin-system-state.json`

Voice: use whatever voice context exists in the conversation (e.g., from a prior `/calibrate-voice` run). If none, proceed with neutral professional tone.

---

## Step 0: Resolve lead identity

The user should provide the prospect's message. For `lead_key`, use the same canonical key as `contracts/lead-artifact-contract.md`:

`lowercase(trim(name) + "|" + trim(company) + "|" + trim(linkedin_url))`

If unknown, ask once for name + company + LinkedIn URL to build `lead_key`, or accept `--lead-key` from registry.

---

## Step 1: Gather conversation context

The user should provide:
- The prospect's message (paste it in full)
- Any prior messages in the thread (optional but helpful)
- Campaign goal (if set): book a call, share a resource, qualify interest, etc.

If the goal is not provided, assume: move toward a short discovery conversation.

---

## Step 2: Classify the reply

Read the prospect's message and classify it:

| Reply type | Signals |
|------------|---------|
| `interested` | Asking for more info, asking how it works, expressing curiosity |
| `hesitant` | "Not the right time", "too busy", "maybe later", vague deflection |
| `competitor_mention` | Names another tool they use, implies the problem is already solved |
| `positive_but_vague` | "Sounds interesting", "tell me more" with no specific question |
| `not_interested` | Explicit no, asking to be removed, unsubscribing |
| `question` | Direct question about the product, pricing, or process |
| `irrelevant` | Off-topic, misdirected, or unclear |

State the classification before drafting.

---

## Step 2.5: Show reply logic and confirm before drafting

After classifying, show the user exactly how you plan to reply and why — then wait for confirmation or edits before writing the message.

Format:

```
REPLY LOGIC FOR: [Name] @ [Company]
─────────────────────────────────────
Their message:   [1-sentence summary of what they said]
Reply type:      [classification]
Rule applied:    [the specific rule that governs this reply type, in plain English]
Opening angle:   [what the reply will lead with]
Campaign goal:   [exact goal from outreach.conversionGoal in settings — e.g. "book a discovery call", "get them to try the free plan"]
Voice applied:   [2-3 key traits pulled from context/brand-voice.md — e.g. "direct opener, no filler words, ends with one low-friction question"]
URL to include:  [yes — [url from outreach.conversionGoal.link] / not yet — will include after [trigger]]

Rules I'll follow for this reply:
  1. No em dash — use commas or periods instead
  2. Every sentence under 30 words
  3. [No pitch — follow-up, not yet at pitch stage / Pitch allowed — prospect has shown clear interest]
  4. Peer-to-peer tone — no flattery, no bragging
  5. Max 1 question
  6. [Pulls thread from their specific message: [what exactly] / No new signal needed — responding to their question directly]
  7. [Graceful exit — acknowledge, leave door open, no push / N/A — prospect is still engaged]

Any rules to add, remove, or override before I write this?
```

Wait for the user to confirm or edit before proceeding to Step 3.

---

## Step 3: Productized pipeline (script)

Check if Node.js is available:
```bash
command -v node >/dev/null 2>&1 && echo "NODE_AVAILABLE" || echo "NO_NODE"
```

If NODE_AVAILABLE, run from repo root:
```bash
node scripts/bootstrap-system.js
node scripts/run-reply-handler.js --lead-key "<canonical lead_key>" --message "paste prospect message"
```

Optional: long messages from file:
```bash
node scripts/run-reply-handler.js --lead-key "<key>" --message-file path/to/prospect.txt
```

The script writes `output/replies_YYYY_MM_DD/reply_<lead>_<date>.json`, updates `outreachRegistry`, and increments `weeklyMetrics.reply_drafts_count`.

If NO_NODE: skip the script. Claude will write the artifact and update state directly using the Write tool.

Then **refine** the draft in your voice using `context/brand-voice.md`. The script output is a structured starting point, not the final send.

---

## Step 4: Draft the reply (agent quality pass)

Apply the branching logic based on reply type (same rules as v1).

**If `interested`:**
Ask a qualifying question. One question only. Do not pitch yet. The goal is to understand their specific situation. Do not send the landing page URL in this message.

**If `hesitant`:**
Acknowledge what they said. Ask what's making it feel like the wrong time. Do not push harder. Pull out the real objection. One gentle question is enough.

**If `competitor_mention`:**
Do not position against the competitor by name. Ask if that tool is solving the specific problem they mentioned. Let them arrive at the contrast themselves. Never say "compared to X, we..."

**If `positive_but_vague`:**
Deliver value first. Share the landing page (use the URL from `outreach.conversionGoal.link` in settings, if set). Frame it as "here's where you can see exactly how it works" or similar — not as a pitch. Then mention a call is available if they have questions, but do not include the booking link or suggest a time. Only share the calendar/booking link if they explicitly ask to schedule. Keep the message short.

**If `not_interested`:**
Thank them. Leave the door open. No follow-up pressure. Do not ask why. The reply should feel like a graceful exit, not a save attempt.

**If `question`:**
Answer directly. If it's a pricing question, give a real answer or offer to discuss on a call. If it's a fit question, answer honestly. Do not stall or redirect before answering.

**If `irrelevant`:**
Politely redirect to the relevant topic in one sentence.

---

## Step 5: Annotate the reply

After the draft:

```
DRAFT: [the message]

Reply type: [classification]
Strategy: [1 sentence on why this approach]
Next trigger: [what response from them would prompt the next step]
URL to include: [yes / not yet — and when to include it]
```

---

## Step 6: Record outcome (when user reports what happened)

When the user shares an actual result, persist metrics if state files exist:

If NODE_AVAILABLE:
```bash
node scripts/record-outcome.js --lead-key "<canonical lead_key>" --outcome positive
```

If NO_NODE: update `state/linkedin-system-state.json` directly — increment the relevant counter and set `outreachRegistry[lead_key].lastDraftStatus` to the outcome value.

Valid `--outcome` values:
- `positive` — warm reply or clear interest
- `rejected` — soft no / not a fit
- `not_interested` — hard no / unsubscribe tone
- `booked` — meeting or call booked

If `state/linkedin-system-state.json` does not exist, skip the script and note in the report that metrics were not persisted. This does not block the reply draft from being useful.

---

## Step 7: Handoff rules

If the campaign has a handoff level configured, note when to hand off to the user:

- **Partial:** draft all replies for user approval until the prospect asks to schedule
- **Full AI:** proceed autonomously, hand off only when a call is booked
- **Manual:** always draft for approval

Default to partial if not specified.

---

## Important Rules

- Never ask more than one question per message. One thread at a time.
- Never repeat the prospect's name in the reply.
- For `positive_but_vague`: include the landing page URL (from `outreach.conversionGoal.link`) to deliver value. Do not include the booking/calendar link unless the prospect asks.
- For all other reply types: do not include the landing page URL until the prospect asks or the conversation has progressed past initial interest.
- If the prospect's message has genuine ambiguity (could be hesitant or interested), classify conservatively and note the uncertainty.
- Always prioritize providing real value over pushing toward conversion.
