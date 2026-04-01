#!/usr/bin/env node
const path = require("path");
const { readJson, writeJson, getWeekKey } = require("./lib/io");
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
const outcome = getArgValue("--outcome");

const validOutcomes = ["positive", "rejected", "not_interested", "booked"];

if (!leadKeyArg || !outcome) {
  console.error(
    "Usage: node scripts/record-outcome.js --lead-key <key> --outcome <positive|rejected|not_interested|booked>"
  );
  process.exit(1);
}

if (!validOutcomes.includes(outcome)) {
  console.error(`Invalid outcome. Use one of: ${validOutcomes.join(", ")}`);
  process.exit(1);
}

const state = readJson(path.join(ROOT, "state", "linkedin-system-state.json"), null);
if (!state) {
  console.error("Missing state. Run: node scripts/bootstrap-system.js");
  process.exit(1);
}

ensureWeekMetrics(state);

const leadMeta = state.leadRegistry && state.leadRegistry[leadKeyArg];
const score = leadMeta && typeof leadMeta.score === "number" ? leadMeta.score : 0;

const now = new Date().toISOString();
state.outreachRegistry = state.outreachRegistry || {};
const prev = state.outreachRegistry[leadKeyArg] || {};

if (outcome === "rejected" || outcome === "not_interested") {
  state.weeklyMetrics.rejected_count += 1;
  state.outreachRegistry[leadKeyArg] = {
    ...prev,
    lastOutcomeAt: now,
    lastOutcome: outcome,
    lastDraftStatus: "closed_negative"
  };
} else if (outcome === "positive") {
  state.weeklyMetrics.replied_count += 1;
  state.outreachRegistry[leadKeyArg] = {
    ...prev,
    lastOutcomeAt: now,
    lastOutcome: "positive",
    lastDraftStatus: "replied_positive"
  };
  if (score === 3) {
    state.weeklyMetrics.score3_conversion_count += 1;
  }
} else if (outcome === "booked") {
  state.weeklyMetrics.replied_count += 1;
  state.outreachRegistry[leadKeyArg] = {
    ...prev,
    lastOutcomeAt: now,
    lastOutcome: "booked",
    lastDraftStatus: "booked"
  };
  if (score === 3) {
    state.weeklyMetrics.score3_conversion_count += 1;
  }
}

state.lastSuccessfulRunAt = now;
writeJson(path.join(ROOT, "state", "linkedin-system-state.json"), state);

console.log(
  JSON.stringify(
    {
      ok: true,
      lead_key: leadKeyArg,
      outcome,
      score_used: score,
      weeklyMetrics: state.weeklyMetrics
    },
    null,
    2
  )
);
