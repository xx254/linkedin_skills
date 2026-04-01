#!/usr/bin/env node
const path = require("path");
const { readJson, writeText, ensureDir } = require("./lib/io");

const ROOT = path.resolve(__dirname, "..");
const state = readJson(path.join(ROOT, "state", "linkedin-system-state.json"), null);
if (!state) {
  console.error("Missing state file.");
  process.exit(1);
}

const weekKey = state.weeklyMetrics?.weekKey || "unknown-week";
const metrics = state.weeklyMetrics || {};
const reportDir = path.join(ROOT, "reports");
ensureDir(reportDir);

const conversionRate = metrics.qualified_count
  ? ((metrics.score3_conversion_count / metrics.qualified_count) * 100).toFixed(2)
  : "0.00";

const content = `# Weekly Outreach Report (${weekKey})

## Core Metrics
- leads_processed: ${metrics.leads_processed || 0}
- qualified_count: ${metrics.qualified_count || 0}
- drafted_count: ${metrics.drafted_count || 0}
- reply_drafts_count: ${metrics.reply_drafts_count || 0}
- replied_count: ${metrics.replied_count || 0}
- rejected_count: ${metrics.rejected_count || 0}
- score3_conversion_count: ${metrics.score3_conversion_count || 0}
- score3_conversion_rate: ${conversionRate}%

## System Timestamps
- last_lead_filter_run: ${state.lastLeadFilterRunAt || "n/a"}
- last_draft_run: ${state.lastDraftRunAt || "n/a"}
- last_reply_run: ${state.lastReplyRunAt || "n/a"}
- last_successful_run: ${state.lastSuccessfulRunAt || "n/a"}

## Notes
- Use this report in /campaign-retro for lever diagnosis.
- If drafted_count grows but replied_count stays flat, focus on voice and signal quality.
`;

const reportPath = path.join(reportDir, `weekly-summary_${weekKey}.md`);
writeText(reportPath, content);
console.log(JSON.stringify({ output: reportPath }, null, 2));
