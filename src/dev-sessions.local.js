// Local-adapter-only stand-in for the Supabase `sessions` table. Maps a
// session code to the agency it's bound to (A1's "source": "session_config").
// Deleted once Pass 3 wires Supabase — never import this from anywhere but
// storage.js's 'local' branch. facilitator.html and index.html both get this
// data through storage.session(), never by importing this file directly.
//
// prior_scores/prior_assessed_at model the eventual Supabase `sessions` row
// shape for a re-baseline: an 8-key dimension-score map (the same keys
// computeScores() emits), not a re-derived response set — the prior
// assessment's numbers are already published in the Annex tables, so there
// is nothing to recompute, only to overlay.

export const DEV_SESSIONS = {
  DEMO: { agencyName: "Demo Agency", isRebaseline: false, priorScores: null, priorAssessedAt: null },
  MEB: {
    agencyName: "Ministry of Environment and Beautification",
    isRebaseline: false,
    priorScores: null,
    priorAssessedAt: null,
  },
  BSS: {
    agencyName: "Barbados Statistical Service",
    isRebaseline: false,
    priorScores: null,
    priorAssessedAt: null,
  },
  MTW: {
    agencyName: "Ministry of Transport and Works",
    isRebaseline: true,
    priorAssessedAt: "2023",
    priorScores: {
      tech_infrastructure: 1.5,
      interoperability: 1.0,
      data_management: 1.5,
      metadata_discoverability: 1.0,
      security_access: 2.0,
      operational_processes: 1.5,
      governance_roles: 1.0,
      human_capacity: 2.0,
    },
  },
};

export function lookupDevSession(sessionCode) {
  return DEV_SESSIONS[sessionCode?.toUpperCase()] ?? null;
}
