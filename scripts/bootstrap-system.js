#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { readJson, writeJson, ensureDir } = require("./lib/io");

const ROOT = path.resolve(__dirname, "..");
const settingsPath = path.join(ROOT, "state", "linkedin-settings.json");
const statePath = path.join(ROOT, "state", "linkedin-system-state.json");
const defaultSettingsPath = path.join(ROOT, "config", "default-settings.json");
const contextDir = path.join(ROOT, "context");
const aboutMePath = path.join(contextDir, "about-me.md");
const brandVoicePath = path.join(contextDir, "brand-voice.md");

const defaultSettings = readJson(defaultSettingsPath, {});
const currentSettings = readJson(settingsPath, null);
const currentState = readJson(statePath, null);

if (!currentSettings) {
  writeJson(settingsPath, defaultSettings);
}

if (!currentState) {
  writeJson(statePath, {
    version: "1.0.0",
    firstRunCompleted: false,
    lastSuccessfulRunAt: null,
    lastLeadFilterRunAt: null,
    lastDraftRunAt: null,
    lastReplyRunAt: null,
    leadRegistry: {},
    outreachRegistry: {},
    weeklyMetrics: {
      weekKey: null,
      leads_processed: 0,
      qualified_count: 0,
      drafted_count: 0,
      reply_drafts_count: 0,
      replied_count: 0,
      rejected_count: 0,
      score3_conversion_count: 0
    }
  });
}

ensureDir(path.join(ROOT, "output"));
ensureDir(path.join(ROOT, "reports"));
ensureDir(contextDir);

if (!fs.existsSync(aboutMePath)) {
  fs.writeFileSync(
    aboutMePath,
    "# ICP Profile\n\n## Target Industries\n- Software Development\n- Marketing Services\n\n## Target Seniority\n- Manager\n- Director\n\n## Target Geographies\n- United States\n\n## Offer Summary\nDescribe your offer here.\n",
    "utf8"
  );
}

if (!fs.existsSync(brandVoicePath)) {
  fs.writeFileSync(
    brandVoicePath,
    "# Brand Voice Profile\n\n## Language\nDefault: English\n\n## Outreach Goal\nStart relevant conversations with qualified leads.\n\n## Formatting Rules\n- Keep first-touch message concise.\n- Max one question.\n- No generic opener.\n",
    "utf8"
  );
}

console.log(JSON.stringify({
  ok: true,
  settingsInitialized: !currentSettings,
  stateInitialized: !currentState,
  root: ROOT
}, null, 2));
