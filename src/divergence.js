// Optimism Gap / Hidden Capability / Dispersion / Baseline delta.
// Thresholds (1.5, 2, 1.0) and the baseline value (2.1) are read out of
// src/questions.json, never retyped here — see extractThreshold in
// conditions.js.

import { extractThreshold } from "./conditions.js";
import { round } from "./instrument.js";

function findReading(instrument, id) {
  return instrument.derivations.divergence.readings.find((r) => r.id === id);
}

function optimismAndHiddenCapability(instrument, scores) {
  const leadership = scores.byRoleBand.leadership;
  const operational = scores.byRoleBand.operational;
  if (leadership.respondentCount === 0 || operational.respondentCount === 0) return [];

  const optimismThreshold = extractThreshold(findReading(instrument, "optimism_gap").condition);
  const hiddenThreshold = extractThreshold(findReading(instrument, "hidden_capability").condition);

  const findings = [];
  for (const dimensionId of instrument.dimensionIds) {
    const leaderScore = leadership.dimensionScores[dimensionId];
    const opsScore = operational.dimensionScores[dimensionId];
    if (leaderScore === null || opsScore === null) continue;

    const gap = round(leaderScore - opsScore, instrument.scoring.rounding);
    if (gap >= optimismThreshold) {
      findings.push({
        id: "optimism_gap",
        dimension: dimensionId,
        leadershipScore: leaderScore,
        operationalScore: opsScore,
        gap,
        label: findReading(instrument, "optimism_gap").label,
        interpretation: findReading(instrument, "optimism_gap").interpretation,
        probe: findReading(instrument, "optimism_gap").probe_template,
      });
    } else if (-gap >= hiddenThreshold) {
      findings.push({
        id: "hidden_capability",
        dimension: dimensionId,
        leadershipScore: leaderScore,
        operationalScore: opsScore,
        gap: -gap,
        label: findReading(instrument, "hidden_capability").label,
        interpretation: findReading(instrument, "hidden_capability").interpretation,
        probe: findReading(instrument, "hidden_capability").probe_template,
      });
    }
  }
  return findings;
}

function dispersion(instrument, scores) {
  const reading = findReading(instrument, "dispersion");
  const threshold = extractThreshold(reading.condition);

  const findings = [];
  for (const [itemId, stat] of Object.entries(scores.itemStats)) {
    if (stat.range === null) continue;
    if (stat.range >= threshold) {
      findings.push({
        id: "dispersion",
        item: itemId,
        min: stat.min,
        max: stat.max,
        range: stat.range,
        label: reading.label,
        interpretation: reading.interpretation,
        probe: reading.probe_template,
      });
    }
  }
  return findings;
}

function baselineDelta(instrument, scores) {
  const reading = findReading(instrument, "baseline_delta");
  const threshold = extractThreshold(reading.condition);
  const baseline = instrument.scoring.baseline_overlay;

  const findings = [];
  for (const [dimensionId, score] of Object.entries(scores.dimensionScores)) {
    if (score === null) continue;
    const delta = round(score - baseline, instrument.scoring.rounding);
    if (Math.abs(delta) >= threshold) {
      findings.push({
        id: "baseline_delta",
        dimension: dimensionId,
        agencyScore: score,
        baseline,
        delta,
        label: reading.label,
        interpretation: reading.interpretation,
        probe: reading.probe_template,
      });
    }
  }
  return findings;
}

export function computeDivergence(responses, instrument, scores) {
  const all = [
    ...optimismAndHiddenCapability(instrument, scores),
    ...dispersion(instrument, scores),
    ...baselineDelta(instrument, scores),
  ];

  const { top_n, priority } = instrument.derivations.divergence.facilitator_display;
  const sorted = [...all].sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id));

  return {
    all: sorted,
    top: sorted.slice(0, top_n),
  };
}
