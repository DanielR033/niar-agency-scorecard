// Facilitator dashboard logic: loads responses, runs the Pass 1 derivations,
// drives radar.js's reveal/live-update, and renders the side panels. Not
// shown to respondents — separate URL, per CLAUDE.md.

import { loadInstrument } from "./instrument.js";
import { createStorage } from "./storage.js";
import { computeScores } from "./scoring.js";
import { evaluateIntegrationTier, evaluateValidationGateRisk, evaluatePreprocessingRequirements } from "./tiering.js";
import { computeDivergence } from "./divergence.js";
import { aggregateAgencyAnswers } from "./aggregate.js";
import { createRadar } from "./radar.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const POLL_MS = 5000;

// The real gate is supabase/schema.sql's get_session_responses RPC, which
// requires the correct session code AND facilitator key and — by design —
// returns zero rows for a wrong key exactly as it would for a right key on
// an empty session (no oracle to probe which). So there's nothing for this
// function to check beyond "was a key supplied at all"; the security work
// happens server-side, not here.
function checkFacilitatorKey(key) {
  return Boolean(key);
}

function signatureOf(responses) {
  return responses.map((r) => r.submittedAt ?? r.id).join("|");
}

export async function initDashboard(root) {
  const params = new URLSearchParams(location.search);
  const sessionCode = (params.get("s") || "DEMO").toUpperCase();
  const facilitatorKey = params.get("k") ?? "";
  // ?adapter=local forces the offline/dev adapter with seeded fixtures —
  // e.g. for tuning the reveal with no connectivity. Every real session
  // runs on 'supabase'.
  const adapter = params.get("adapter") === "local" ? "local" : "supabase";

  if (!checkFacilitatorKey(facilitatorKey)) {
    root.innerHTML = `<div class="dash"><p>Missing facilitator key — append &k=FACILITATOR_KEY to this URL.</p></div>`;
    return;
  }

  const questionsUrl = new URL("./questions.json", import.meta.url);
  const raw = await fetch(questionsUrl).then((r) => r.json());
  const instrument = loadInstrument(raw);
  const storage = createStorage({
    adapter,
    sessionCode,
    facilitatorKey,
    projectUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  });
  const session = await storage.session();

  if (!session) {
    root.innerHTML = `<div class="dash"><p>Session "${sessionCode}" not recognised.</p></div>`;
    return;
  }

  root.innerHTML = buildShell(session);
  const canvasWrap = root.querySelector(".radar-canvas-wrap");
  const scoreEl = root.querySelector(".score-figure__value");
  const radar = createRadar(canvasWrap, instrument);

  const notes = new Map(); // divergence key -> note text, local-only this pass

  let lastSignature = null;
  let firstRun = true;

  // 'local' adapter only: seed fixtures when there are zero real responses.
  // Gated on adapter type, not on data emptiness, so a real empty Wave 2
  // session on 'supabase' renders "waiting for respondents" instead of
  // silently showing fake data — a real session with a wrong or missing
  // facilitator key also lands here honestly empty, never on fixtures.
  async function loadResponses() {
    const real = await storage.listResponses();
    if (adapter !== "local" || real.length > 0) return { responses: real, isFixture: false };
    const { generateFixtureResponses } = await import("./dev-fixtures.js");
    return { responses: generateFixtureResponses(), isFixture: true };
  }

  async function refresh() {
    const { responses, isFixture } = await loadResponses();
    const signature = signatureOf(responses) + (isFixture ? ":fixture" : "");
    if (signature === lastSignature) return;
    lastSignature = signature;

    const scores = computeScores(responses, instrument);
    const tier = evaluateIntegrationTier(responses, instrument, scores);
    const gates = evaluateValidationGateRisk(responses, instrument, scores);
    const preprocessing = evaluatePreprocessingRequirements(responses, instrument, scores);
    const divergence = computeDivergence(responses, instrument, scores);
    const discovery = aggregateAgencyAnswers(responses, instrument);

    renderCounter(root, responses.length, storage.listPendingFallbackCodes(), isFixture);
    renderTier(root, tier, discovery);
    renderGates(root, gates, instrument);
    renderPreprocessing(root, preprocessing);
    renderDivergence(root, divergence, instrument, notes);
    updateLegend(root, session);

    const payload = {
      dimensionScores: scores.dimensionScores,
      baseline: instrument.scoring.baseline_overlay,
      prior: session.priorScores,
      agencyScore: scores.agencyScore,
      scoreEl,
    };

    if (firstRun) {
      radar.reveal(payload);
      firstRun = false;
    } else {
      radar.update(payload);
    }

    wireRoleBandToggle(root, radar, scores, divergence);
    wirePriorToggle(root, radar, session);
    wireFallbackEntry(root, storage, refresh);
  }

  await refresh();
  setInterval(refresh, POLL_MS);

  window.addEventListener("resize", () => radar.layout());
}

