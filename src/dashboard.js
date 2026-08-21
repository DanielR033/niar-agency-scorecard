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
import { fetchWithTimeout } from "./net.js";

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
  // Individual-respondent overlay + raw-answer viewer are new, higher-risk
  // surfaces (new canvas layer, new PII-adjacent handling) landing in a
  // tool already live with real agencies — default off, opt in per
  // session with ?individual=1 until proven against real data.
  const showIndividual = params.get("individual") === "1";

  if (!checkFacilitatorKey(facilitatorKey)) {
    root.innerHTML = `<div class="dash"><p>Missing facilitator key — append &k=FACILITATOR_KEY to this URL.</p></div>`;
    return;
  }

  const questionsUrl = new URL("./questions.json", import.meta.url);
  const raw = await fetchWithTimeout(questionsUrl).then((r) => r.json());
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

  root.innerHTML = buildShell(session, showIndividual);
  const canvasWrap = root.querySelector(".radar-canvas-wrap");
  const scoreEl = root.querySelector(".score-figure__value");
  const radar = createRadar(canvasWrap, instrument);

  const notes = new Map(); // divergence key -> note text, local-only this pass

  // Anonymity guardrail: respondents are never labelled by A2's name or by
  // submission order — each gets a random-once key the first time it's
  // seen, and R# numbering is that key's rank, so "who answered first"
  // can't be read off the list. Selection is kept by response.id (stable
  // across polls), never by list position.
  const shuffleKeys = new Map(); // response.id -> random sort key
  let selectedResponseId = null;

  let lastSignature = null;
  let firstRun = true;

  // Multi-day sessions (MTW's two-day re-baseline run): the radar and every
  // derived panel stay veiled until the facilitator deliberately reveals
  // them — otherwise whatever's projected mid-session shows a partial score
  // building live off only the respondents answered so far, which reads as
  // "the result" when it isn't yet. Day-by-day comparison is a second,
  // independent gate — the facilitator's own tool, not necessarily meant
  // for the room, so it has its own button rather than riding the same one.
  let scoreRevealed = false;
  let dayCompareOn = false;
  let latestBundle = null;

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
    // Progress pings change far more often than actual submissions — they'd
    // never repaint if gated behind the same response-signature check below,
    // so this panel updates on every poll independent of that guard.
    const progressRows = (await storage.listProgress?.()) ?? [];
    renderLiveProgress(root, progressRows, raw);

    const { responses, isFixture } = await loadResponses();
    const signature = signatureOf(responses) + (isFixture ? ":fixture" : "");
    if (signature === lastSignature) return;
    lastSignature = signature;

    const scores = computeScores(responses, instrument);
    const divergence = computeDivergence(responses, instrument, scores);

    renderCounter(root, responses.length, storage.listPendingFallbackCodes(), isFixture);
    updateLegend(root, session);
    renderDayCompare(root, computeDayBuckets(responses, instrument), scores.agencyScore);

    // With zero responses, every Discovery-block field is undefined, and
    // conditions like "B4 != 'none'" evaluate true against `undefined` —
    // showing pre-processing requirements and a tier nobody's data actually
    // implied yet. Show an honest waiting state instead of derived noise.
    const tier = responses.length ? evaluateIntegrationTier(responses, instrument, scores) : null;
    const gates = responses.length ? evaluateValidationGateRisk(responses, instrument, scores) : null;
    const preprocessing = responses.length ? evaluatePreprocessingRequirements(responses, instrument, scores) : null;
    const discovery = responses.length ? aggregateAgencyAnswers(responses, instrument) : null;

    const payload = {
      dimensionScores: scores.dimensionScores,
      baseline: instrument.scoring.baseline_overlay,
      prior: session.priorScores,
      agencyScore: scores.agencyScore,
      scoreEl,
    };

    latestBundle = { responses, scores, divergence, tier, gates, preprocessing, discovery, payload, notes };
    if (scoreRevealed) paintRevealed(latestBundle);

    if (showIndividual) {
      for (const r of responses) {
        if (!shuffleKeys.has(r.id)) shuffleKeys.set(r.id, Math.random());
      }
      // If the selected respondent vanished (shouldn't normally happen —
      // responses are never deleted), fall back to no selection rather
      // than pointing the overlay at stale data.
      if (selectedResponseId && !responses.some((r) => r.id === selectedResponseId)) {
        selectedResponseId = null;
      }

      function onSelectRespondent(id) {
        selectedResponseId = selectedResponseId === id ? null : id;
        applyIndividualSelection();
        renderRespondents(root, responses, instrument, shuffleKeys, selectedResponseId, onSelectRespondent);
      }

      function applyIndividualSelection() {
        if (!selectedResponseId) {
          radar.setIndividualOverlay(null);
          renderRespondentDetail(root, null, null);
          return;
        }
        const respondent = responses.find((r) => r.id === selectedResponseId);
        const individualScores = computeScores([respondent], instrument);
        radar.setIndividualOverlay(individualScores.dimensionScores);
        renderRespondentDetail(root, respondent, instrument);
      }

      renderRespondents(root, responses, instrument, shuffleKeys, selectedResponseId, onSelectRespondent);
      applyIndividualSelection();
    }

    wireRoleBandToggle(root, radar, scores, divergence);
    wirePriorToggle(root, radar, session);
    wireFallbackEntry(root, storage, refresh);
  }

  function paintRevealed(bundle) {
    if (!bundle) return;
    const { responses, scores, divergence, tier, gates, preprocessing, discovery, payload, notes } = bundle;
    if (responses.length === 0) {
      renderWaiting(root);
    } else {
      renderTier(root, tier, discovery);
      renderGates(root, gates, instrument);
      renderPreprocessing(root, preprocessing);
      renderGaps(root, scores, instrument);
    }
    renderDivergence(root, divergence, instrument, notes);
    if (firstRun) {
      radar.reveal(payload);
      firstRun = false;
    } else {
      radar.update(payload);
    }
  }

  function wireRevealGate() {
    const btn = root.querySelector("#reveal-score-btn");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      scoreRevealed = true;
      root.querySelector(".dash__body").dataset.revealed = "true";
      paintRevealed(latestBundle);
    });
  }

  function wireDayCompareToggle() {
    const btn = root.querySelector("#day-compare-btn");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", () => {
      dayCompareOn = !dayCompareOn;
      btn.setAttribute("aria-pressed", String(dayCompareOn));
      root.querySelector("#day-compare-panel").style.display = dayCompareOn ? "block" : "none";
    });
  }
  wireRevealGate();
  wireDayCompareToggle();

  await refresh();
  setInterval(refresh, POLL_MS);

  window.addEventListener("resize", () => radar.layout());
}

