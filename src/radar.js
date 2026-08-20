// Hand-rolled canvas radar: octagon grid, ecosystem baseline ghost, an
// optional prior-assessment overlay (MTW re-baseline), the live agency
// polygon, and a role-band overlay. No charting library — control over the
// reveal choreography and zero dependency risk on a live projected session,
// per docs/design-system.md.
//
// Score-to-radius mapping and axis order come entirely from `instrument`
// (loadInstrument() from questions.json) — nothing here hardcodes a
// dimension name or the 0-5 scale bound beyond the scale's own definition.

const COLORS = {
  line: "#223a5e",
  ghost: "#3d5a80",
  sea: "#2dd4bf",
  sky: "#7dd3fc",
  indigo: "#6366f1",
  gold: "#ffc726",
  alert: "#ff6b5a",
};

const MAX_SCORE = 5;

function reduceMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// A gentle overshoot so the polygon feels like it "springs" into place
// rather than merely decelerating into it.
function easeOutBack(t) {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createRadar(container, instrument) {
  const axes = instrument.dimensionIds;
  const n = axes.length;
  const labels = Object.fromEntries(instrument.dimensions.map((d) => [d.id, d.label]));

  // Owns a dedicated host inside `container` rather than clearing it, so a
  // sibling (the DOM score figure, in Fraunces) can live in the same
  // wrapper without radar.js wiping it out on every createRadar() call.
  container.style.position = "relative";
  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.inset = "0";
  host.style.zIndex = "1";
  container.appendChild(host);

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  host.appendChild(canvas);

  const labelLayer = document.createElement("div");
  labelLayer.style.position = "absolute";
  labelLayer.style.inset = "0";
  labelLayer.style.pointerEvents = "none";
  host.appendChild(labelLayer);

  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  let radius = 0;

  function angleFor(i) {
    return -Math.PI / 2 + (i * 2 * Math.PI) / n;
  }

  function pointAt(i, score) {
    const a = angleFor(i);
    const r = (Math.max(0, Math.min(MAX_SCORE, score)) / MAX_SCORE) * radius;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }

  function layout() {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = width / 2;
    cy = height / 2;
    radius = Math.min(width, height) / 2 - 56;
    renderLabels();
  }

  function renderLabels() {
    labelLayer.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const a = angleFor(i);
      const [x, y] = [cx + (radius + 34) * Math.cos(a), cy + (radius + 34) * Math.sin(a)];
      const el = document.createElement("div");
      el.textContent = labels[axes[i]];
      el.style.position = "absolute";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = "translate(-50%, -50%)";
      el.style.width = "120px";
      el.style.textAlign = "center";
      el.style.fontSize = "13px";
      el.style.lineHeight = "1.25";
      el.style.color = "#8ca0b8";
      labelLayer.appendChild(el);
    }
  }

  window.addEventListener("resize", () => {
    layout();
    draw();
  });
  layout();

  // ---- drawing primitives ----

  function drawGrid(alpha) {
    ctx.strokeStyle = rgba(COLORS.line, alpha);
    ctx.lineWidth = 1;
    for (let level = 1; level <= MAX_SCORE; level++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const [x, y] = pointAt(i % n, level);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = pointAt(i, MAX_SCORE);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }

  function polygonPath(scoreAt) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const [x, y] = pointAt(i % n, scoreAt(i % n));
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawGhost(scoreAt, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    polygonPath(scoreAt);
    ctx.fillStyle = rgba(COLORS.ghost, 0.12);
    ctx.fill();
    ctx.strokeStyle = COLORS.ghost;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawPrior(scoreAt, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setLineDash([6, 5]);
    polygonPath(scoreAt);
    ctx.strokeStyle = rgba(COLORS.sea, 0.55);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // One respondent's own polygon — dotted (not dashed, to stay visually
  // distinct from the prior-assessment overlay), no fill, --sky rather
  // than a new hue. Shown for discussion, not attribution: the caller is
  // responsible for never labeling this with anything but an anonymous,
  // session-shuffled respondent number.
  function drawIndividual(scoreAt, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.setLineDash([3, 4]);
    ctx.lineCap = "round";
    polygonPath(scoreAt);
    ctx.strokeStyle = COLORS.sky;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawAgency(scoreAt, alpha, vertexProgress) {
    ctx.save();
    ctx.globalAlpha = alpha;
    polygonPath(scoreAt);
    ctx.fillStyle = rgba(COLORS.sea, 0.18);
    ctx.fill();
    ctx.strokeStyle = COLORS.sea;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const p = vertexProgress ? vertexProgress[i] : 1;
      if (p <= 0) continue;
      const [x, y] = pointAt(i, scoreAt(i));
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = rgba(COLORS.gold, p);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRoleBand(scoreAt, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    polygonPath(scoreAt);
    ctx.fillStyle = rgba(color, 0.14);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.restore();
  }

  function drawOptimismWedges(gapDimensions, leadershipAt, operationalAt) {
    for (const dimensionId of gapDimensions) {
      const i = axes.indexOf(dimensionId);
      if (i < 0) continue;
      const a = angleFor(i);
      const lo = Math.min(leadershipAt(i), operationalAt(i));
      const hi = Math.max(leadershipAt(i), operationalAt(i));
      const [x1, y1] = [cx + (lo / MAX_SCORE) * radius * Math.cos(a), cy + (lo / MAX_SCORE) * radius * Math.sin(a)];
      const [x2, y2] = [cx + (hi / MAX_SCORE) * radius * Math.cos(a), cy + (hi / MAX_SCORE) * radius * Math.sin(a)];
      ctx.save();
      ctx.strokeStyle = rgba(COLORS.alert, 0.7);
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---- animation state ----

  let frame = { gridAlpha: 0, ghostAlpha: 0, priorAlpha: 0, agencyAlpha: 0, vertexProgress: new Array(n).fill(0) };
  let currentScores = new Array(n).fill(0); // what's actually drawn right now, springs toward target
  let targetScores = new Array(n).fill(0);
  let baselineScore = null;
  let priorScores = null;
  let roleBandOverlay = null; // { leadership: [...], operational: [...] , gapDimensions: [...] } | null
  let individualScores = null; // [8 scores] | null — one anonymous respondent
  let rafId = null;

  function scoreAt(i) {
    return currentScores[i];
  }

  function tick() {
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    drawGrid(frame.gridAlpha);
    if (baselineScore !== null) drawGhost(() => baselineScore, frame.ghostAlpha);
    if (priorScores) drawPrior((i) => priorScores[i], frame.priorAlpha);
    if (roleBandOverlay) {
      drawRoleBand((i) => roleBandOverlay.operational[i], COLORS.sky, frame.agencyAlpha * 0.9);
      drawRoleBand((i) => roleBandOverlay.leadership[i], COLORS.indigo, frame.agencyAlpha * 0.9);
      if (roleBandOverlay.gapDimensions?.length) {
        drawOptimismWedges(
          roleBandOverlay.gapDimensions,
          (i) => roleBandOverlay.leadership[i],
          (i) => roleBandOverlay.operational[i]
        );
      }
    }
    drawAgency(scoreAt, frame.agencyAlpha, frame.vertexProgress);
    // Drawn last (on top of the agency fill) so its dotted stroke stays
    // fully legible instead of being muted wherever it falls inside the
    // agency polygon's semi-transparent fill.
    if (individualScores) drawIndividual((i) => individualScores[i], frame.agencyAlpha);
  }

  function animate({ duration, onFrame, onDone }) {
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      onFrame(t);
      draw();
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      } else if (onDone) {
        onDone();
      }
    }
    rafId = requestAnimationFrame(step);
  }

  function cancelAnimation() {
    if (rafId) cancelAnimationFrame(rafId);
  }

  // ---- public: score count-up (DOM, not canvas — Fraunces lives here) ----

  function animateScoreLabel(el, target, duration) {
    if (!el) return;
    if (reduceMotion()) {
      el.textContent = target.toFixed(1);
      return;
    }
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = (easeOutCubic(t) * target).toFixed(1);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---- public API ----

  function reveal({ dimensionScores, baseline, prior, agencyScore, scoreEl }) {
    cancelAnimation();
    targetScores = axes.map((id) => dimensionScores[id] ?? 0);
    currentScores = new Array(n).fill(0);
    baselineScore = baseline ?? null;
    priorScores = prior ? axes.map((id) => prior[id] ?? 0) : null;
    frame = { gridAlpha: 0, ghostAlpha: 0, priorAlpha: 0, agencyAlpha: 0, vertexProgress: new Array(n).fill(0) };

    if (reduceMotion()) {
      frame = { gridAlpha: 1, ghostAlpha: 1, priorAlpha: 1, agencyAlpha: 1, vertexProgress: new Array(n).fill(1) };
      currentScores = [...targetScores];
      draw();
      animateScoreLabel(scoreEl, agencyScore ?? 0, 150);
      return;
    }

    const GRID_MS = 800;
    const GHOST_MS = 400;
    const PRIOR_MS = 400;
    const STAGGER = 80;
    const GROW_MS = 500;

    animate({
      duration: GRID_MS,
      onFrame: (t) => (frame.gridAlpha = easeOutCubic(t)),
      onDone: () => {
        animate({
          duration: GHOST_MS,
          onFrame: (t) => (frame.ghostAlpha = easeOutCubic(t)),
          onDone: () => {
            const afterGhost = () => {
              const growStart = performance.now();
              function growStep(now) {
                const elapsed = now - growStart;
                let done = true;
                frame.agencyAlpha = 1;
                for (let i = 0; i < n; i++) {
                  const local = elapsed - i * STAGGER;
                  const p = Math.max(0, Math.min(1, local / GROW_MS));
                  if (p < 1) done = false;
                  frame.vertexProgress[i] = p;
                  currentScores[i] = easeOutBack(p) * targetScores[i];
                }
                draw();
                if (!done) requestAnimationFrame(growStep);
                else animateScoreLabel(scoreEl, agencyScore ?? 0, 700);
              }
              requestAnimationFrame(growStep);
            };
            if (priorScores) {
              animate({ duration: PRIOR_MS, onFrame: (t) => (frame.priorAlpha = easeOutCubic(t)), onDone: afterGhost });
            } else {
              afterGhost();
            }
          },
        });
      },
    });
  }

  // Springs the live polygon (and, if present, the role-band overlay) from
  // its current shape to a new one — used for 5s-poll live updates and for
  // toggling the role-band overlay. Never a jump.
  function update({ dimensionScores, agencyScore, scoreEl }) {
    cancelAnimation();
    targetScores = axes.map((id) => dimensionScores[id] ?? 0);
    const from = [...currentScores];
    const duration = reduceMotion() ? 150 : 500;
    animate({
      duration,
      onFrame: (t) => {
        const eased = reduceMotion() ? t : easeOutBack(t);
        for (let i = 0; i < n; i++) currentScores[i] = from[i] + (targetScores[i] - from[i]) * eased;
      },
    });
    if (scoreEl) animateScoreLabel(scoreEl, agencyScore ?? 0, duration);
  }

  function setRoleBandOverlay(overlay) {
    roleBandOverlay = overlay
      ? {
          leadership: axes.map((id) => overlay.leadership?.[id] ?? 0),
          operational: axes.map((id) => overlay.operational?.[id] ?? 0),
          gapDimensions: overlay.gapDimensions ?? [],
        }
      : null;
    draw();
  }

  // Independent of reveal()/update() so the "MTW, then" layer can be
  // shown/hidden without re-running the whole choreography.
  function setPriorOverlay(prior) {
    priorScores = prior ? axes.map((id) => prior[id] ?? 0) : null;
    frame.priorAlpha = prior ? 1 : 0;
    draw();
  }

  // One anonymous respondent's own polygon. `scores` is an 8-key
  // dimension-score map (computeScores([oneResponse], instrument).dimensionScores)
  // or null to clear. Single-select — a new call replaces the previous one.
  function setIndividualOverlay(scores) {
    individualScores = scores ? axes.map((id) => scores[id] ?? 0) : null;
    draw();
  }

  return {
    reveal,
    update,
    setRoleBandOverlay,
    setPriorOverlay,
    setIndividualOverlay,
    layout: () => (layout(), draw()),
  };
}
