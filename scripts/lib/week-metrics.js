const { getWeekKey } = require("./io");

const DEFAULT_KEYS = [
  "leads_processed",
  "qualified_count",
  "drafted_count",
  "reply_drafts_count",
  "replied_count",
  "rejected_count",
  "score3_conversion_count"
];

/**
 * Ensures weeklyMetrics exists, resets when ISO week changes, backfills missing counters.
 */
function ensureWeekMetrics(state) {
  const weekKey = getWeekKey();
  const wm = state.weeklyMetrics;

  if (!wm || wm.weekKey !== weekKey) {
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
    return state;
  }

  DEFAULT_KEYS.forEach((k) => {
    if (typeof state.weeklyMetrics[k] !== "number" || Number.isNaN(state.weeklyMetrics[k])) {
      state.weeklyMetrics[k] = 0;
    }
  });
  return state;
}

module.exports = {
  ensureWeekMetrics
};
