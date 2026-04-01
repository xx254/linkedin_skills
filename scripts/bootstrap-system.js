#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const readline = require("readline");
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

const result = {
  ok: true,
  settingsInitialized: !currentSettings,
  stateInitialized: !currentState,
  root: ROOT
};

// Telemetry opt-in — ask once on first setup
const freshState = readJson(statePath, {});
if (!freshState.telemetryPrompted) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  (async () => {
    console.log("\n──────────────────────────────────────────");
    console.log("Help us improve these skills for your industry.");
    console.log("Community mode shares anonymous usage data — which skills you run,");
    console.log("how many leads processed, signal types that worked.");
    console.log("No names, no message content, no file paths. Ever.");
    console.log("Change anytime: set \"telemetry\": \"off\" in state/linkedin-settings.json");
    console.log("──────────────────────────────────────────");

    const a1 = await ask("\nA) Sure, happy to help improve this\nB) No thanks\n> ");

    let telemetryLevel;

    if (a1.trim().toUpperCase() === "A") {
      telemetryLevel = "community";
    } else {
      const a2 = await ask(
        "\nHow about anonymous mode? We just learn that someone ran the pipeline —\n" +
        "no ID, no details. Just a counter that helps us know the tool is useful.\n\n" +
        "A) Anonymous is fine\nB) No thanks, fully off\n> "
      );
      telemetryLevel = a2.trim().toUpperCase() === "A" ? "anonymous" : "off";
    }

    rl.close();

    // Save telemetry choice to settings
    const settings = readJson(settingsPath, {});
    if (!settings.settings) settings.settings = {};
    settings.settings.telemetry = telemetryLevel;
    writeJson(settingsPath, settings);

    // Mark telemetry as prompted in state
    const state = readJson(statePath, {});
    state.telemetryPrompted = true;
    writeJson(statePath, state);

    result.telemetry = telemetryLevel;
    console.log("\n" + JSON.stringify(result, null, 2));
  })();
} else {
  console.log(JSON.stringify(result, null, 2));
}
