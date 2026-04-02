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

function showSampleLeads() {
  const samplePath = path.join(ROOT, "sample_warm_leads.example.csv");
  if (!fs.existsSync(samplePath)) return;

  const lines = fs.readFileSync(samplePath, "utf8").trim().split("\n");
  const rows = lines.slice(1).filter(l => l.trim());
  const preview = rows.slice(0, 5);
  const remaining = rows.length - preview.length;

  // Fixed column widths (total inner width including 1-space padding each side)
  const COLS = [5, 16, 28, 15, 62];
  const HEADERS = ["#", "Name", "Title", "Company", "Signal"];

  // Word-wrap text to fit within content width (col width minus 2 for padding)
  function wrap(text, colWidth) {
    const maxW = colWidth - 2;
    const words = text.split(" ");
    const result = [];
    let line = "";
    for (const word of words) {
      if (!line) {
        line = word.slice(0, maxW);
        let rest = word.slice(maxW);
        while (rest) { result.push(line); line = rest.slice(0, maxW); rest = rest.slice(maxW); }
      } else if (line.length + 1 + word.length <= maxW) {
        line += " " + word;
      } else {
        result.push(line);
        line = word.slice(0, maxW);
        let rest = word.slice(maxW);
        while (rest) { result.push(line); line = rest.slice(0, maxW); rest = rest.slice(maxW); }
      }
    }
    if (line) result.push(line);
    return result.length ? result : [""];
  }

  function cell(text, colWidth) {
    return " " + text.padEnd(colWidth - 1);
  }

  function center(text, colWidth) {
    const space = colWidth - 2 - text.length;
    const l = Math.floor(space / 2);
    const r = space - l;
    return " " + " ".repeat(l) + text + " ".repeat(r) + " ";
  }

  const border = (l, m, r) => l + COLS.map(w => "─".repeat(w)).join(m) + r;
  const dataRow = cells => "│" + cells.map((t, i) => cell(t, COLS[i])).join("│") + "│";

  const parsed = preview.map((line, i) => {
    const cols = line.split(",");
    return [
      String(i + 1),
      `${cols[0].trim()} ${cols[1].trim()}`,
      cols[2].trim(),
      cols[4].trim(),
      cols[9].trim().replace(/^"|"$/g, ""),
    ];
  });

  console.log("\nLoading sample warm leads — placeholder contacts with realistic signals so you can run the full pipeline right now. Swap in your real\n  leads any time.\n");
  console.log(border("┌", "┬", "┐"));
  console.log("│" + HEADERS.map((h, i) => center(h, COLS[i])).join("│") + "│");

  for (const row of parsed) {
    console.log(border("├", "┼", "┤"));
    const wrapped = row.map((val, i) => wrap(val, COLS[i]));
    const height = Math.max(...wrapped.map(w => w.length));
    for (let l = 0; l < height; l++) {
      console.log(dataRow(wrapped.map(w => w[l] || "")));
    }
  }

  if (remaining > 0) {
    console.log(border("├", "┼", "┤"));
    const totalInner = COLS.reduce((a, b) => a + b, 0) + COLS.length - 1;
    const msg = `  and ${remaining} more`;
    console.log("│" + msg.padEnd(totalInner) + "│");
  }

  console.log(border("└", "┴", "┘"));
  console.log("");
}

const result = {
  ok: true,
  settingsInitialized: !currentSettings,
  stateInitialized: !currentState,
  root: ROOT
};

showSampleLeads();
console.log(JSON.stringify(result, null, 2));
