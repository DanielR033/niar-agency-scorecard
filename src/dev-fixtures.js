// Dev-only seeded response set so the reveal choreography and divergence
// cards can be tuned without a backend (CLAUDE.md Pass 3 instruction).
// Only ever loaded by facilitator.html when the 'local' adapter has zero
// real responses for the session — see the adapter-type guard there, not
// an "empty session" guard, so a real empty Wave 2 session never gets
// masked by this once Supabase is wired.
//
// Signal engineered on purpose, so the reveal has something real to show
// while tuning:
//   - Optimism Gap on governance_roles (leadership high, operational low)
//   - Hidden Capability on human_capacity (operational high, leadership low)
//   - Dispersion on C9 (metadata) — responses at 0, 3 and 5
//   - Baseline delta on tech_infrastructure (everyone scores it high)

const BASE = 2;

function respondent(id, roleBand, overrides, discoveryOverrides) {
  const answers = {};
  for (let i = 1; i <= 16; i++) answers[`C${i}`] = BASE;
  Object.assign(answers, overrides);
  Object.assign(answers, {
    B2: ["ms_office"],
    B3: ["shapefiles"],
    B4: "some",
    B6: [],
    B7: "wgs84",
    B8: "monthly",
    B9: "export_send",
    B10: ["nothing"],
    ...discoveryOverrides,
  });
  return { id, roleBand, answers };
}

export function generateFixtureResponses() {
  return [
    respondent("fixture-l1", "leadership", { C1: 5, C2: 5, C15: 5, C16: 1 }),
    respondent("fixture-l2", "leadership", { C1: 5, C2: 5, C15: 5, C16: 1, C9: 3 }),
    respondent("fixture-o1", "operational", { C1: 5, C2: 5, C15: 0, C16: 5, C9: 0 }, { B10: ["personal_data"], C12: 1 }),
    respondent("fixture-o2", "operational", { C1: 5, C2: 5, C15: 0, C16: 5 }),
    respondent("fixture-t1", "technical", { C1: 5, C2: 4, C9: 5 }, { B2: ["ms_office", "autocad"] }),
    respondent("fixture-u1", "unassigned", { C1: 4, C2: 5 }, { B4: "half" }),
  ];
}
