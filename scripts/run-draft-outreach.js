#!/usr/bin/env node
const path = require("path");
const {
  readJson,
  readText,
  writeJson,
  ensureDir,
  formatDateKey,
  getWeekKey
} = require("./lib/io");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

function getArgValue(flag) {
  const index = args.findIndex((a) => a === flag);
  if (index === -1 || index === args.length - 1) {
    return "";
  }
  return args[index + 1];
}

const registryPath = getArgValue("--registry");
const leadKeyArg = getArgValue("--lead-key");
const nameArg = getArgValue("--name");
const companyArg = getArgValue("--company");
const titleArg = getArgValue("--title");
const linkedinArg = getArgValue("--linkedin");
const signalArg = getArgValue("--signal");

const settings = readJson(path.join(ROOT, "state", "linkedin-settings.json"), null);
const state = readJson(path.join(ROOT, "state", "linkedin-system-state.json"), null);
const voiceProfile = readText(path.join(ROOT, "context", "brand-voice.md"), "");

if (!settings || !state) {
  console.error("Missing state files. Run: node scripts/bootstrap-system.js");
  process.exit(1);
}

if (!voiceProfile.trim()) {
  console.error("Missing context/brand-voice.md. Run calibrate-voice first.");
  process.exit(1);
}

function lower(v) {
  return String(v || "").trim().toLowerCase();
}

function canonicalLeadKey(name, company, url) {
  const urlPart = String(url || "").trim() || "missing_url";
  return lower(`${String(name || "").trim()}|${String(company || "").trim()}|${urlPart}`);
}

function selectLeadFromRegistry() {
  if (!registryPath) return null;
  const fullPath = path.resolve(process.cwd(), registryPath);
  const registry = readJson(fullPath, null);
  if (!registry || !Array.isArray(registry.leads)) return null;

  let lead = null;
  if (leadKeyArg) {
    lead = registry.leads.find((item) => item.lead_key === leadKeyArg);
  }
  if (!lead) {
    const minScore = settings.qualification.minScoreToPrioritize || 3;
    lead = registry.leads.find((item) => item.qualification_status === "qualified" && item.score >= minScore);
  }
  if (!lead) {
    lead = registry.leads.find((item) => item.qualification_status === "qualified");
  }
  return lead;
}

let lead = selectLeadFromRegistry();
if (!lead) {
  const manualKey = canonicalLeadKey(nameArg, companyArg, linkedinArg);
  if (nameArg && companyArg && titleArg) {
    lead = {
      lead_key: manualKey,
      name: nameArg,
      company: companyArg,
      title: titleArg,
      linkedin_url: linkedinArg || "",
      signal_type: signalArg || "none",
      score: 1,
      qualification_status: "qualified",
      reason: "manual lead input"
    };
  }
}

if (!lead) {
  console.error("No lead found. Provide --registry or manual --name --company --title.");
  process.exit(1);
}

if (lead.qualification_status !== "qualified") {
  console.error(`Lead is not qualified (${lead.qualification_status}).`);
  process.exit(1);
}

const maxChars = settings.outreach.maxChars || 300;
const maxQuestions = settings.outreach.maxQuestions || 1;
const firstMessageNoPitch = settings.outreach.firstMessageNoPitch !== false;

const recentSignal = lead.signal_type && lead.signal_type !== "none"
  ? lead.signal_type
  : "their current role";

// Keep generation deterministic and editable in skill prompts.
function draftFromLead(record, angle = "default") {
  const opener = angle === "question"
    ? `${record.name.split(" ")[0]}, saw your work at ${record.company} around ${recentSignal}.`
    : `${record.name.split(" ")[0]}, noticed your work at ${record.company} and your focus on ${record.title}.`;

  const bridge = firstMessageNoPitch
    ? "Curious how your team is approaching priorities this quarter."
    : "I think there may be a relevant fit worth comparing.";

  const question = maxQuestions > 0
    ? "Open to a quick exchange?"
    : "";

  let text = `${opener} ${bridge} ${question}`.replace(/\s+/g, " ").trim();
  if (text.length > maxChars) {
    text = text.slice(0, maxChars - 1).trimEnd() + ".";
  }
  return text;
}

const draft = draftFromLead(lead, "default");
const variant = draftFromLead(lead, "question");

const now = new Date().toISOString();
const dateKey = formatDateKey();
const outDir = path.join(ROOT, "output", `outreach_${dateKey}`);
ensureDir(outDir);

const artifact = {
  lead_key: lead.lead_key,
  generated_at: now,
  source_registry: registryPath ? path.resolve(process.cwd(), registryPath) : "manual",
  draft,
  variant,
  signal_used: recentSignal,
  char_count: draft.length,
  voice_check: "references real role/company context and keeps first-touch tone concise",
  watch_for: "replace generic signal with specific post/job change when available",
  status: "drafted"
};

const safeLeadKey = lead.lead_key.replace(/[^a-z0-9_|-]/gi, "_");
const artifactPath = path.join(outDir, `draft_${safeLeadKey}_${dateKey}.json`);
writeJson(artifactPath, artifact);

const weekKey = getWeekKey();
if (state.weeklyMetrics.weekKey !== weekKey) {
  state.weeklyMetrics = {
    weekKey,
    leads_processed: 0,
    qualified_count: 0,
    drafted_count: 0,
    reply_drafts_count: 0,
    replied_count: 0,
    rejected_count: 0,
    score3_conversion_count: 0
  };
}

state.firstRunCompleted = true;
state.lastDraftRunAt = now;
state.lastSuccessfulRunAt = now;
state.weeklyMetrics.drafted_count += 1;
state.outreachRegistry = state.outreachRegistry || {};
state.outreachRegistry[lead.lead_key] = {
  lastDraftAt: now,
  lastDraftStatus: "drafted",
  source: artifact.source_registry,
  lastSignalType: recentSignal
};

writeJson(path.join(ROOT, "state", "linkedin-system-state.json"), state);

console.log(JSON.stringify({
  output: artifactPath,
  lead_key: lead.lead_key,
  draft_chars: draft.length,
  score: lead.score
}, null, 2));
