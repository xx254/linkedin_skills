/**
 * Heuristic classification for prospect replies (matches reply-handler SKILL types).
 */

function normalize(text) {
  return String(text || "")
    .trim()
    .toLowerCase();
}

function classifyProspectReply(text) {
  const t = normalize(text);
  if (!t) {
    return { type: "irrelevant", confidence: "low" };
  }

  if (
    /\b(unsubscribe|remove me|stop|not interested|no thanks|don't contact)\b/.test(t)
  ) {
    return { type: "not_interested", confidence: "high" };
  }

  if (/\b(we use|using|already have|competitor|vs\.?|compared to)\b/.test(t)) {
    return { type: "competitor_mention", confidence: "medium" };
  }

  if (/\?|how much|pricing|cost|what is|can you|could you|tell me how/.test(t)) {
    return { type: "question", confidence: "medium" };
  }

  if (
    /\b(too busy|not the right time|maybe later|not now|circle back|reach out later)\b/.test(
      t
    )
  ) {
    return { type: "hesitant", confidence: "medium" };
  }

  if (
    /\b(tell me more|sounds good|interested|curious|love to|let's|schedule|book)\b/.test(
      t
    )
  ) {
    return { type: "interested", confidence: "medium" };
  }

  if (/\b(interesting|cool|nice|thanks)\b/.test(t) && t.length < 120) {
    return { type: "positive_but_vague", confidence: "low" };
  }

  return { type: "irrelevant", confidence: "low" };
}

module.exports = {
  classifyProspectReply,
  normalize
};
