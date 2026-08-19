// Storage adapter: 'local' | 'supabase'. Pass 2 implements 'local' only —
// the 'supabase' adapter arrives when Supabase is wired, behind the same
// four-method contract, so form.js never has to change.
//
// submit() contract (shared by every adapter):
//   { status: 'ok' }
//   { status: 'queued-local', code: string }   // held in this browser after
//                                                // retries failed; facilitator
//                                                // enters `code` by hand.
// This shape is exercised in Pass 2 via `simulateFailureRate` so the
// fallback-code UI in form.js is built and tested now, not deferred to
// Pass 3 where the real network failures would otherwise first appear.

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I — read aloud on a call

function generateFallbackCode() {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

function localAdapter({ sessionCode, simulateFailureRate = 0, submitAttempts = 3 }) {
  const draftKey = `niar:${sessionCode}:draft`;
  const responsesKey = `niar:${sessionCode}:responses`;
  const fallbackKey = `niar:${sessionCode}:fallback`;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

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

    listResponses() {
      return readJSON(responsesKey, []);
    },

    listPendingFallbackCodes() {
      return Object.keys(readJSON(fallbackKey, {}));
    },

    // Moves a held fallback-code response into `responses` — the same
    // array submit() writes to and listResponses() reads — so there is
    // exactly one place a response lives once it's counted. Never writes
    // to `responses` by any other path.
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

export function createStorage(config) {
  if (config.adapter === "local") return localAdapter(config);
  throw new Error(`Unknown storage adapter '${config.adapter}' — 'supabase' arrives in a later pass.`);
}
