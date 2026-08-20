# Backlog

Facilitator dashboard improvements, surfaced live during the BSS session
(2026-08-20). Items 1-3 shipped 2026-08-20 after the usual two-subagent
review (technical architect + design director), per CLAUDE.md.

## 1. Explicit "gaps to work on" panel — done

New "Where to focus" panel, ranked ascending by `scores.dimensionScores`
(top 3 weakest), stable tie-break via `questions.json`'s dimension order.
Copy kept to the coral/non-accusatory register the design system already
uses for divergence — no "failed"/"below standard" language.

## 2. Per-respondent overlay on the radar — done

`radar.js` gained `setIndividualOverlay()` — a dotted `--sky` line, drawn
after the agency fill so it stays legible, distinct from the dashed
`--sea` prior-assessment overlay. Selection is kept by `response.id`
across the 5s poll (`dashboard.js`'s `applyIndividualSelection()`), not
by list position.

## 3. Raw response viewer — done

Respondent detail panel showing every answered question, human-readable
(option labels resolved via `instrument.optionIndex`, scale items shown
as "score — anchor label").

**Consent guardrail (non-negotiable, per design review):** items 2-3
never show A2's optional name, even if given. Respondents are labelled
`R1`, `R2`... in a per-session random order (a `Math.random()` key
assigned once per `response.id`, not submission order), grouped by role
band. Both panels carry a fixed "Shown for discussion, not attribution"
caption. `questions.json`'s `consent_note` was updated so future
respondents are told this may happen.

**Rollout:** both ship behind `?individual=1` (default off) — new canvas
layer + new PII-adjacent surface landing in a tool already live with real
agencies (MEB, BSS run; MTW likely next). Promote to default-on only
after a session using it goes well.

## Context that shaped these

Live analysis of BSS's first 6 real responses turned up:
- No operational/field-staff respondents that session (all leadership or
  technical) — Optimism Gap/Hidden Capability couldn't be computed at all.
  Still not surfaced as an explicit "no operational respondents yet"
  notice anywhere — worth a small follow-up.
- Three independent free-text answers naming the Statistics Act / legal
  framework, not technology, as the real blocker to data sharing —
  motivated making D1-D3 free text easy to browse per-respondent (#3).
