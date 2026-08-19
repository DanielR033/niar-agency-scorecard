import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScores } from "../src/scoring.js";
import { computeDivergence } from "../src/divergence.js";
import { instrument, respondent } from "./fixtures.js";

test("Optimism Gap: leadership scores materially above operational on the same dimension", () => {
  const responses = [
    respondent({ id: "r1", roleBand: "leadership", baseline: 4.5, overrides: { C15: 5 } }),
    respondent({ id: "r2", roleBand: "operational", baseline: 4.5, overrides: { C15: 1 } }),
  ];
  const scores = computeScores(responses, instrument);
  const divergence = computeDivergence(responses, instrument, scores);
  const finding = divergence.all.find((f) => f.id === "optimism_gap" && f.dimension === "governance_roles");
  assert.ok(finding, "expected an optimism_gap finding on governance_roles");
  assert.equal(finding.gap, 4);
});

test("Hidden Capability: operational scores materially above leadership on the same dimension", () => {
  const responses = [
    respondent({ id: "r1", roleBand: "leadership", baseline: 4.5, overrides: { C16: 0 } }),
    respondent({ id: "r2", roleBand: "operational", baseline: 4.5, overrides: { C16: 5 } }),
  ];
  const scores = computeScores(responses, instrument);
  const divergence = computeDivergence(responses, instrument, scores);
  const finding = divergence.all.find((f) => f.id === "hidden_capability" && f.dimension === "human_capacity");
  assert.ok(finding, "expected a hidden_capability finding on human_capacity");
});

test("no Optimism Gap or Hidden Capability when a role band has zero respondents", () => {
  const responses = [respondent({ id: "r1", roleBand: "operational", baseline: 3 })];
  const scores = computeScores(responses, instrument);
  const divergence = computeDivergence(responses, instrument, scores);
  assert.equal(divergence.all.filter((f) => f.id === "optimism_gap" || f.id === "hidden_capability").length, 0);
});

test("Dispersion: range of 2 or more on the same item across any respondents", () => {
  const responses = [
    respondent({ id: "r1", roleBand: "operational", baseline: 3, overrides: { C9: 5 } }),
    respondent({ id: "r2", roleBand: "technical", baseline: 3, overrides: { C9: 0 } }),
    respondent({ id: "r3", roleBand: "leadership", baseline: 3, overrides: { C9: 3 } }),
  ];
  const scores = computeScores(responses, instrument);
  const divergence = computeDivergence(responses, instrument, scores);
  const finding = divergence.all.find((f) => f.id === "dispersion" && f.item === "C9");
  assert.ok(finding);
  assert.equal(finding.range, 5);
});

test("Baseline delta: agency dimension score far from the 2.1 ecosystem baseline", () => {
  const responses = [respondent({ id: "r1", roleBand: "operational", baseline: 5 })];
  const scores = computeScores(responses, instrument);
  const divergence = computeDivergence(responses, instrument, scores);
  const finding = divergence.all.find((f) => f.id === "baseline_delta" && f.dimension === "tech_infrastructure");
  assert.ok(finding);
  assert.equal(finding.delta, 2.9);
});

test("facilitator top-3 respects the configured priority order and cap", () => {
  const responses = [
    respondent({ id: "r1", roleBand: "leadership", baseline: 4.5, overrides: { C15: 5, C16: 5 } }),
    respondent({ id: "r2", roleBand: "operational", baseline: 4.5, overrides: { C15: 1, C16: 1 } }),
    respondent({ id: "r3", roleBand: "technical", baseline: 3, overrides: { C9: 5 } }),
    respondent({ id: "r4", roleBand: "technical", baseline: 3, overrides: { C9: 0 } }),
  ];
  const scores = computeScores(responses, instrument);
  const divergence = computeDivergence(responses, instrument, scores);
  const { priority, top_n } = instrument.derivations.divergence.facilitator_display;
  assert.ok(divergence.top.length <= top_n);
  for (let i = 1; i < divergence.top.length; i++) {
    assert.ok(priority.indexOf(divergence.top[i - 1].id) <= priority.indexOf(divergence.top[i].id));
  }
});