// Groups responses by the local calendar date they were submitted on — the
// only signal available for "yesterday vs today" since both days share one
// session code by design (MTW's re-baseline runs as one accumulating
// session, not two). Each bucket gets its own agency score via the same
// unweighted-mean engine as the consolidated figure, nothing re-derived.
function computeDayBuckets(responses, instrument) {
  const byDay = new Map();
  for (const r of responses) {
    const date = new Date(r.submittedAt);
    const day = Number.isNaN(date.getTime()) ? "unknown date" : date.toLocaleDateString("en-CA");
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(r);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, rs]) => ({ day, n: rs.length, agencyScore: computeScores(rs, instrument).agencyScore }));
}

function renderDayCompare(root, buckets, consolidatedScore) {
  const panel = root.querySelector("#day-compare-panel");
  if (!panel) return;
  if (buckets.length === 0) {
    panel.innerHTML = `<p class="empty-note">No responses yet.</p>`;
    return;
  }
  const rows = buckets
    .map(
      (b) =>
        `<div class="counter-row"><span>${escapeHtml(b.day)} (n=${b.n})</span><span class="counter-row__value">${b.agencyScore}</span></div>`
    )
    .join("");
  panel.innerHTML = `${rows}<div class="counter-row day-compare__total"><span>Consolidated</span><span class="counter-row__value">${consolidatedScore}</span></div>`;
}

