// Derivations read from the Discovery block (B) and Block C item means:
// integration tier (A/B/C/D), validation-gate risk (V1-V5), pre-processing
// requirements. All three are evaluated the same way — parse the condition
// string from questions.json's `derivations` and run it against an
// agency-level context — so they live together rather than being split
// across files not named in CLAUDE.md's architecture list.

import { evaluateCondition, extractThreshold } from "./conditions.js";
import { aggregateAgencyAnswers } from "./aggregate.js";

function buildContext(agencyAnswers, itemStats, instrument) {
  return {
    getAnswer(field) {
      if (field in agencyAnswers) return agencyAnswers[field];
      const item = itemStats[field];
      return item ? item.mean : undefined;
    },
    resolveOptionField(field, value, attr) {
      return instrument.optionIndex.get(`${field}:${value}`)?.[attr];
    },
  };
}

export function evaluateIntegrationTier(responses, instrument, scores) {
  const agencyAnswers = aggregateAgencyAnswers(responses, instrument);
  const context = buildContext(agencyAnswers, scores.itemStats, instrument);
  const { evaluation_order, rules } = instrument.derivations.integration_tier;

  const rulesByTier = new Map(rules.map((r) => [r.tier, r]));
  const matches = [];
  for (const tier of evaluation_order) {
    const rule = rulesByTier.get(tier);
    if (!rule) continue;
    if (rule.condition === "default") continue; // only used if nothing else matched
    if (evaluateCondition(rule.condition, context)) {
      matches.push({ tier: rule.tier, label: rule.label, implication: rule.implication });
    }
  }

  if (matches.length === 0) {
    const fallback = rules.find((r) => r.condition === "default");
    if (fallback) matches.push({ tier: fallback.tier, label: fallback.label, implication: fallback.implication });
  }

  return {
    matches,
    primary: matches[0] ?? null,
    secondary: matches[1] ?? null,
  };
}

export function evaluateValidationGateRisk(responses, instrument, scores) {
  const agencyAnswers = aggregateAgencyAnswers(responses, instrument);
  const context = buildContext(agencyAnswers, scores.itemStats, instrument);
  const { gates } = instrument.derivations.validation_gate_risk;

  return gates.map((gate) => ({
    gate: gate.gate,
    type: gate.type,
    atRisk: evaluateCondition(gate.risk_signal, context),
  }));
}

export function evaluatePreprocessingRequirements(responses, instrument, scores) {
  const agencyAnswers = aggregateAgencyAnswers(responses, instrument);
  const context = buildContext(agencyAnswers, scores.itemStats, instrument);

  return instrument.derivations.preprocessing_requirements
    .filter((r) => evaluateCondition(r.trigger, context))
    .map((r) => r.requirement);
}

// Exported for tests / callers that want the raw threshold extraction
// behaviour without re-deriving it from the condition string themselves.
export { extractThreshold };