function buildShell(session) {
  return `
    <div class="dash">
      <div class="dash__header">
        <h1 class="dash__agency">${escapeHtml(session.agencyName)}</h1>
        <span class="dash__meta" id="counter-inline"></span>
      </div>
      ${
        session.isRebaseline
          ? `<div class="rebaseline-banner">This is a <strong>re-baseline</strong>${
              session.priorAssessedAt ? ` — first assessed ${escapeHtml(session.priorAssessedAt)}` : ""
            }. The dashed line is this agency's own past self, not another agency.</div>`
          : ""
      }
      <div class="dash__body">
      <div class="radar-panel">
        <div class="radar-canvas-wrap">
          <div class="score-figure">
            <div class="score-figure__value">0.0</div>
            <div class="score-figure__label">Agency score · baseline 2.1</div>
          </div>
        </div>
        <div class="radar-controls">
          <button type="button" class="toggle-btn" id="role-band-toggle" aria-pressed="false">Show role bands</button>
          ${
            session.isRebaseline
              ? `<button type="button" class="toggle-btn" id="prior-toggle" aria-pressed="true">Show prior assessment</button>`
              : ""
          }
        </div>
        <div class="legend" id="legend"></div>
      </div>
      <div class="side">
        <div class="panel">
          <p class="panel__title">Session</p>
          <div class="counter-row"><span>Respondents</span><span class="counter-row__value" id="respondent-count">0</span></div>
          <p class="empty-note" id="fixture-note"></p>
          <p class="empty-note" id="fallback-note"></p>
          <div class="fallback-entry">
            <input type="text" id="fallback-input" placeholder="Enter fallback code" maxlength="6" />
            <button type="button" id="fallback-submit">Add</button>
          </div>
        </div>
        <div class="panel" id="tier-panel">
          <p class="panel__title">Integration tier</p>
        </div>
        <div class="panel" id="gates-panel">
          <p class="panel__title">Validation pipeline risk</p>
        </div>
        <div class="panel" id="preproc-panel">
          <p class="panel__title">Pre-processing requirements</p>
        </div>
        <div class="panel" id="divergence-panel">
          <p class="panel__title">Top divergences to address now</p>
        </div>
      </div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function renderCounter(root, count, pendingCodes, isFixture) {
  root.querySelector("#respondent-count").textContent = String(count);
  root.querySelector("#counter-inline").textContent = `${count} respondent${count === 1 ? "" : "s"}`;
  root.querySelector("#fixture-note").textContent = isFixture
    ? "Showing seeded demo data — no real responses submitted yet for this session."
    : "";
  const fallbackNote = root.querySelector("#fallback-note");
  fallbackNote.textContent = pendingCodes.length
    ? `${pendingCodes.length} response${pendingCodes.length === 1 ? "" : "s"} held on a respondent's phone, not yet counted: ${pendingCodes.join(", ")}`
    : "";
}

function renderTier(root, tier, discovery) {
  const panel = root.querySelector("#tier-panel");
  const evidenceBits = [];
  if (discovery.B2?.length) evidenceBits.push(`Systems in use: ${discovery.B2.join(", ")}`);
  if (discovery.B4 && discovery.B4 !== "none") evidenceBits.push(`Paper records: ${discovery.B4}`);
  if (discovery.B9) evidenceBits.push(`Data sharing today: ${discovery.B9}`);

  panel.innerHTML = `
    <p class="panel__title">Integration tier</p>
    <div class="tier-row">
      <span class="tier-badge">${tier.primary ? tier.primary.tier : "—"}</span>
      <span>${tier.primary ? escapeHtml(tier.primary.label) : "No data yet"}</span>
    </div>
    ${tier.primary ? `<p class="tier-implication">${escapeHtml(tier.primary.implication)}</p>` : ""}
    ${
      tier.secondary
        ? `<div class="tier-row"><span class="tier-badge" style="font-size:22px">${tier.secondary.tier}</span><span>${escapeHtml(
            tier.secondary.label
          )}</span></div>`
        : ""
    }
    ${evidenceBits.length ? `<p class="tier-implication">${evidenceBits.map(escapeHtml).join(" · ")}</p>` : ""}
  `;
}

function renderGates(root, gates, instrument) {
  const panel = root.querySelector("#gates-panel");
  panel.innerHTML = `
    <p class="panel__title">Validation pipeline risk</p>
    <div class="gate-list">
      ${gates
        .map((g) => `<span class="gate-chip" data-risk="${g.atRisk}">${g.gate} · ${escapeHtml(g.type)}</span>`)
        .join("")}
    </div>
  `;
}

