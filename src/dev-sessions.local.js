// Local-adapter-only stand-in for the Supabase `sessions` table. Maps a
// session code to the agency it's bound to (A1's "source": "session_config").
// Deleted once Pass 3 wires Supabase — never import this from anywhere but
// storage.js's 'local' branch, and never from facilitator.html.

export const DEV_SESSIONS = {
  DEMO: { agencyName: "Demo Agency", isRebaseline: false },
  MEB: { agencyName: "Ministry of Environment and Beautification", isRebaseline: false },
  BSS: { agencyName: "Barbados Statistical Service", isRebaseline: false },
  MTW: { agencyName: "Ministry of Transport and Works", isRebaseline: true },
};

export function lookupDevSession(sessionCode) {
  return DEV_SESSIONS[sessionCode?.toUpperCase()] ?? null;
}
