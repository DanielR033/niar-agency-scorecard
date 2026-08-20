# Backlog

Post-Pass-3 facilitator dashboard improvements, surfaced live during the
BSS session (2026-08-20). Not started — run the usual two-subagent review
(technical architect + design director) before building, per CLAUDE.md.

## 1. Explicit "gaps to work on" panel

Today the radar shows dimension scores visually, but nothing names the
weakest dimensions in words. Requested during BSS: a ranked list (weakest
first, or biggest negative delta vs. the 2.1 baseline) with plain-language
framing — e.g. "Metadata & Discoverability (1.4) — furthest below where
NIAR needs you." Pure read of `scores.dimensionScores` already computed
by dashboard.js; no new data or schema needed.

## 2. Per-respondent overlay on the radar

A toggle/selector to show one individual respondent's polygon on the
radar (not just the aggregate or role-band view), so the facilitator can
point at "this is what this specific person said" live in the room.

## 3. Raw response viewer

A screen/panel to browse each respondent's actual answers (including the
D1-D3 free text), so the room can work from specific answers instead of
staying at "several people answered, and answered differently." Likely
pairs naturally with #2.

## Context that shaped these

Live analysis of BSS's first 6 real responses turned up:
- No operational/field-staff respondents that session (all leadership or
  technical) — Optimism Gap/Hidden Capability couldn't be computed at all,
  which is itself worth surfacing to a facilitator somehow (a "no
  operational respondents yet" notice?), not just silently absent.
- Three independent free-text answers naming the Statistics Act /
  legal framework, not technology, as the real blocker to data sharing —
  reinforces that D3-style free text is high-value and worth making easy
  to browse (feeds directly into #3).
