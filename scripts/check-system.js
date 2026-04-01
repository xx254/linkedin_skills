#!/usr/bin/env node
/**
 * Verifies repo layout, state files, and context after bootstrap.
 * Run from repo root: node scripts/check-system.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const required = [
  "state/linkedin-settings.json",
  "state/linkedin-system-state.json",
  "config/default-settings.json",
  "context/about-me.md",
  "context/brand-voice.md",
  "scripts/bootstrap-system.js",
  "scripts/run-lead-filter.js",
  "scripts/run-draft-outreach.js",
  "scripts/run-reply-handler.js",
  "scripts/record-outcome.js",
  "scripts/generate-weekly-report.js"
];

const issues = [];

for (const rel of required) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    issues.push(`missing: ${rel}`);
  }
}

let settings;
let state;
try {
  settings = JSON.parse(fs.readFileSync(path.join(ROOT, "state", "linkedin-settings.json"), "utf8"));
} catch (e) {
  issues.push("state/linkedin-settings.json is not valid JSON");
}
try {
  state = JSON.parse(fs.readFileSync(path.join(ROOT, "state", "linkedin-system-state.json"), "utf8"));
} catch (e) {
  issues.push("state/linkedin-system-state.json is not valid JSON");
}

if (settings && settings.version !== "1.0.0") {
  issues.push("linkedin-settings.json version unexpected (expected 1.0.0)");
}
if (state && state.version !== "1.0.0") {
  issues.push("linkedin-system-state.json version unexpected (expected 1.0.0)");
}

const out = {
  ok: issues.length === 0,
  root: ROOT,
  node: process.version,
  issues
};

console.log(JSON.stringify(out, null, 2));
process.exit(issues.length ? 1 : 0);
