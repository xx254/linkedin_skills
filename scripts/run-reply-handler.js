#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { classifyProspectReply } = require("./lib/reply-classify");
const { readJson, writeJson, ensureDir, formatDateKey } = require("./lib/io");
const { ensureWeekMetrics } = require("./lib/week-metrics");

const ROOT = path.resolve(__dirname, "..");

function getArgValue(flag) {
  const index = process.argv.findIndex((a) => a === flag);
  if (index === -1 || index === process.argv.length - 1) {
    return "";
  }
  return process.argv[index + 1];
}

const leadKeyArg = getArgValue("--lead-key");
const messageArg = getArgValue("--message");
const messageFile = getArgValue("--message-file");

if (!leadKeyArg) {
  console.error("Usage: node scripts/run-reply-handler.js --lead-key <key> (--message \"...\" | --message-file path)");
  process.exit(1);
}

let prospectText = messageArg;
if (messageFile) {
  const p = path.resolve(process.cwd(), messageFile);
  if (!fs.existsSync(p)) {
    console.error(`Message file not found: ${p}`);
    process.exit(1);
  }
  prospectText = fs.readFileSync(p, "utf8");
}

if (!prospectText || !String(prospectText).trim()) {
  console.error("Prospect message is empty. Use --message or --message-file.");
  process.exit(1);
}

const state = readJson(path.join(ROOT, "state", "linkedin-system-state.json"), null);
if (!state) {
  console.error("Missing state. Run: node scripts/bootstrap-system.js");
  process.exit(1);
}

ensureWeekMetrics(state);

const leadMeta = state.leadRegistry && state.leadRegistry[leadKeyArg];
const firstName =
  leadMeta && leadMeta.name ? leadMeta.name.split(" ")[0].replace(/[(),]/g, "") : "";

const { type: replyType, confidence } = classifyProspectReply(prospectText);

function buildDraft(rt, first) {
  const prefix = first ? `${first}, ` : "";
  switch (rt) {
    case "interested":
      return `${prefix}Thanks for writing back. What would be most useful to clarify first about how you're thinking about this?`;
    case "hesitant":
      return `${prefix}Makes sense. What would need to be true for this to feel worth a short look?`;
    case "competitor_mention":
      return `${prefix}Got it. Is that setup covering the outcome you care about here, or is there still a gap?`;
    case "positive_but_vague":
      return `${prefix}Happy to go deeper. Want to do a 15-minute pass with a clear agenda so it stays useful?`;
    case "not_interested":
      return `${prefix}Thanks for letting me know. I'll step back here. If anything changes, you're welcome to reach out.`;
    case "question":
      return `${prefix}Good question. Here's the direct answer: [fill in from your offer]. If you want, we can also sanity-check fit on a quick call.`;
    case "irrelevant":
    default:
      return `${prefix}Thanks for the note. To stay useful: are you still open to a quick exchange on [topic from your thread]?`;
  }
}

const draft = buildDraft(replyType, firstName).trim();
const now = new Date().toISOString();
const dateKey = formatDateKey();
const outDir = path.join(ROOT, "output", `replies_${dateKey}`);
ensureDir(outDir);

const safeKey = leadKeyArg.replace(/[^a-z0-9_|-]/gi, "_").slice(0, 120);
const artifactPath = path.join(outDir, `reply_${safeKey}_${dateKey}.json`);

const artifact = {
  lead_key: leadKeyArg,
  generated_at: now,
  prospect_message_excerpt: String(prospectText).slice(0, 2000),
  reply_type: replyType,
  classification_confidence: confidence,
  draft,
  status: "reply_drafted",
  note:
    "Template draft from run-reply-handler.js. Refine in the agent using context/brand-voice.md."
};

writeJson(artifactPath, artifact);

state.lastReplyRunAt = now;
state.lastSuccessfulRunAt = now;
state.weeklyMetrics.reply_drafts_count = (state.weeklyMetrics.reply_drafts_count || 0) + 1;

state.outreachRegistry = state.outreachRegistry || {};
const prev = state.outreachRegistry[leadKeyArg] || {};
state.outreachRegistry[leadKeyArg] = {
  ...prev,
  lastReplyDraftAt: now,
  lastReplyType: replyType,
  lastDraftStatus: "reply_drafted",
  lastProspectSnippet: String(prospectText).slice(0, 280)
};

writeJson(path.join(ROOT, "state", "linkedin-system-state.json"), state);

console.log(
  JSON.stringify(
    {
      output: artifactPath,
      lead_key: leadKeyArg,
      reply_type: replyType,
      draft_chars: draft.length
    },
    null,
    2
  )
);
