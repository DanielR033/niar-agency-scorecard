// Respondent form rendering/navigation engine. One question per screen on
// mobile (<768px), grouped-by-block panels on wider viewports, per
// docs/design-system.md. Reuses instrument.js's indices — no question,
// option or threshold is written here; everything comes from questions.json.
//
// The form is deliberately restrained: no illustration, minimal motion,
// gold used only for the selected-option rule. All visual energy is spent
// on the dashboard (facilitator.html), per the design system's own framing.

import { loadInstrument } from "./instrument.js";
import { createStorage } from "./storage.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { fetchWithTimeout } from "./net.js";

const WIDE_QUERY = "(min-width: 768px)";

export async function initForm(root) {
  const params = new URLSearchParams(location.search);
  const sessionCode = (params.get("s") || "DEMO").toUpperCase();
  const simulateFailureRate = Number(params.get("failrate") || 0);
  // ?adapter=local forces the offline/dev adapter — e.g. for a demo with
  // no connectivity. Every real session runs on 'supabase'.
  const adapter = params.get("adapter") === "local" ? "local" : "supabase";

  const questionsUrl = new URL("./questions.json", import.meta.url);
  const raw = await fetchWithTimeout(questionsUrl).then((r) => r.json());
  const instrument = loadInstrument(raw);
  const storage = createStorage({
    adapter,
    sessionCode,
    simulateFailureRate,
    projectUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  });
  const session = await storage.session();

  const state = {
    phase: session ? "welcome" : "session-error",
    currentIndex: 0,
    answers: {},
    roleBand: "unassigned",
    result: null,
  };

  const draft = storage.loadDraft();
  if (draft?.answers) state.answers = { ...draft.answers };

  function allQuestionsInOrder() {
    const list = [];
    for (const block of raw.blocks) {
      for (const question of block.questions) {
        if (question.type === "hidden") continue;
        list.push({ ...question, blockId: block.id, blockTitle: block.title });
      }
    }
    return list;
  }

  function isVisible(question, answers) {
    if (!question.conditional) return true;
    const value = answers[question.conditional.question];
    return question.conditional.equals.includes(value);
  }

  function visibleQuestions() {
    return allQuestionsInOrder().filter((q) => isVisible(q, state.answers));
  }

  function isAnswered(question) {
    const value = state.answers[question.id];
    if (question.type === "multi_select") return Array.isArray(value) && value.length > 0;
    return value !== undefined && value !== null && value !== "";
  }

  function isSatisfied(question) {
    if (!question.required) return true;
    return isAnswered(question);
  }

  function setAnswer(questionId, value) {
    state.answers[questionId] = value;
    if (questionId === "A3") {
      const option = instrument.optionIndex.get(`A3:${value}`);
      state.roleBand = option?.band ?? "unassigned";
    }
    storage.saveDraft(state.answers);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[c]);
  }

  let submitting = false;

  async function submitAll() {
    // Guards against a second Next tap (or a slow-network double-click)
    // firing a second insert while the first submit() is still in flight —
    // the UI doesn't leave the last question until this resolves, so
    // without this a real respondent on slow Wi-Fi could submit twice.
    if (submitting) return;
    submitting = true;
    state.answers.A1 = session.agencyName;
    const payload = {
      sessionCode,
      agencyName: session.agencyName,
      isRebaseline: session.isRebaseline,
      roleBand: state.roleBand,
      answers: state.answers,
    };
    state.result = await storage.submit(payload);
    state.phase = "closing";
    submitting = false;
    render();
  }

  function goNext() {
    if (submitting) return;
    const steps = visibleQuestions();
    if (state.currentIndex + 1 >= steps.length) {
      submitAll();
      return;
    }
    state.currentIndex += 1;
    render();
  }

  function goBack() {
    if (state.currentIndex === 0) return;
    state.currentIndex -= 1;
    render();
  }

  // ---- rendering ----

  function render() {
    const wide = matchMedia(WIDE_QUERY).matches;
    root.innerHTML = "";
    const app = document.createElement("div");
    app.className = "app";
    app.dataset.layout = wide ? "grouped" : "single";
    root.appendChild(app);

    if (state.phase === "session-error") {
      renderSessionError(app);
      return;
    }

    const rule = document.createElement("div");
    rule.className = "progress-rule";
    rule.innerHTML = `<div class="progress-rule__fill"></div>`;
    app.appendChild(rule);

    if (state.phase === "welcome") {
      renderWelcome(app, rule);
    } else if (state.phase === "closing") {
      renderClosing(app);
    } else if (wide) {
      renderGrouped(app);
    } else {
      renderSingleQuestion(app, rule);
    }
  }

  function renderSessionError(app) {
    app.innerHTML = `
      <div class="screen">
        <div class="welcome">
          <h1>Session not recognised</h1>
          <p>This link (${escapeHtml(sessionCode)}) doesn't match a session we know about. Ask your facilitator for a fresh QR code.</p>
        </div>
      </div>`;
  }

  function renderWelcome(app, rule) {
    rule.querySelector(".progress-rule__fill").style.width = "0%";
    const screen = document.createElement("div");
    screen.className = "screen";
    screen.innerHTML = `
      <div class="welcome">
        <h1>${escapeHtml(raw.welcome.heading)}</h1>
        ${raw.welcome.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        <button class="primary-btn" type="button" id="start-btn">Start</button>
        <p class="consent-note">${escapeHtml(raw.welcome.consent_note)}</p>
      </div>`;
    app.appendChild(screen);
    screen.querySelector("#start-btn").addEventListener("click", () => {
      state.phase = "question";
      render();
    });
  }

  function renderClosing(app) {
    const screen = document.createElement("div");
    screen.className = "screen";
    const fallback =
      state.result?.status === "queued-local"
        ? `<div class="fallback-code">
             <p>We couldn't reach the server. Your answers are saved on this phone — please show this code to your facilitator so they can enter it by hand. No answer is lost.</p>
             <div class="fallback-code__value">${escapeHtml(state.result.code)}</div>
           </div>`
        : "";
    screen.innerHTML = `
      <div class="closing">
        <h1>${escapeHtml(raw.closing.heading)}</h1>
        <p>${escapeHtml(raw.closing.body)}</p>
        ${fallback}
      </div>`;
    app.appendChild(screen);
  }

  function renderSingleQuestion(app, rule) {
    const steps = visibleQuestions();
    if (state.currentIndex >= steps.length) state.currentIndex = Math.max(0, steps.length - 1);
    const question = steps[state.currentIndex];
    rule.querySelector(".progress-rule__fill").style.width = `${(state.currentIndex / steps.length) * 100}%`;

    const screen = document.createElement("div");
    screen.className = "screen screen--entering";

    const nav = document.createElement("div");
    nav.className = "screen__nav";
    if (state.currentIndex > 0) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "back-btn";
      back.innerHTML = `&larr; Back`;
      back.addEventListener("click", goBack);
      nav.appendChild(back);
    }
    screen.appendChild(nav);

    screen.appendChild(renderQuestionBlock(question, { advanceOnAnswer: true }));
    app.appendChild(screen);
  }

  function renderGrouped(app) {
    const blocks = new Map();
    for (const q of visibleQuestions()) {
      if (!blocks.has(q.blockId)) blocks.set(q.blockId, { title: q.blockTitle, questions: [] });
      blocks.get(q.blockId).questions.push(q);
    }
    for (const [, block] of blocks) {
      const panel = document.createElement("div");
      panel.className = "block-panel";
      const title = document.createElement("h2");
      title.className = "block-panel__title";
      title.textContent = block.title;
      panel.appendChild(title);
      for (const question of block.questions) {
        const wrap = document.createElement("div");
        wrap.className = "question-block";
        wrap.appendChild(renderQuestionBlock(question, { advanceOnAnswer: false }));
        panel.appendChild(wrap);
      }
      app.appendChild(panel);
    }
    const submitScreen = document.createElement("div");
    submitScreen.className = "block-panel";
    submitScreen.style.display = "block";
    submitScreen.innerHTML = `<button class="primary-btn" type="button" id="submit-all-btn">Submit</button>
      <p id="submit-error" class="option__note"></p>`;
    app.appendChild(submitScreen);
    submitScreen.querySelector("#submit-all-btn").addEventListener("click", () => {
      const missing = visibleQuestions().find((q) => !isSatisfied(q));
      if (missing) {
        submitScreen.querySelector("#submit-error").textContent =
          "Please answer every required question before submitting.";
        return;
      }
      submitAll();
    });
  }

  function renderQuestionBlock(question, { advanceOnAnswer }) {
    const wrap = document.createElement("div");

    const header = document.createElement("div");
    header.className = "question-header";
    header.innerHTML = `
      <p class="question-header__block">${escapeHtml(question.blockTitle)}</p>
      <p class="question-header__prompt">${escapeHtml(question.prompt)}</p>
      ${question.help ? `<p class="question-header__help">${escapeHtml(question.help)}</p>` : ""}
    `;
    wrap.appendChild(header);

    if (question.type === "single_select" || question.type === "scale_anchored") {
      wrap.appendChild(renderChoiceList(question, { multi: false, advanceOnAnswer }));
    } else if (question.type === "multi_select") {
      const hint = document.createElement("p");
      hint.className = "multi-select-hint";
      hint.textContent = "Select all that apply.";
      wrap.appendChild(hint);
      wrap.appendChild(renderChoiceList(question, { multi: true, advanceOnAnswer: false }));
      wrap.appendChild(renderNextButton(question));
    } else if (question.type === "text_short" || question.type === "text_long") {
      const nextBtn = renderNextButton(question);
      wrap.appendChild(
        renderTextInput(question, question.type === "text_long", () => {
          nextBtn.disabled = !isSatisfied(question);
        })
      );
      wrap.appendChild(nextBtn);
    }

    return wrap;
  }

  function renderChoiceList(question, { multi, advanceOnAnswer }) {
    const list = document.createElement("div");
    list.className = "option-list";
    const current = state.answers[question.id];
    const selected = multi ? (Array.isArray(current) ? current : []) : current;

    const optionKey = (option) => (question.type === "scale_anchored" ? option.score : option.value);

    for (const option of question.options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option";
      const isSelected = multi ? selected.includes(optionKey(option)) : selected === optionKey(option);
      btn.setAttribute("aria-pressed", String(isSelected));
      btn.innerHTML = `<span>${escapeHtml(option.label)}${
        option.note ? `<span class="option__note">${escapeHtml(option.note)}</span>` : ""
      }</span>`;

      btn.addEventListener("click", () => {
        if (multi) {
          const next = new Set(selected);
          next.has(option.value) ? next.delete(option.value) : next.add(option.value);
          setAnswer(question.id, [...next]);
          render();
          return;
        }
        setAnswer(question.id, optionKey(option));
        if (advanceOnAnswer) {
          list.querySelectorAll(".option").forEach((el) => (el.disabled = true));
          btn.setAttribute("aria-pressed", "true");
          setTimeout(goNext, 220);
        } else {
          render();
        }
      });

      list.appendChild(btn);
    }
    return list;
  }

  function renderTextInput(question, long, onChange) {
    const wrap = document.createElement("div");
    const value = state.answers[question.id] ?? "";
    const el = document.createElement(long ? "textarea" : "input");
    el.className = long ? "text-area" : "text-input";
    el.value = value;
    if (question.placeholder) el.placeholder = question.placeholder;
    if (question.max_length) el.maxLength = question.max_length;

    let counter = null;
    if (question.max_length) {
      counter = document.createElement("p");
      counter.className = "char-count";
      counter.textContent = `${value.length} / ${question.max_length}`;
    }

    el.addEventListener("input", () => {
      setAnswer(question.id, el.value);
      if (counter) counter.textContent = `${el.value.length} / ${question.max_length}`;
      onChange();
    });

    wrap.appendChild(el);
    if (counter) wrap.appendChild(counter);
    return wrap;
  }

  function renderNextButton(question) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "primary-btn";
    btn.textContent = "Next";
    btn.disabled = !isSatisfied(question);
    btn.addEventListener("click", () => {
      btn.disabled = true;
      goNext();
    });
    return btn;
  }

  // A reloaded draft never re-asks answered questions — resume at the
  // first unanswered visible question, not the start. No respondent's
  // work is ever lost, and that includes not making them redo it.
  if (draft?.answers) {
    if (state.answers.A3) {
      state.roleBand = instrument.optionIndex.get(`A3:${state.answers.A3}`)?.band ?? "unassigned";
    }
    const steps = visibleQuestions();
    const firstUnanswered = steps.findIndex((q) => !isAnswered(q));
    state.currentIndex = firstUnanswered === -1 ? Math.max(0, steps.length - 1) : firstUnanswered;
    if (state.phase === "welcome") state.phase = "question";
  }

  // Re-render on crossing the mobile/desktop breakpoint (window resize or
  // device rotation) so the layout switches without needing a reload.
  matchMedia(WIDE_QUERY).addEventListener("change", () => {
    if (state.phase === "question") render();
  });

  render();
}
