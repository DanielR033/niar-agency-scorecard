# CLAUDE.md — NIAR Agency Readiness Scorecard

Operating rules for this repository. Read `docs/spec.md` before writing code; it is the contract.

## What this is

A digital maturity assessment instrument for agencies participating in the National Infrastructure Asset Repository (NIAR) in Barbados, delivered under IDB Technical Cooperation RG-T4271-P001-T003.

Respondents complete it on their phones via a QR code during a live working session. A facilitator projects a dashboard that builds a maturity radar in real time and surfaces where answers inside the same agency disagree. Those disagreements are the agenda of the meeting.

The audience for everything this produces is Cabinet-level stakeholders and IDB senior specialists.

## Hard constraints

1. **No build step.** Plain HTML, CSS and JavaScript with native ES modules. No bundler, no framework, no npm install required to run.
2. **GitHub Pages hosting.** Served from a subpath. Every path must be relative. No leading slashes.
3. **`src/questions.json` is data, never code.** Questions, options, scores, tier rules, validation-gate rules, pre-processing triggers and divergence conditions all live there. Rewording an option or reordering a block must never require touching JavaScript. If you find yourself hardcoding a question, stop.
4. **Scores are never shown to respondents.** The 0–5 values exist only in the engine and the facilitator view.
5. **All user-facing text in English.** Target register: a competent professional who is not a GIS specialist.
6. **Completion time 12–14 minutes on a phone.** If a change pushes past that, say so.

## Architecture

```
index.html            respondent form — QR target
facilitator.html      live dashboard
src/
  questions.json      the instrument (data)
  scoring.js          0–5 item scores → 8 dimension scores → agency score
  tiering.js          integration tier A/B/C/D from derivations.integration_tier
  divergence.js       Optimism Gap / Hidden Capability / dispersion / baseline delta
  radar.js            canvas render + reveal animation
  storage.js          adapter: 'local' | 'supabase'
assets/               fonts, styles, brand
supabase/schema.sql   tables, RLS policies, facilitator RPC
docs/
  spec.md             build contract
  design-system.md    visual system
```

## Scoring model

- Dimension score = unweighted mean of its item scores
- Agency score = unweighted mean of the eight dimension scores
- Baseline overlay = 2.1, the NIAR ecosystem score from the original assessment
- Round to one decimal

Do not invent weighting. The original assessment aggregated unweighted, and comparability with the fourteen agencies already assessed is the reason this instrument exists.

## Backend and security

Supabase. Two tables: `sessions`, `responses`.

The anonymous key is visible in the source on GitHub Pages. The design does not hide it, it removes its power:

- RLS on `responses`: anonymous role may `INSERT` only. No `SELECT`, `UPDATE` or `DELETE`.
- The dashboard never queries the table directly. It calls a `SECURITY DEFINER` RPC requiring session code **and** facilitator key, returning only that session's rows.
- Session codes short and typeable. Facilitator keys long and random.

Never widen anonymous permissions to make something convenient.

## Resilience

Sessions run remotely on island connectivity. Failure modes are expected, not exceptional.

- Submission retries automatically on failure
- On persistent failure, hold the response in `localStorage` and show a short code the facilitator can enter manually. **No respondent's work is ever lost.**
- The dashboard polls every 5 seconds. No websockets.
- The dashboard keeps functioning on its cached dataset if the connection drops mid-session

## Working method

Build in three passes. **Stop at the end of each pass for review.**

- **Pass 1** — `scoring.js`, `tiering.js`, `divergence.js`. Logic only, no UI. Include tests: a known response set must produce the expected radar and tier.
- **Pass 2** — `index.html`. Mobile-first form, `storage.js` on the local adapter. No Supabase yet.
- **Pass 3** — `facilitator.html` with the reveal choreography. Then wire Supabase.

Before each pass, run two review subagents and resolve both critiques before writing code:

- **Technical architect** — every question traceable to a TO-BE component via its `feeds` field; tier evaluation order correct; scoring model sound; no data smuggled into code.
- **Design director** — comprehension at the target register; mobile ergonomics; impact of the reveal; does not look like a template.

This review gate is not optional and not a formality.

## Domain vocabulary

Terms that appear in the source documents and should be used precisely: AS-IS / TO-BE, COBIT 2019, DAMA-DMBOK, TOGAF ADM, ADKAR, Orchestration Layer, Data Standardization Engine, Digitization Sub-Layer, validation pipeline V1–V5, integration tiers A/B/C/D, NIAR Data Office, wave sequencing, Champions / Latent Allies / Laggards, tripartite stewardship (Data Owner / Data Steward / Data Custodian), CRS normalisation, OGC standards (WMS/WFS/WCS), FAIR principles.

## Things that will look like improvements and are not

- Adding a charting library. The radar is hand-rolled on canvas for a reason: control over the reveal animation and zero dependency risk on a live projected session.
- Collapsing an agency to a single integration tier. Primary and secondary tiers are both recorded; an agency can legitimately be D for legacy records and B for current production.
- Skipping Block C when `B1 = "No"` or `"Secondary data"`. A consuming agency still has data management, metadata and access practices that score.
- Showing respondents their score. It changes their answers and destroys the divergence signal.
- Reordering or rewording the options in B2 or B3. Those lists are verbatim from the instrument already answered by thirteen agencies; the reported percentages in Annex 1 derive from those exact option sets.
