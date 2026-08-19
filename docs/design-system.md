# Design System — NIAR Agency Readiness Scorecard

## Principle

Barbados suggested, never literal. Ultramarine blue and gold used together at equal weight read as a flag, and a flag reads as cheap. The resolution: **ultramarine as structure, gold as scarcity.**

Gold appears on exactly one thing per screen — the protagonist datum. That restriction is what makes it look expensive instead of patriotic.

The form is sober and fast. All visual energy is spent on the dashboard.

## Palette

```css
:root {
  /* structure — ultramarine taken down to near-black */
  --ground:       #0A1628;
  --surface:      #111F38;
  --surface-lift: #16294A;
  --line:         #223A5E;

  /* scarcity — one element per screen */
  --gold:         #FFC726;
  --gold-dim:     #C9971A;

  /* data */
  --sea:          #2DD4BF;  /* agency polygon */
  --sky:          #7DD3FC;  /* operational role band */
  --indigo:       #6366F1;  /* leadership role band */
  --ghost:        #3D5A80;  /* 2.1 baseline — always recessive */

  /* signal */
  --alert:        #FF6B5A;  /* divergence — coral, not traffic-light red */

  /* type */
  --text:         #F0F4F8;
  --text-muted:   #8CA0B8;
}
```

Coral rather than red for divergence is deliberate. Divergence is the interesting finding, not the failure state, and the room should not read it as an accusation.

## Typography

- **Fraunces** — the score figure and the reveal headlines. Variable serif with real character. Use the optical size and weight axes.
- **Inter Tight** — all UI, questions, options, labels.

Both from Google Fonts. Preload the two weights actually used; do not pull the full families.

The score figure is the largest element on the dashboard by a wide margin. It should be uncomfortable how big it is.

## Form (`index.html`)

Restrained on purpose. The respondent has twelve minutes and a phone.

- One question per screen on mobile; grouped by block on wider viewports
- Options are full-width tap targets, minimum 48px, generous vertical rhythm
- Selected state: `--surface-lift` fill with a `--gold` left rule 3px. This is the form's one gold element.
- Progress: a thin `--gold-dim` rule at the top, no percentage figure, no step counter — counters make people rush
- Transitions between questions: 180ms, ease-out, translate and fade. Nothing longer.
- Anchored options are long sentences. Set them at comfortable reading size with real line-height; do not compress to fit more on screen.

## Dashboard (`facilitator.html`) — reveal choreography

This is the moment the session turns. Sequence:

1. **Grid draws itself.** Octagonal web, `stroke-dasharray` animated, ~800ms, `--line`.
2. **Baseline enters.** The 2.1 ghost octagon fades in at `--ghost`, low opacity. It sets the reference before the agency appears.
3. **Agency polygon grows from centre, axis by axis.** 80ms stagger between vertices, spring easing. Fill `--sea` at low alpha, stroke at full.
4. **Vertices land in gold.** Each axis terminates in a `--gold` dot as it arrives.
5. **Score counts up.** 0.0 to final, Fraunces, oversized. Ends on the gold dot of nothing else — this is the screen's protagonist.
6. **Divergence cards enter from the right,** one at a time, 120ms apart. The first carries a `--alert` halo.

### Live updates

Every incoming response **re-forms the polygon with a spring, never a jump.** People watch the shape move when a colleague submits. That is what turns a progress bar into a moment — and it is the single most important animation in the build.

### Role band overlay

Toggleable. Leadership polygon in `--indigo`, operational in `--sky`, both at low fill alpha over the agency polygon. When an Optimism Gap is detected, the gap area between the two fills at `--alert` low alpha. The picture makes the argument before anyone speaks.

## Motion rules

- Spring easing for anything representing data changing. Linear or ease-out for chrome.
- Nothing exceeds 900ms.
- `prefers-reduced-motion: reduce` — all of the above becomes a straight fade at 150ms, no exceptions, no partial compliance.

## Projection constraints

The dashboard will be shown over a video call and possibly a projector.

- Minimum body size 18px; never rely on hairlines under 2px
- Test contrast against a washed-out projector: the `--ghost` baseline must stay visible
- No information carried by colour alone — divergence cards carry a text label as well as the coral halo
- Assume a 16:9 viewport but do not break below 1280px wide
