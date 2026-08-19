# NIAR Agency Readiness Scorecard

Digital maturity assessment instrument for agencies joining the National Infrastructure Asset Repository (NIAR), Barbados.

Prepared by Azurian Consulting under IDB Technical Cooperation RG-T4271-P001-T003.

## What it is

This operationalises **Step 1 of the Agency Onboarding Procedure** (Annex 1, Table 7) as a digital instrument. It is not a new survey — it is an existing commitment in the approved architecture, delivered as a working tool.

Each session produces:

1. An eight-dimension maturity radar, plotted against the 2.1 ecosystem baseline
2. An integration tier assignment — A, B, C or D per TO-BE Table 10
3. A pre-processing requirements checklist
4. Predicted validation pipeline risk by gate, V1 to V5
5. A divergence log captured live in the room
6. A wave placement recommendation

Because the instrument reuses the eight dimensions and the 0–5 spectrum of the original assessment, new agencies land on the same radar as the fourteen already assessed. Any result that cannot be plotted against the existing baseline is not usable.

## How a session runs

Respondents complete the instrument on their phones via QR, live, in about twelve minutes. The facilitator projects a dashboard that builds the radar as responses arrive and surfaces the three most significant disagreements inside the room — each with a pre-drafted probe.

Intra-agency divergence is the point. Two readings drive the conversation:

- **Optimism Gap** — leadership scores above operational staff. Not a data problem; a management visibility problem.
- **Hidden Capability** — operational staff score above leadership. Capability exists but is not recognised or resourced.

Both are actionable and neither is accusatory, which is what makes them usable in front of the agency.

## Handoff kit

| File | Purpose |
|---|---|
| `CLAUDE.md` | Standing rules for the build. Read first. |
| `PROMPT.md` | Kickoff prompt and the prompts for each subsequent pass |
| `docs/spec.md` | The build contract — instrument design, session design, architecture |
| `docs/design-system.md` | Palette, typography, reveal choreography, motion rules |
| `src/questions.json` | The instrument itself. Data, never code. |

Reference documents from the engagement — Annex 1, NIAR TO-BE, the Digital Maturity Assessment and the brand manual — belong in `docs/reference/`.

## Stack

Static site on GitHub Pages. Plain HTML, CSS and JavaScript with native ES modules — no build step, no framework. Supabase for aggregation, with the anonymous role restricted to insert and the facilitator dashboard reading through a `SECURITY DEFINER` RPC.

## Reuse

Once built, the same instrument onboards Wave 2 and Wave 3 agencies and re-baselines those already assessed. It becomes a permanent asset of the NIAR Data Office rather than a one-off consulting artefact.
