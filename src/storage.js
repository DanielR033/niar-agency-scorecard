// Storage adapter: 'local' | 'supabase'. Both implement the same contract
// so form.js and dashboard.js never branch on which one is active.
//
// submit() contract (shared by every adapter):
//   { status: 'ok' }
//   { status: 'queued-local', code: string }   // held in this browser after
//                                                // retries failed; facilitator
//                                                // enters `code` by hand.
// This shape was exercised in Pass 2 via `simulateFailureRate` on the local
// adapter so the fallback-code UI was built and tested before Supabase
// existed — the supabase adapter honours the same option for the same
// reason (demoing/testing the fallback path without needing a real outage).
//
// session() returns { agencyName, isRebaseline, priorScores, priorAssessedAt }
// or null. listResponses() returns [{ id, sessionCode, roleBand, answers,
// submittedAt }]. Both facilitator-only methods (listResponses,
// promoteFallback) require a facilitatorKey on the supabase adapter — see
// supabase/schema.sql's get_session_responses.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I — read aloud on a call

function generateFallbackCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------
// local — no backend. Everything lives in this browser's localStorage.
// ---------------------------------------------------------------------

function localAdapter({ sessionCode, simulateFailureRate = 0, submitAttempts = 3 }) {
  const draftKey = `niar:${sessionCode}:draft`;
  const responsesKey = `niar:${sessionCode}:responses`;
  const fallbackKey = `niar:${sessionCode}:fallback`;

  function attemptSubmit(payload) {
    if (Math.random() < simulateFailureRate) {
      return Promise.reject(new Error("simulated submission failure"));
    }
    const responses = readJSON(responsesKey, []);
    responses.push({ ...payload, submittedAt: Date.now() });
    localStorage.setItem(responsesKey, JSON.stringify(responses));
    return Promise.resolve();
  }

  return {
    async session() {
      const { lookupDevSession } = await import("./dev-sessions.local.js");
      return lookupDevSession(sessionCode);
    },

    saveDraft(answers) {
      localStorage.setItem(draftKey, JSON.stringify({ answers, savedAt: Date.now() }));
    },

    loadDraft() {
      return readJSON(draftKey, null);
    },

    clearDraft() {
      localStorage.removeItem(draftKey);
    },

    async submit(payload) {
      for (let attempt = 0; attempt < submitAttempts; attempt++) {
        try {
          await attemptSubmit(payload);
          this.clearDraft();
          return { status: "ok" };
        } catch {
          // retry
        }
      }
      const code = generateFallbackCode();
      const held = readJSON(fallbackKey, {});
      held[code] = { ...payload, heldAt: Date.now() };
      localStorage.setItem(fallbackKey, JSON.stringify(held));
      this.clearDraft();
      return { status: "queued-local", code };
    },

    // facilitator.html only, from here down.

    async listResponses() {
      return readJSON(responsesKey, []);
    },

    listPendingFallbackCodes() {
      return Object.keys(readJSON(fallbackKey, {}));
    },

    async promoteFallback(code) {
      const held = readJSON(fallbackKey, {});
      const payload = held[code];
      if (!payload) return { status: "not-found" };
      const { heldAt, ...responsePayload } = payload;
      await attemptSubmit(responsePayload);
      delete held[code];
      localStorage.setItem(fallbackKey, JSON.stringify(held));
      return { status: "ok" };
    },
  };
}

// ---------------------------------------------------------------------
// supabase — draft autosave still lives in localStorage (it's this
// browser's in-progress work, not aggregate data); everything else goes
// through the REST API per supabase/schema.sql's RLS + RPCs.
// ---------------------------------------------------------------------

function supabaseAdapter({
  sessionCode,
  facilitatorKey = null,
  projectUrl,
  anonKey,
  simulateFailureRate = 0,
  submitAttempts = 3,
}) {
  const draftKey = `niar:${sessionCode}:draft`;
  const fallbackKey = `niar:${sessionCode}:fallback`;
  const restUrl = `${projectUrl}/rest/v1`;
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };

  async function callRpc(name, body) {
    const res = await fetch(`${restUrl}/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Supabase RPC ${name} failed: ${res.status}`);
    return res.json();
  }

  async function insertResponse(payload) {
    if (Math.random() < simulateFailureRate) {
      throw new Error("simulated submission failure");
    }
    const res = await fetch(`${restUrl}/responses`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({
        session_code: payload.sessionCode,
        role_band: payload.roleBand,
        answers: payload.answers,
      }),
    });
    if (!res.ok) throw new Error(`Supabase insert failed: ${res.status}`);
  }

  return {
    async session() {
      const rows = await callRpc("get_session_info", { p_code: sessionCode });
      const row = rows[0];
      if (!row) return null;
      return {
        agencyName: row.agency_name,
        isRebaseline: row.is_rebaseline,
        priorScores: row.prior_scores,
        priorAssessedAt: row.prior_assessed_at,
      };
    },

    saveDraft(answers) {
      localStorage.setItem(draftKey, JSON.stringify({ answers, savedAt: Date.now() }));
    },

    loadDraft() {
      return readJSON(draftKey, null);
    },

    clearDraft() {
      localStorage.removeItem(draftKey);
    },

    async submit(payload) {
      for (let attempt = 0; attempt < submitAttempts; attempt++) {
        try {
          await insertResponse(payload);
          this.clearDraft();
          return { status: "ok" };
        } catch {
          // retry
        }
      }
      const code = generateFallbackCode();
      const held = readJSON(fallbackKey, {});
      held[code] = { ...payload, heldAt: Date.now() };
      localStorage.setItem(fallbackKey, JSON.stringify(held));
      this.clearDraft();
      return { status: "queued-local", code };
    },

    // facilitator.html only, from here down.

    async listResponses() {
      if (!facilitatorKey) return [];
      const rows = await callRpc("get_session_responses", { p_code: sessionCode, p_key: facilitatorKey });
      return rows.map((r) => ({
        id: r.id,
        sessionCode: r.session_code,
        roleBand: r.role_band,
        answers: r.answers,
        submittedAt: new Date(r.submitted_at).getTime(),
      }));
    },

    // Fallback codes are always held in whichever browser the respondent
    // (or, after hand-entry, the facilitator) is using — there is no
    // server-side concept of a "pending" response, by design: anon can
    // only INSERT, never leave a row in a half-submitted state.
    listPendingFallbackCodes() {
      return Object.keys(readJSON(fallbackKey, {}));
    },

    async promoteFallback(code) {
      const held = readJSON(fallbackKey, {});
      const payload = held[code];
      if (!payload) return { status: "not-found" };
      const { heldAt, ...responsePayload } = payload;
      await insertResponse(responsePayload);
      delete held[code];
      localStorage.setItem(fallbackKey, JSON.stringify(held));
      return { status: "ok" };
    },
  };
}

export function createStorage(config) {
  if (config.adapter === "local") return localAdapter(config);
  if (config.adapter === "supabase") return supabaseAdapter(config);
  throw new Error(`Unknown storage adapter '${config.adapter}'`);
}
