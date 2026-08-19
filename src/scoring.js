// 0-5 item scores -> 8 dimension scores -> agency score.
// Unweighted mean throughout, per CLAUDE.md — do not add weighting here.

import { round } from "./instrument.js";

// responses: [{ id, roleBand, answers: { C1: 3, C2: 4, ..., B4: 'half', ... } }]
// roleBand is one of 'leadership' | 'technical' | 'operational' | 'unassigned'.

function computeItemStats(responses, blockCQuestions) {
  const stats = new Map();
  for (const { id } of blockCQuestions) {
    const scores = responses
      .map((r) => r.answers[id])
      .filter((v) => typeof v === "number");
    if (scores.length === 0) {
      stats.set(id, { mean: null, min: null, max: null, range: null, count: 0, scores: [] });
      continue;
    }
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    stats.set(id, { mean, min, max, range: max - min, count: scores.length, scores });
  }
  return stats;
}

function computeDimensionScores(itemStats, instrument) {
  const scores = {};
  for (const dimensionId of instrument.dimensionIds) {
    const itemIds = instrument.dimensionQuestionIds.get(dimensionId) ?? [];
    const means = itemIds.map((id) => itemStats.get(id)?.mean).filter((m) => m !== null && m !== undefined);
    scores[dimensionId] = means.length ? round(means.reduce((a, b) => a + b, 0) / means.length, instrument.scoring.rounding) : null;
  }
  return scores;
}

function computeAgencyScore(dimensionScores, instrument) {
  const values = Object.values(dimensionScores).filter((v) => v !== null);
  if (values.length === 0) return null;
  return round(values.reduce((a, b) => a + b, 0) / values.length, instrument.scoring.rounding);
}

const ROLE_BANDS = ["leadership", "technical", "operational", "unassigned"];

export function computeScores(responses, instrument) {
  const itemStats = computeItemStats(responses, instrument.blockCQuestions);
  const dimensionScores = computeDimensionScores(itemStats, instrument);
  const agencyScore = computeAgencyScore(dimensionScores, instrument);

  const byRoleBand = {};
  for (const band of ROLE_BANDS) {
    const bandResponses = responses.filter((r) => r.roleBand === band);
    const bandItemStats = computeItemStats(bandResponses, instrument.blockCQuestions);
    const bandDimensionScores = computeDimensionScores(bandItemStats, instrument);
    byRoleBand[band] = {
      respondentCount: bandResponses.length,
      dimensionScores: bandDimensionScores,
    };
  }

  return {
    itemStats: Object.fromEntries(itemStats),
    dimensionScores,
    agencyScore,
    respondentCount: responses.length,
    byRoleBand,
  };
}
