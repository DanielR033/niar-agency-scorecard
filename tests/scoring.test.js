import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScores } from "../src/scoring.js";
import { instrument, respondent } from "./fixtures.js";

test("dimension score is the unweighted mean of its item means", () => {
  const responses = [
    respondent({ id: "r1", roleBand: "operational", baseline: 2, overrides: { C1: 4, C2: 2 } }),
    respondent({ id: "r2", roleBand: "operational", baseline: 2, overrides: { C1: 2, C2: 4 } }),
  ];
  const scores = computeScores(responses, instrument);
  // tech_infrastructure = mean(C1, C2) item-means = mean(mean(4,2), mean(2,4)) = mean(3,3) = 3
  assert.equal(scores.dimensionScores.tech_infrastructure, 3);
});

test("agency score is the unweighted mean of the eight dimension scores", () => {
  const responses = [respondent({ id: "r1", roleBand: "leadership", baseline: 4 })];
  const scores = computeScores(responses, instrument);
  assert.equal(instrument.dimensionIds.length, 8);
  for (const d of instrument.dimensionIds) assert.equal(scores.dimensionScores[d], 4);
  assert.equal(scores.agencyScore, 4);
});

test("rounds to one decimal place", () => {
  const responses = [
    respondent({ id: "r1", roleBand: "operational", overrides: { C1: 3 } }),
    respondent({ id: "r2", roleBand: "operational", overrides: { C1: 4 } }),
    respondent({ id: "r3", roleBand: "operational", overrides: { C1: 4 } }),
  ];
  const scores = computeScores(responses, instrument);
  // C1 mean = (3+4+4)/3 = 3.6666... -> item mean feeds tech_infrastructure with C2 flat at 3
  // tech_infrastructure = mean(3.6667, 3) = 3.3333... -> rounds to 3.3
  assert.equal(scores.dimensionScores.tech_infrastructure, 3.3);
});

test("role-band scores are isolated per band and respondent counts are exact", () => {
  const responses = [
    respondent({ id: "r1", roleBand: "leadership", baseline: 5 }),
    respondent({ id: "r2", roleBand: "operational", baseline: 1 }),
    respondent({ id: "r3", roleBand: "technical", baseline: 3 }),
  ];
  const scores = computeScores(responses, instrument);
  assert.equal(scores.byRoleBand.leadership.respondentCount, 1);
  assert.equal(scores.byRoleBand.operational.respondentCount, 1);
  assert.equal(scores.byRoleBand.technical.respondentCount, 1);
  assert.equal(scores.byRoleBand.unassigned.respondentCount, 0);
  assert.equal(scores.byRoleBand.leadership.dimensionScores.human_capacity, 5);
  assert.equal(scores.byRoleBand.operational.dimensionScores.human_capacity, 1);
});

test("an empty role band produces null dimension scores, not an error", () => {
  const responses = [respondent({ id: "r1", roleBand: "operational", baseline: 3 })];
  const scores = computeScores(responses, instrument);
  assert.equal(scores.byRoleBand.leadership.respondentCount, 0);
  for (const d of instrument.dimensionIds) {
    assert.equal(scores.byRoleBand.leadership.dimensionScores[d], null);
  }
});