function renderPreprocessing(root, requirements) {
  const panel = root.querySelector("#preproc-panel");
  panel.innerHTML = `
    <p class="panel__title">Pre-processing requirements</p>
    ${
      requirements.length
        ? `<ul class="preproc-list">${requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
        : `<p class="empty-note">None triggered yet.</p>`
    }
  `;
}

function findingKey(f) {
  return `${f.id}:${f.dimension ?? f.item}`;
}

function detailFor(f, instrument) {
  const dimLabel = (id) => instrument.dimensions.find((d) => d.id === id)?.label ?? id;
  if (f.id === "optimism_gap" || f.id === "hidden_capability") {
    return `${dimLabel(f.dimension)} — leadership ${f.leadershipScore.toFixed(1)}, operational ${f.operationalScore.toFixed(1)}`;
  }
  if (f.id === "dispersion") {
    const prompt = instrument.questionsById.get(f.item)?.prompt ?? f.item;
    return `${prompt} — answers from ${f.min} to ${f.max}`;
  }
  if (f.id === "baseline_delta") {
    return `${dimLabel(f.dimension)} — agency ${f.agencyScore.toFixed(1)} vs. baseline ${f.baseline}`;
  }
  return "";
}

function renderDivergence(root, divergence, instrument, notes) {
  const panel = root.querySelector("#divergence-panel");
  const heading = `<p class="panel__title">Top divergences to address now</p>`;
  if (divergence.top.length === 0) {
    panel.innerHTML = `${heading}<p class="empty-note">No significant divergence yet — this fills in as responses arrive.</p>`;
    return;
  }
  panel.innerHTML =
    heading +
    divergence.top
      .map((f, i) => {
        const key = findingKey(f);
        const halo = i === 0 ? " divergence-card--halo" : "";
        return `
        <div class="divergence-card${halo}" style="animation-delay:${i * 120}ms">
          <p class="divergence-card__label">${escapeHtml(f.label)}</p>
          <p class="divergence-card__detail">${escapeHtml(detailFor(f, instrument))}</p>
          <p class="divergence-card__probe">&ldquo;${escapeHtml(f.probe)}&rdquo;</p>
          <p class="divergence-card__note-label">Facilitator notes — not saved yet, not visible to respondents</p>
          <textarea class="divergence-card__note" data-key="${key}" placeholder="Type notes here for this session only">${escapeHtml(
          notes.get(key) ?? ""
        )}</textarea>
        </div>`;
      })
      .join("");

  panel.querySelectorAll(".divergence-card__note").forEach((el) => {
    el.addEventListener("input", () => notes.set(el.dataset.key, el.value));
  });
}

function updateLegend(root, session) {
  const legend = root.querySelector("#legend");
  const items = [
    { color: "#2dd4bf", label: "Agency (live)" },
    { color: "#3d5a80", label: "Ecosystem baseline (2.1)" },
  ];
  if (session.isRebaseline) items.push({ color: "#2dd4bf", label: "Prior assessment (dashed)" });
  legend.innerHTML = items
    .map((i) => `<span><span class="legend__dot" style="background:${i.color}"></span>${escapeHtml(i.label)}</span>`)
    .join("");
}

let roleBandOn = false;
function wireRoleBandToggle(root, radar, scores, divergence) {
  const btn = root.querySelector("#role-band-toggle");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", () => {
    roleBandOn = !roleBandOn;
    btn.setAttribute("aria-pressed", String(roleBandOn));
    if (roleBandOn) {
      radar.setRoleBandOverlay({
        leadership: scores.byRoleBand.leadership.dimensionScores,
        operational: scores.byRoleBand.operational.dimensionScores,
        gapDimensions: divergence.all.filter((f) => f.id === "optimism_gap").map((f) => f.dimension),
      });
    } else {
      radar.setRoleBandOverlay(null);
    }
  });
}

let priorOn = true;
function wirePriorToggle(root, radar, session) {
  const btn = root.querySelector("#prior-toggle");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", () => {
    priorOn = !priorOn;
    btn.setAttribute("aria-pressed", String(priorOn));
    radar.setPriorOverlay(priorOn ? session.priorScores : null);
  });
}

function wireFallbackEntry(root, storage, refresh) {
  const btn = root.querySelector("#fallback-submit");
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = "1";
  btn.addEventListener("click", async () => {
    const input = root.querySelector("#fallback-input");
    const code = input.value.trim().toUpperCase();
    if (!code) return;
    const result = await storage.promoteFallback(code);
    if (result.status === "ok") {
      input.value = "";
      refresh();
    } else {
      input.setAttribute("placeholder", "Code not found");
    }
  });
}