// Same unweighted-mean model as scoring.js's agency score (CLAUDE.md: "Do
// not invent weighting") — this just averages numbers already published in
// Annex 1, it doesn't re-derive anything from response data.
function priorAgencyScore(priorScores) {
  if (!priorScores) return null;
  const values = Object.values(priorScores);
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function buildShell(session, showIndividual) {
  const priorScore = priorAgencyScore(session.priorScores);
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
            }${
              priorScore !== null ? `, scored <strong>${priorScore}</strong> then` : ""
            }. The dashed line is this agency's own past self, not another agency.</div>`
          : ""
      }
      <div class="dash__body" data-revealed="false">
      <div class="radar-panel">
        <div class="reveal-gate" id="reveal-gate">
          <div class="reveal-gate__inner">
            <p class="reveal-gate__label">Score not revealed yet</p>
            <button type="button" class="primary-btn" id="reveal-score-btn">Revelar puntaje consolidado</button>
          </div>
        </div>
        <div class="radar-canvas-wrap" id="radar-canvas-wrap">
          <div class="score-figure">
            <div class="score-figure__value">0.0</div>
            <div class="score-figure__label">Agency score · baseline 2.1</div>
          </div>
        </div>
        <div class="radar-controls" id="radar-controls">
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
          <button type="button" class="toggle-btn day-compare-btn" id="day-compare-btn" aria-pressed="false">Ver ayer vs hoy</button>
          <div class="day-compare-panel" id="day-compare-panel" style="display:none"></div>
        </div>
        <div class="panel" id="live-progress-panel">
          <p class="panel__title">Right now</p>
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
        <div class="panel" id="gaps-panel">
          <p class="panel__title">Where to focus</p>
        </div>
        <div class="panel" id="divergence-panel">
          <p class="panel__title">Top divergences to address now</p>
        </div>
        ${
          showIndividual
            ? `<div class="panel" id="respondents-panel">
                 <p class="panel__title">Respondents</p>
                 <p class="anon-caption">Shown for discussion, not attribution — never labelled by name.</p>
               </div>
               <div class="panel" id="respondent-detail-panel" style="display:none"></div>`
            : ""
        }
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

// Chapter-level "where is everyone right now" — collapses raw pings to the
// latest one per client_id, same pattern as the individual-overlay's
// per-response dedup. form.js pings every 20s while a respondent is on the
// question screen (both on block change and on a timer, so staying on one
// long question still counts as presence) — 60s gives ~3 missed beats of
// slack before someone drops off as inactive.
const PROGRESS_ACTIVE_MS = 60 * 1000;

function renderLiveProgress(root, progressRows, raw) {
  const panel = root.querySelector("#live-progress-panel");
  if (!panel) return;

  const latestByClient = new Map();
  for (const row of progressRows) {
    const prev = latestByClient.get(row.clientId);
    if (!prev || row.updatedAt > prev.updatedAt) latestByClient.set(row.clientId, row);
  }
  const now = Date.now();
  const active = [...latestByClient.values()].filter((r) => now - r.updatedAt < PROGRESS_ACTIVE_MS);

  if (active.length === 0) {
    panel.innerHTML = `<p class="panel__title">Right now</p><p class="empty-note">No one answering at the moment.</p>`;
    return;
  }

  const counts = new Map(raw.blocks.map((b) => [b.id, 0]));
  let justFinished = 0;
  for (const r of active) {
    if (r.blockId === "done") {
      justFinished += 1;
    } else if (counts.has(r.blockId)) {
      counts.set(r.blockId, counts.get(r.blockId) + 1);
    }
  }

  const rows = raw.blocks
    .map((b) => {
      const count = counts.get(b.id) || 0;
      const pct = Math.round((count / active.length) * 100);
      return `
        <div class="progress-block-row">
          <div class="progress-block-row__label"><span>${escapeHtml(b.title)}</span><span>${count}</span></div>
          <div class="progress-block-row__track"><div class="progress-block-row__fill" style="width:${pct}%"></div></div>
        </div>`;
    })
    .join("");

  panel.innerHTML = `
    <p class="panel__title">Right now</p>
    <div class="counter-row"><span>Answering</span><span class="counter-row__value">${active.length}</span></div>
    ${rows}
    ${justFinished ? `<p class="empty-note">${justFinished} just finished</p>` : ""}
  `;
}

function renderWaiting(root) {
  const waitingHtml = `<p class="empty-note">Waiting for the first response.</p>`;
  root.querySelector("#tier-panel").innerHTML = `<p class="panel__title">Integration tier</p>${waitingHtml}`;
  root.querySelector("#gates-panel").innerHTML = `<p class="panel__title">Validation pipeline risk</p>${waitingHtml}`;
  root.querySelector("#preproc-panel").innerHTML = `<p class="panel__title">Pre-processing requirements</p>${waitingHtml}`;
  root.querySelector("#gaps-panel").innerHTML = `<p class="panel__title">Where to focus</p>${waitingHtml}`;
}

