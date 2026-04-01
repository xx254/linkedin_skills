#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { parseCsv, toCsv } = require("./lib/csv");
const {
  readJson,
  writeJson,
  writeText,
  ensureDir,
  formatDateKey,
  getWeekKey
} = require("./lib/io");

const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const inputFile = args[0] ? path.resolve(process.cwd(), args[0]) : path.join(ROOT, "sample_contacts.csv");

const settings = readJson(path.join(ROOT, "state", "linkedin-settings.json"), null);
const systemState = readJson(path.join(ROOT, "state", "linkedin-system-state.json"), null);
const competitorProfile = readJson(path.join(ROOT, "state", "competitor-profile.json"), null);
if (!settings || !systemState) {
  console.error("Missing state files. Run: node scripts/bootstrap-system.js");
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Input file not found: ${inputFile}`);
  process.exit(1);
}

const csvRaw = fs.readFileSync(inputFile, "utf8");
const { headers, records } = parseCsv(csvRaw);

if (!headers.length || !records.length) {
  console.error("CSV is empty or invalid.");
  process.exit(1);
}

const dateKey = formatDateKey();
const runAt = new Date().toISOString();
const outDir = path.join(ROOT, "output", `leads_${dateKey}`);
ensureDir(outDir);

const qualified = [];
const competitors = [];
const nonDecisionMakers = [];
const b2cFocused = [];
const noOutboundIntent = [];
const violations = [];

const dedupeMap = new Map();
const concerns = [];
let duplicateCount = 0;

function pick(record, keys) {
  for (const key of keys) {
    if (record[key] && record[key].trim()) {
      return record[key].trim();
    }
  }
  return "";
}

function normalize(text) {
  return String(text || "").trim();
}

function lower(text) {
  return normalize(text).toLowerCase();
}

function leadKey(name, company, linkedinUrl) {
  const urlPart = normalize(linkedinUrl) || "missing_url";
  return lower(`${normalize(name)}|${normalize(company)}|${urlPart}`);
}

function detectSignal(record) {
  const src = lower(record["Source Post"] || "");
  const imported = normalize(record["Imported At"]);
  if (src) {
    return "recent_post";
  }
  if (imported) {
    return "recent_import";
  }
  return "";
}

function scoreFromSignals(signalType, title) {
  const t = lower(title);
  const hasStrongRole = /(vp|vice president|head|director|chief|founder|owner|co-founder|ceo|cmo)/.test(t);
  if (signalType === "recent_post" && hasStrongRole) {
    return 3;
  }
  if (signalType && hasStrongRole) {
    return 2;
  }
  return 1;
}

function disqualifyCategory(record, title, company, industry, about) {
  const t = lower(title);
  const c = lower(company);
  const i = lower(industry);
  const a = lower(about);
  const activeCategories = new Set((settings.qualification.disqualifyCategories || []).map((v) => lower(v)));
  const roleExcludes = (settings.targetMarket.alwaysExcludeRoles || []).map((v) => lower(v));
  const companyExcludes = (settings.targetMarket.alwaysExcludeCompanyTypes || []).map((v) => lower(v));
  const competitorCompanyKw = (competitorProfile ? competitorProfile.companyKeywords || [] : []).map((v) => lower(v));
  const competitorIndustryKw = (competitorProfile ? competitorProfile.industryKeywords || [] : []).map((v) => lower(v));
  const competitorServiceKw = (competitorProfile ? competitorProfile.serviceKeywords || [] : []).map((v) => lower(v));
  const allCompetitorCompanyKw = [...new Set([...companyExcludes, ...competitorCompanyKw])];

  if (activeCategories.has("non_decision_makers") && (
    /student|intern|assistant|junior/.test(t) ||
    roleExcludes.some((r) => r && t.includes(r))
  )) {
    return "non_decision_makers";
  }

  if (activeCategories.has("competitors") && (
    allCompetitorCompanyKw.some((k) => k && c.includes(k)) ||
    competitorIndustryKw.some((k) => k && i.includes(k)) ||
    competitorServiceKw.some((k) => k && a.includes(k))
  )) {
    return "competitors";
  }

  if (activeCategories.has("b2c_focused") &&
    /consumer|retail|b2c/.test(i) && !/b2b|software|saas|services/.test(i)) {
    return "b2c_focused";
  }

  if (activeCategories.has("no_outbound_intent") &&
    /engineer|developer|support|it admin|back office/.test(t) && !/head|director|vp|chief/.test(t)) {
    return "no_outbound_intent";
  }

  return "";
}

const targetIndustries = settings.targetMarket.industries || [];

records.forEach((record) => {
  const first = pick(record, ["First Name", "FirstName", "Name"]);
  const last = pick(record, ["Last Name", "LastName"]);
  const name = normalize(`${first} ${last}`.trim() || pick(record, ["Name"]));
  const title = pick(record, ["Job Title", "Position", "Title"]);
  const company = pick(record, ["Company"]);
  const industry = pick(record, ["Industry"]);
  const location = pick(record, ["Location", "Geography"]);
  const linkedinUrl = pick(record, ["LinkedIn URL", "Linkedin URL", "LinkedIn"]);
  const about = pick(record, ["About", "Bio", "Summary", "Company Description", "Description"]);
  const signalType = detectSignal(record);

  const missingRequired = [];
  if (!name) missingRequired.push("name");
  if (!title) missingRequired.push("title");
  if (!company) missingRequired.push("company");

  const key = leadKey(name, company, linkedinUrl);

  if (missingRequired.length) {
    violations.push({
      lead_key: key,
      Name: name,
      Title: title,
      Company: company,
      "LinkedIn URL": linkedinUrl,
      Violation: `missing required: ${missingRequired.join(", ")}`
    });
    return;
  }

  const category = disqualifyCategory(record, title, company, industry, about);
  const industryOk = !targetIndustries.length || targetIndustries.some((t) => lower(industry).includes(lower(t)));
  const geoTargets = settings.targetMarket.geographies || [];
  const geoOk = !geoTargets.length || geoTargets.some((g) => lower(location).includes(lower(g)));
  const shouldDisqualifyForTargeting = !industryOk || !geoOk;

  let qualificationStatus = "qualified";
  let reason = "meets ICP";
  let score = scoreFromSignals(signalType, title);

  if (category) {
    qualificationStatus = category;
    reason = `disqualified: ${category}`;
    score = 0;
  } else if (shouldDisqualifyForTargeting) {
    qualificationStatus = "no_outbound_intent";
    reason = "industry/geography mismatch";
    score = 0;
  } else if (!signalType) {
    reason = "qualified, no clear signal";
    score = 1;
  }

  const leadRecord = {
    lead_key: key,
    name,
    title,
    company,
    linkedin_url: linkedinUrl,
    location,
    industry,
    qualification_status: qualificationStatus,
    score,
    signal_type: signalType || "none",
    reason,
    last_scored_at: runAt,
    source_file: inputFile
  };

  const existing = dedupeMap.get(key);
  if (existing) {
    duplicateCount += 1;
    if (leadRecord.score > existing.score) {
      dedupeMap.set(key, leadRecord);
    }
  } else {
    dedupeMap.set(key, leadRecord);
  }
});

if (duplicateCount) {
  concerns.push(`duplicate lead rows merged: ${duplicateCount}`);
}

for (const leadRecord of dedupeMap.values()) {
  const rowBase = {
    Name: leadRecord.name,
    Title: leadRecord.title,
    Company: leadRecord.company,
    "LinkedIn URL": leadRecord.linkedin_url,
    "Signal Type": leadRecord.signal_type,
    Score: leadRecord.score,
    "Reason Qualified": leadRecord.reason,
    "Reason Disqualified": leadRecord.reason
  };

  if (leadRecord.qualification_status === "qualified") {
    qualified.push(rowBase);
  } else if (leadRecord.qualification_status === "competitors") {
    competitors.push(rowBase);
  } else if (leadRecord.qualification_status === "non_decision_makers") {
    nonDecisionMakers.push(rowBase);
  } else if (leadRecord.qualification_status === "b2c_focused") {
    b2cFocused.push(rowBase);
  } else {
    noOutboundIntent.push(rowBase);
  }
}

const qualifiedHeaders = ["Name", "Title", "Company", "LinkedIn URL", "Signal Type", "Score", "Reason Qualified"];
const disqualHeaders = ["Name", "Title", "Company", "LinkedIn URL", "Reason Disqualified"];
const violationHeaders = ["lead_key", "Name", "Title", "Company", "LinkedIn URL", "Violation"];

writeText(path.join(outDir, `qualified_leads_${dateKey}.csv`), toCsv(qualifiedHeaders, qualified));
writeText(path.join(outDir, `competitors_${dateKey}.csv`), toCsv(disqualHeaders, competitors));
writeText(path.join(outDir, `non_decision_makers_${dateKey}.csv`), toCsv(disqualHeaders, nonDecisionMakers));
writeText(path.join(outDir, `b2c_focused_${dateKey}.csv`), toCsv(disqualHeaders, b2cFocused));
writeText(path.join(outDir, `no_outbound_intent_${dateKey}.csv`), toCsv(disqualHeaders, noOutboundIntent));
if (violations.length) {
  writeText(path.join(outDir, `contract_violations_${dateKey}.csv`), toCsv(violationHeaders, violations));
}

const registry = {
  generated_at: runAt,
  source_file: inputFile,
  concerns,
  leads: Array.from(dedupeMap.values())
};
writeJson(path.join(outDir, `lead_registry_${dateKey}.json`), registry);

const weekKey = getWeekKey();
if (systemState.weeklyMetrics.weekKey !== weekKey) {
  systemState.weeklyMetrics = {
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

systemState.firstRunCompleted = true;
systemState.lastLeadFilterRunAt = runAt;
systemState.lastSuccessfulRunAt = runAt;
systemState.weeklyMetrics.leads_processed += records.length;
systemState.weeklyMetrics.qualified_count += qualified.length;

systemState.leadRegistry = systemState.leadRegistry || {};
registry.leads.forEach((leadRecord) => {
  systemState.leadRegistry[leadRecord.lead_key] = {
    score: leadRecord.score,
    qualification_status: leadRecord.qualification_status,
    reason: leadRecord.reason,
    signal_type: leadRecord.signal_type,
    last_scored_at: leadRecord.last_scored_at,
    company: leadRecord.company,
    title: leadRecord.title,
    name: leadRecord.name
  };
});

writeJson(path.join(ROOT, "state", "linkedin-system-state.json"), systemState);

const summary = {
  inputFile,
  outputDir: outDir,
  total: records.length,
  qualified: qualified.length,
  disqualified: competitors.length + nonDecisionMakers.length + b2cFocused.length + noOutboundIntent.length,
  competitors: competitors.length,
  non_decision_makers: nonDecisionMakers.length,
  b2c_focused: b2cFocused.length,
  no_outbound_intent: noOutboundIntent.length,
  contract_violations: violations.length,
  concerns
};

console.log(JSON.stringify(summary, null, 2));
