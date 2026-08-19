import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScores } from "../src/scoring.js";
import {
  evaluateIntegrationTier,
  evaluateValidationGateRisk,
  evaluatePreprocessingRequirements,
} from "../src/tiering.js";
import { instrument, respondent } from "./fixtures.js";

function discovery(overrides) {
  return {
    B2: [],
    B3: [],
    B4: "none",
    B6: [],
    B7: "barbados_grid",
    B8: "daily",
    B9: "internal",
    B10: ["nothing"],
    ...overrides,
  };
}

function evaluate(answersOverride) {
  const responses = [respondent({ id: "r1", roleBand: "operational", answers: discovery(answersOverride) })];
  const scores = computeScores(responses, instrument);
  return { tier: evaluateIntegrationTier(responses, instrument, scores), scores, responses };
}

test("Tier A: ArcGIS Online + already published, no other triggers", () => {
  const { tier } = evaluate({ B2: ["arcgis_online"], B9: "published" });
  assert.equal(tier.primary.tier, "A");
  assert.equal(tier.secondary, null);
});

test("Tier D: majority of key information on paper, pure", () => {
  const { tier } = evaluate({ B4: "almost_all" });
  assert.equal(tier.primary.tier, "D");
  assert.equal(tier.secondary, null);
});

test("Tier C: operational system present (SCADA), pure", () => {
  const { tier } = evaluate({ B2: ["scada"] });
  assert.equal(tier.primary.tier, "C");
  assert.equal(tier.secondary, null);
});

test("D and C both match: primary/secondary follow evaluation_order [D, C, A, B]", () => {
  const { tier } = evaluate({ B4: "half", B2: ["scada"] });
  assert.equal(tier.matches.length, 2);
  assert.equal(tier.primary.tier, "D");
  assert.equal(tier.secondary.tier, "C");
});

test("Default: no rule matches, falls back to Tier B", () => {
  const { tier } = evaluate({});
  assert.equal(tier.primary.tier, "B");
  assert.equal(tier.matches.length, 1);
});

test("Discovery answers aggregate across respondents (union for multi-select)", () => {
  const responses = [
    respondent({ id: "r1", roleBand: "operational", answers: discovery({ B2: ["arcgis_online"] }) }),
    respondent({ id: "r2", roleBand: "leadership", answers: discovery({ B2: [], B9: "published" }) }),
  ];
  const scores = computeScores(responses, instrument);
  const tier = evaluateIntegrationTier(responses, instrument, scores);
  // Neither respondent alone reports both facts; the agency-level union should.
  assert.equal(tier.primary.tier, "A");
});

test("validation gate V5 fires on low classification maturity + restricted data held", () => {
  const responses = [
    respondent({
      id: "r1",
      roleBand: "operational",
      overrides: { C12: 1 },
      answers: discovery({ B10: ["personal_data"] }),
    }),
  ];
  const scores = computeScores(responses, instrument);
  const gates = evaluateValidationGateRisk(responses, instrument, scores);
  const v5 = gates.find((g) => g.gate === "V5");
  assert.equal(v5.atRisk, true);
});

test("validation gate V5 does not fire when nothing restricted is held", () => {
  const responses = [
    respondent({
      id: "r1",
      roleBand: "operational",
      overrides: { C12: 1 },
      answers: discovery({ B10: ["nothing"] }),
    }),
  ];
  const scores = computeScores(responses, instrument);
  const gates = evaluateValidationGateRisk(responses, instrument, scores);
  const v5 = gates.find((g) => g.gate === "V5");
  assert.equal(v5.atRisk, false);
});

test("pre-processing requirements: paper digitisation triggers when B4 is not none", () => {
  const { scores, responses } = evaluate({ B4: "some" });
  const requirements = evaluatePreprocessingRequirements(responses, instrument, scores);
  assert.ok(requirements.includes("Digitisation of paper records"));
});

test("pre-processing requirements: CAD conversion triggers on AutoCAD usage", () => {
  const { scores, responses } = evaluate({ B2: ["autocad"] });
  const requirements = evaluatePreprocessingRequirements(responses, instrument, scores);
  assert.ok(requirements.includes("CAD to GIS conversion"));
});
