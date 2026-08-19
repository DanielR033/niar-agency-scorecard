// Collapses per-respondent Block B (Discovery) answers into a single
// agency-level answer set, because the tier, validation-gate and
// pre-processing rules in questions.json are written as agency-level
// facts ("does the agency run X") but every respondent answers Block B
// individually in a live session.
//
// This aggregation strategy is not specified anywhere in spec.md or
// questions.json — it is a Pass 1 judgment call, made explicit here so it
// can be reviewed and overridden field-by-field rather than buried in
// scoring logic. Each strategy below is chosen from metadata that already
// exists on the option (paper_weight, tier_signal) rather than an invented
// number.

function unionOfMultiSelect(responses, field) {
  const set = new Set();
  for (const r of responses) {
    const value = r.answers[field];
    if (Array.isArray(value)) value.forEach((v) => set.add(v));
  }
  return [...set];
}

function worstCaseBySeverity(responses, field, instrument, severityField) {
  let best = null;
  let bestSeverity = -Infinity;
  for (const r of responses) {
    const value = r.answers[field];
    if (value === undefined) continue;
    const severity = instrument.optionIndex.get(`${field}:${value}`)?.[severityField] ?? -Infinity;
    if (severity > bestSeverity) {
      bestSeverity = severity;
      best = value;
    }
  }
  return best;
}

function mode(counts, fallbackWhenMixed) {
  if (counts.size === 0) return undefined;
  if (counts.size === 1) return [...counts.keys()][0];
  const max = Math.max(...counts.values());
  const winners = [...counts.entries()].filter(([, c]) => c === max);
  if (winners.length === 1) return winners[0][0];
  return fallbackWhenMixed;
}

export function aggregateAgencyAnswers(responses, instrument) {
  return {
    B2: unionOfMultiSelect(responses, "B2"),
    B3: unionOfMultiSelect(responses, "B3"),
    B3b: unionOfMultiSelect(responses, "B3b"),
    B4: worstCaseBySeverity(responses, "B4", instrument, "paper_weight"),
    B6: unionOfMultiSelect(responses, "B6"),
    // B7 has an explicit 'varies' option — reuse it as the mixed-answer signal.
    B7: mode(countOf(responses, "B7"), "varies"),
    B8: mode(countOf(responses, "B8"), mostSevereFreshness(responses)),
    B9: anyPublishedElseMode(responses, instrument),
    B10: unionOfMultiSelect(responses, "B10"),
  };
}

function countOf(responses, field) {
  const counts = new Map();
  for (const r of responses) {
    const value = r.answers[field];
    if (value !== undefined) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function mostSevereFreshness(responses) {
  // No inherent order is defined for B8; when respondents disagree with no
  // majority, fall back to the least-fresh answer actually given.
  const order = ["project", "yearly", "quarterly", "monthly", "weekly", "daily"];
  let worst;
  for (const r of responses) {
    const value = r.answers.B8;
    if (value && (worst === undefined || order.indexOf(value) < order.indexOf(worst))) {
      worst = value;
    }
  }
  return worst;
}

function anyPublishedElseMode(responses, instrument) {
  for (const r of responses) {
    const value = r.answers.B9;
    if (value !== undefined && instrument.optionIndex.get(`B9:${value}`)?.tier_signal === "A") {
      return value;
    }
  }
  return mode(countOf(responses, "B9"));
}
