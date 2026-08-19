# Kickoff prompt

Paste this as the first message in Claude Code, from the repository root, after unzipping the handoff kit into it.

---

```
Unzip files.zip into the project root. It contains CLAUDE.md, PROMPT.md,
docs/spec.md, docs/design-system.md and src/questions.json.

Read CLAUDE.md and docs/spec.md in full before writing a single line.
The spec is the contract for this build; CLAUDE.md is the standing set
of rules. docs/design-system.md governs everything visual.

CONTEXT
A digital maturity assessment instrument for agencies joining the
National Infrastructure Asset Repository (NIAR) in Barbados, under IDB
Technical Cooperation RG-T4271-P001-T003. Three of the four agencies
are MEB, BSS and MTW. Respondents answer on their phones via QR during
a live working session; a facilitator projects a dashboard that builds
a maturity radar in real time and surfaces where answers inside the
same agency disagree. Those disagreements are the agenda of the
meeting. MTW was assessed previously, so the dashboard must support
overlaying a prior radar beside the live one.

WHAT I WANT FIRST
Do not start coding. Begin by reporting back:
  1. Your reading of the three questions this build has to get right
  2. Anything in the spec you think is wrong, underspecified or will
     cause trouble in practice
  3. Your plan for Pass 1

Then run the two review subagents defined in CLAUDE.md — technical
architect and design director — and give me both critiques before we
proceed to code.

Build in the three passes defined in CLAUDE.md, stopping at the end of
each for my review. Pass 1 is logic only, with tests, no UI.
```

---

## After Pass 1

```
Approved. Proceed to Pass 2: index.html, mobile-first, storage.js on the
local adapter, no Supabase yet. Test it at 390px width before you show
me anything. Report the actual completion time you estimate for the
full instrument on a phone.
```

## After Pass 2

```
Approved. Proceed to Pass 3: facilitator.html with the full reveal
choreography from docs/design-system.md. Build it against seeded fake
responses first so the animation can be tuned without a backend. Wire
Supabase only once the choreography is right.
```

## Supabase wiring

```
Now wire Supabase. Write supabase/schema.sql first and walk me through
the RLS policies and the facilitator RPC before applying anything.

Non-negotiable: the anonymous role gets INSERT on responses and nothing
else. The dashboard reads only through a SECURITY DEFINER function that
requires both session code and facilitator key. The anon key will be
public in the GitHub Pages source and the design must assume that.
```

## Deployment check

```
Verify the build works when served from a subpath, as GitHub Pages does
(https://<org>.github.io/<repo>/). Every asset, module import and fetch
must use a relative path. Serve it locally from a subdirectory and prove
it, don't assume it.

Then generate the QR codes for each session URL and give me a one-page
run sheet for the facilitator: what to open, in what order, what to do
if a respondent's submission fails, and how to enter a fallback code by
hand.
```