// Ranked ascending by score — ties keep questions.json's dimension order
// (Array.sort is stable), so equal scores don't look meaningfully ordered
// when they aren't. Framed as the room's agenda, not a verdict: coral
// divergence language, never "failed" or "below standard".
function renderGaps(root, scores, instrument) {
  const panel = root.querySelector("#gaps-panel");
  const dims = instrument.dimensions
    .map((d) => ({ id: d.id, label: d.label, score: scores.dimensionScores[d.id] }))
    .filter((d) => d.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  if (dims.length === 0) {
    panel.innerHTML = `<p class="panel__title">Where to focus</p><p class="empty-note">Waiting for the first response.</p>`;
    return;
  }

  panel.innerHTML = `
    <p class="panel__title">Where to focus</p>
    <ul class="gaps-list">
      ${dims
        .map(
          (d, i) =>
            `<li class="gaps-list__item${i === 0 ? " gaps-list__item--top" : ""}">
               <span class="gaps-list__label">${escapeHtml(d.label)}</span>
               <span class="gaps-list__score">${d.score.toFixed(1)}</span>
             </li>`
        )
        .join("")}
    </ul>
  `;
}

// ---- individual-respondent overlay + raw viewer (?individual=1 only) ----

function renderRespondents(root, responses, instrument, shuffleKeys, selectedId, onSelect) {
  const panel = root.querySelector("#respondents-panel");
  if (!panel) return;

  const ordered = [...responses].sort((a, b) => shuffleKeys.get(a.id) - shuffleKeys.get(b.id));
  const numbered = ordered.map((r, i) => ({ response: r, order: i + 1 }));

  const byBand = new Map();
  for (const entry of numbered) {
    const band = entry.response.roleBand || "unassigned";
    if (!byBand.has(band)) byBand.set(band, []);
    byBand.get(band).push(entry);
  }

  const bandOrder = ["leadership", "technical", "operational", "unassigned"];
  const sections = bandOrder
    .filter((band) => byBand.has(band))
    .map((band) => {
      const chips = byBand
        .get(band)
        .map(
          ({ response, order }) => `
          <button type="button" class="respondent-chip" data-id="${escapeHtml(response.id)}" aria-pressed="${
            response.id === selectedId
          }">R${order}</button>`
        )
        .join("");
      return `<div class="respondent-band"><p class="respondent-band__title">${escapeHtml(band)}</p><div class="respondent-band__chips">${chips}</div></div>`;
    })
    .join("");

  panel.innerHTML = `
    <p class="panel__title">Respondents</p>
    <p class="anon-caption">Shown for discussion, not attribution — never labelled by name.</p>
    ${sections}
  `;

  panel.querySelectorAll(".respondent-chip").forEach((el) => {
    el.addEventListener("click", () => onSelect(el.dataset.id));
  });
}

function renderRespondentDetail(root, response, instrument) {
  const panel = root.querySelector("#respondent-detail-panel");
  if (!panel) return;

  if (!response) {
    panel.style.display = "none";
    panel.innerHTML = "";
    return;
  }

  panel.style.display = "block";
  const rows = [];
  for (const block of instrument.raw.blocks) {
    for (const question of block.questions) {
      // A1 is session config, not a respondent's answer. A2 is the one
      // field that could carry a real name — never shown here, even
      // though the respondent may have typed one in.
      if (question.type === "hidden" || question.id === "A2") continue;
      const value = response.answers[question.id];
      if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
      rows.push(`
        <div class="respondent-answer">
          <p class="respondent-answer__prompt">${escapeHtml(question.prompt)}</p>
          <p class="respondent-answer__value">${escapeHtml(formatAnswer(question, value, instrument))}</p>
        </div>
      `);
    }
  }

  panel.innerHTML = `
    <p class="panel__title">Respondent detail</p>
    <p class="anon-caption">Shown for discussion, not attribution.</p>
    ${rows.join("")}
  `;
}

function formatAnswer(question, value, instrument) {
  const labelFor = (v) => instrument.optionIndex.get(`${question.id}:${v}`)?.label ?? String(v);
  if (question.type === "multi_select") return value.map(labelFor).join(", ");
  if (question.type === "scale_anchored") {
    const option = question.options.find((o) => o.score === value);
    return option ? `${value} — ${option.label}` : String(value);
  }
  if (question.type === "single_select") return labelFor(value);
  return String(value); // text_short / text_long
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
  if (session.isRebaseline) {
    const priorScore = priorAgencyScore(session.priorScores);
    items.push({
      color: "#2dd4bf",
      label: `Prior assessment (dashed)${priorScore !== null ? ` — ${priorScore}` : ""}`,
    });
  }
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
