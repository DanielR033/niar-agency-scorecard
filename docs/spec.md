# NIAR Agency Readiness Scorecard — Build Specification v1

**Project:** National Infrastructure Asset Repository (NIAR) — Barbados
**Framework:** IDB Technical Cooperation RG-T4271-P001-T003
**Prepared by:** Azurian Consulting
**Status:** Draft for internal approval prior to build

---

## 1. Positioning — what this instrument actually is

This is not a new survey. It is the **Agency Readiness Scorecard** already defined as Step 1 of the Agency Onboarding Procedure (Annex 1, Table 7), delivered as a digital instrument.

That distinction matters for three reasons:

1. **It is already in the approved architecture.** We are not adding scope; we are operationalising a component the roadmap already commits to. The Technical Proposal also lists the "NIAR Readiness Scorecard" and the "Digital Maturity Radar" as innovative artifacts of the engagement.
2. **Its output is a decision, not a report.** Each completed session produces an integration tier assignment (A / B / C / D per TO-BE Table 10), a pre-processing requirements list, and a wave placement recommendation. These feed the roadmap directly.
3. **It is reusable.** Once built, the same instrument onboards Wave 2 and Wave 3 agencies and re-baselines existing ones. It becomes a permanent asset of the NIAR Data Office rather than a one-off consulting artefact.

### Comparability constraint (non-negotiable)

The four new agencies must land on **the same radar as the fourteen already assessed**. The instrument therefore reuses, without modification:

- The **eight maturity dimensions** of the Digital Maturity Snapshot (Chart 11)
- The **0–5 maturity spectrum** of Table 16 (Nonexistent → Intelligent National Platform)
- The **Data & Systems Discovery** variables behind Annex 1 Tables 1 and 2

Any result that cannot be plotted against the existing 2.1 ecosystem baseline is not usable.

---

## 2. Design principles

### 2.1 Behavioural anchoring, not self-rating

No respondent is asked to rate themselves from 0 to 5. Each question offers concrete descriptions of a practice; the respondent selects the one that resembles what their team actually does. The engine performs the scoring.

This resolves three problems at once: the ambiguity of abstract scales, social desirability bias (everyone answers "4"), and the language and register barrier in a remote setting.

### 2.2 Intermediate technical register

The instrument is written for a competent professional who is not necessarily a GIS specialist. No consulting vocabulary in respondent-facing text. Terms such as *metadata*, *CRS* and *API* appear only where unavoidable, and always with a plain-language tooltip.

Target completion time: **10–12 minutes**, mobile-first, single-tap answers.

### 2.3 Technology focus

Per instruction, the instrument concentrates on the variables that materially affect the TO-BE architecture and the existing roadmap. Change management content is delivered in the live demonstration segment of the session, not in the form.

Every question earns its place by feeding a named architectural decision. The traceability is shown in §4.

---

## 3. Output model

### 3.1 Maturity radar (8 axes, 0–5)

Weighting of items per axis reflects the technology focus:

| Axis | Items | Rationale |
|---|---|---|
| Technology & Infrastructure | 2 | Hosting and continuity constraints |
| Interoperability & Integration | 3 | Determines integration tier |
| Data Management & Quality | 3 | Determines validation pipeline load |
| Metadata & Discoverability | 2 | Determines V3/V4 gate pass rate |
| Security & Access Control | 2 | Determines V5 gate and classification tier |
| Operational Processes | 2 | Determines freshness KPI feasibility |
| Governance & Institutional Roles | 1 | Determines V4 governance gate |
| Human Capacity | 1 | Determines wave placement and support intensity |

### 3.2 Derived integration tier (TO-BE Table 10)

Assigned automatically from the Discovery block, then validated live with the agency in the session:

| Condition | Tier |
|---|---|
| ArcGIS Online / Enterprise present **and** data already published as services | **A** — Direct ArcGIS Online publication |
| Operational system present (WMS / CIS / ERP / SCADA) with API or ODBC potential | **C** — Operational system API connector |
| ≥ 50% of key information held on paper or analog only | **D** — Assisted digitization |
| All other profiles | **B** — File-based submission portal |

An agency may receive a **primary and a secondary tier** (e.g. D for legacy records, B for current production). This is expected and should be recorded, not resolved artificially.

### 3.3 Divergence engine — the working core of the session

Because each session is a single agency, the primary lens is **intra-agency divergence**, cross-tabulated by the role segmentation captured in Block A.

| Reading | Condition | Interpretation for the room |
|---|---|---|
| **Optimism Gap** | Leadership scores materially above operational staff on the same dimension | Not a data problem — a management visibility problem. The most valuable finding the instrument can produce. |
| **Hidden Capability** | Operational staff score above leadership | Capability exists but is not recognised or resourced. Frequently a quick win. |
| **Dispersion** | Range ≥ 2 levels among respondents regardless of role | Absence of a shared internal definition of the practice. Predicts inconsistent data submissions. |
| **Baseline delta** | Agency dimension score vs. the 2.1 ecosystem baseline | Positions without ranking — consistent with the assessment's stated principle of not evaluating institutions in isolation. |

The facilitator screen surfaces **"Top 3 divergences to address now"**, each with a pre-drafted probe. Example of generated output:

> **Metadata & Discoverability — responses at levels 0, 3 and 5 (range 5)**
> *Suggested probe:* "Can someone show us the last metadata record that was actually completed? Who here has seen it?"

This is what converts a questionnaire into a working session. The divergence stops being statistical noise and becomes the agenda.

### 3.4 Session outputs (auto-generated, exportable)

1. Agency maturity radar, 8 axes, with the ecosystem baseline overlaid
2. Recommended integration tier, primary and secondary
3. Pre-processing requirements checklist (digitization / format conversion / CRS normalisation / attribute mapping / metadata completion)
4. Predicted validation pipeline risk by gate (V1–V5)
5. Divergence log with facilitator notes captured live
6. Wave placement recommendation
7. Raw response export (CSV / JSON) for the deliverable annexes

---

## 4. Question bank

All respondent-facing text in English. Scores shown here for build reference only — **never displayed to the respondent**.

### Block A — Identification (5 items)

| # | Question | Options |
|---|---|---|
| A1 | *Agency* | Pre-set per session, not shown |
| A2 | Your name *(optional)* | Free text |
| A3 | Which best describes your role? | Executive / Director · Manager or Supervisor · GIS or IT specialist · Field or operations staff · Records or data entry · Other |
| A4 | How do you work with your agency's information? | I collect or create it · I process or map it · I use it to make decisions · I manage the team that does · I don't work with it directly |
| A5 | How long have you worked here? | Under 2 years · 2–5 · 6–10 · Over 10 |

> A3 and A4 are what make divergence interpretable. Without role segmentation, dispersion is unreadable.

### Block B — Systems & Data Discovery (9 items)

*Lineage: Rowmell's Survey123 instrument + Annex 1 Tables 1 and 2. Multi-select unless noted.*

| # | Question | Options | Feeds |
|---|---|---|---|
| B1 | Which of these tools does your team use? | ArcGIS Online · ArcGIS Enterprise (Portal) · ArcGIS Pro · ArcMap (older version) · QGIS · AutoCAD · Google Earth / Maps · MS Excel · MS Access · None of these | Table 1 · Tier |
| B2 | In what form do you keep information about your assets and locations? | Shapefiles · Geodatabase · GeoPackage · KML / KMZ · CAD (dwg, dxf) · Excel or CSV · PDF reports · Paper records, maps or files · Photographs | Table 2 · G1, G2 |
| B3 | Roughly how much of your key information exists only on paper? *(single)* | None · Some (under 25%) · About half · Most (over 50%) · Almost all | G1 · Tier D trigger |
| B4 | Does your agency run any of these systems? | Work or Maintenance Management System · Customer Information System · ERP · SCADA or telemetry · Asset register in a database · Ticketing or incident system · None of these | G3 · Tier C trigger |
| B5 | When your team records where something is located in the field, how is it done? *(single)* | GPS or survey equipment · Mobile app (Field Maps, Survey123 or similar) · Phone GPS and a note · We describe the place in words · We mark it on a printed map · We don't record location | Pre-processing sub-layer |
| B6 | Which coordinate system do you normally use? *(single)* | Barbados National Grid · WGS84 latitude/longitude · UTM · Different ones depending on the dataset · Not sure | CRS normalisation · V2 gate |
| B7 | How often is your main information updated? *(single)* | Continuously or daily · Weekly · Monthly · Quarterly · Once a year or less · Only when a project requires it | Freshness KPI |
| B8 | Could another agency obtain your data today? *(single)* | Yes — it is published online and they can access it · Yes — but we must export and send it · Only after an approval process · No — it stays internal · We have never been asked | Tier A trigger |
| B9 | Do you hold information that could **not** be shared openly? | Personal data of citizens · Commercially sensitive information · Security-sensitive locations · Data owned by a third party · Nothing restricted · Not sure | V5 gate · Classification |

### Block C — Core maturity (16 items, behaviourally anchored 0–5)

**Technology & Infrastructure**

**C1 — Where does your team's main information live?**
`0` On individual computers or USB drives · `1` On a shared folder or network drive · `2` On a departmental server · `3` In a managed database or geodatabase used by the whole team · `4` On an enterprise platform with backup and defined administration · `5` On an enterprise or cloud platform with monitoring, backup and documented recovery

**C2 — If your main system stopped working tomorrow, what would happen?**
`0` We would lose information; there is no copy · `1` Someone probably has a copy somewhere · `2` We make copies from time to time, manually · `3` Backups run automatically and we know where they are · `4` Backups are automatic and we have tested restoring them · `5` We have a tested recovery plan with a defined recovery time

**Interoperability & Integration**

**C3 — How do you usually share data with another agency?**
`0` We don't share data · `1` Printed copies or PDF · `2` Email with a file attached · `3` A shared drive or file transfer service · `4` An online map service others can connect to · `5` A service or API that other systems read automatically

**C4 — When you receive data from another agency, how much work is needed before you can use it?**
`0` We cannot use it at all · `1` A great deal — we retype or redraw it · `2` Significant — we reformat and correct fields by hand · `3` Some — a known conversion we do routinely · `4` Little — formats mostly match ours · `5` None — it loads directly into our system

**C5 — Do the field names and codes in your datasets follow a written standard?**
`0` No — each person names things their own way · `1` There is a habit, but nothing written · `2` One or two datasets follow an internal convention · `3` We have a written internal standard for our main datasets · `4` Our standard is aligned with a national or international one · `5` Compliance is checked automatically before publishing

**Data Management & Quality**

**C6 — Who checks that the data is correct before it is used or shared?**
`0` Nobody checks · `1` The person who made it, informally · `2` A colleague reviews it when there is time · `3` A named person reviews it as part of the process · `4` We apply a checklist or rules to every dataset · `5` Automated validation rules run and errors are logged

**C7 — If two versions of the same dataset exist, how do you know which one is correct?**
`0` We would not know · `1` We ask around · `2` The file name or date tells us · `3` There is one agreed master location · `4` Versioning is controlled by the system · `5` Version history and changes are fully traceable

**C8 — How complete is your information about the assets you are responsible for?**
`0` We do not have an inventory · `1` Partial and out of date · `2` Most assets, with gaps we are aware of · `3` Complete for our main assets, updated periodically · `4` Complete and updated on a defined cycle · `5` Complete, updated, and measured with quality indicators

**Metadata & Discoverability**

**C9 — When you share a dataset, what travels with it?**
`0` Nothing — the file as it is · `1` The file name and a short note in the email · `2` An internal document explaining the fields · `3` A standard description form completed for every dataset · `4` A description record published in a catalogue others can search · `5` Descriptions generated automatically and audited periodically

**C10 — Could a new member of staff find and understand your datasets without asking a colleague?**
`0` No — everything is in people's heads · `1` Only with a great deal of help · `2` Some datasets are documented · `3` Main datasets are documented and kept in a known place · `4` There is a catalogue with descriptions and named owners · `5` The catalogue is searchable, maintained and used daily

**Security & Access Control**

**C11 — How is access to your information controlled?**
`0` Anyone in the office can open anything · `1` Files sit on a shared drive with no specific rules · `2` Some folders are restricted informally · `3` Access is granted by role and requested formally · `4` Access is managed by the system with individual accounts and logs · `5` Access is reviewed periodically and audited

**C12 — Has your agency classified which information is open, restricted or confidential?**
`0` No · `1` We know informally which information is sensitive · `2` Some datasets are marked · `3` There is a written classification for our main datasets · `4` Classification is applied to every dataset and enforced by the system · `5` Classification is enforced, audited and reviewed

**Operational Processes**

**C13 — Is the procedure for updating your data written down?**
`0` No — each person does it their own way · `1` It is known by the people who do it · `2` There are informal notes · `3` There is a documented procedure · `4` The procedure is documented and followed consistently · `5` The procedure is documented, measured and improved

**C14 — How do you know when your data is out of date?**
`0` We do not · `1` Someone notices eventually · `2` We check when a request comes in · `3` We review it on a schedule · `4` The system shows the last update date for every dataset · `5` We track freshness indicators and act on them

**Governance & Institutional Roles**

**C15 — Is there a person formally responsible for your agency's data?**
`0` No · `1` Someone does it informally, on top of their own job · `2` It is understood who it is, but not written anywhere · `3` The responsibility is written into someone's role · `4` There is a named data owner and steward with defined duties · `5` Roles are defined, staffed and reviewed

**Human Capacity**

**C16 — If the person who mainly handles your GIS or data work left tomorrow, what would happen?**
`0` The work would stop · `1` Major disruption — we would have to rebuild the knowledge · `2` Someone could partially cover · `3` Another person is trained to cover · `4` The work is shared across a team · `5` There is a documented team structure with defined backups

### Block D — Open input (1 item, optional)

**D1 — What is the one thing that would make sharing your data with NIAR easier for your team?**

> Historically the highest-value field in instruments of this type. Optional, free text, no character limit.

**Total: 31 items · estimated 10–12 minutes.**

---

## 5. Session design

Each of the four agencies receives a dedicated session. One agency's session is split across two parts.

### Standard single session — 90 minutes

| Time | Segment | Purpose |
|---|---|---|
| 0–08 | Opening and framing | Why we are meeting. Explicit: this is not an audit and agencies are not being ranked. |
| 08–20 | NIAR demonstration | Show the MVP. Make the abstraction tangible before asking anything. |
| 20–32 | Change management segment | Role clarity, what participation means, what the agency gains. |
| 32–40 | Assessment introduction | The eight dimensions, the 0–5 scale, what happens to their answers. |
| 40–55 | QR and completion | On-screen QR, everyone completes simultaneously, cameras on. |
| 55–82 | **Live results and divergence work** | The radar builds live. Then we work the prioritised divergences. This is the interview. |
| 82–90 | Close | Tier validation, missing data, next steps and named follow-up contact. |

### Split session — the agency meeting in two parts

Recommended break point: **after completion of the form.**

- **Part 1 (60 min):** Opening · Demonstration · Change management · Assessment introduction · QR and completion
- **Between sessions:** we read the results, prepare the divergence analysis, and pre-draft the probes
- **Part 2 (60 min):** Radar reveal · Divergence work in depth · Tier validation · Close

This is strictly better than the single-session version for that agency, because the analysis is prepared rather than improvised. If the client is open to it, consider whether a second agency would also benefit from this structure.

### Facilitator screen (separate URL, not shown to respondents)

- Live respondent counter and completion progress
- Radar building in real time as responses arrive
- Top 3 divergences with pre-drafted probes
- Role-band comparison view (leadership vs operational)
- Derived tier assignment with the evidence that produced it
- Live note field per divergence, saved with the session
- One-click export: PDF scorecard + CSV raw

---

## 6. Technical architecture

**Decided:** static site on **GitHub Pages**, aggregation on **Supabase**.

### Front end
- Plain HTML / CSS / JavaScript with native ES modules. No build step, no framework, no bundler.
- Served from `https://<org>.github.io/<repo>/` — **every path must be relative**
- Mobile-first: respondents complete on their phones via QR
- Visual system per `docs/design-system.md`
- Two entry points:
  - `index.html?s=SESSION_CODE` — respondent form (QR target)
  - `facilitator.html?s=SESSION_CODE&k=FACILITATOR_KEY` — live dashboard
- Radar rendering: hand-rolled canvas, no charting library

### Back end — Supabase

Managed Postgres with a REST interface callable directly from static HTML. Free tier is ample for this volume. Two tables: `sessions`, `responses`.

**Security model — this matters because GitHub Pages exposes the source.** The anonymous key will be readable by anyone who views source. The design does not hide it; it removes its power:

- RLS on `responses`: anonymous role may `INSERT` only. No `SELECT`, no `UPDATE`, no `DELETE`.
- The facilitator dashboard never queries the table directly. It calls a `SECURITY DEFINER` RPC that requires both the session code and a facilitator key, and returns only that session's rows.
- Session codes are short and human-typeable; facilitator keys are long and random.
- No personal data is required by the instrument (A2 is optional), which keeps the exposure surface low by design.

The implementation uses a **storage adapter** — a single configuration object — so the backend can be swapped without touching the instrument. If the Government of Barbados later requires the data to sit inside the eGIS portal, the same question bank can be expressed as an XLSForm for Survey123 with the dashboard reading the exported feature service.

### Resilience — a real constraint for a remote island session

- Responses submit on a single call; failure triggers automatic retry
- On persistent failure the response is held in browser local storage and a short alphanumeric code is displayed, which the facilitator can enter manually on the dashboard. No respondent's work is ever lost.
- The facilitator dashboard polls every 5 seconds rather than holding a websocket — more robust on unstable connectivity
- The dashboard functions on a cached dataset if the connection drops mid-session

---

## 7. Open items required before build

| # | Item | Why it blocks |
|---|---|---|
| 1 | ~~Rowmell's Survey123 question set~~ | **Closed.** Reconciled into Block B; see `source` fields in `questions.json` |
| 2 | ~~Backend decision~~ | **Closed.** Supabase on GitHub Pages |
| 3 | Full legal names of MEB and BSS, and expected attendees per session | Determines phrasing and whether the reciprocity or mandate model applies. Build is not blocked. |
| 4 | Identity of the fourth agency | Three are named (MEB, BSS, MTW). Session config only. |
| 5 | Confirmation of the national CRS with Lands & Surveys | Needed for the standardisation phase, not for capture. B7 measures awareness; authoritative CRS is read from the files at onboarding. |

### Note on MTW

The Ministry of Transport and Works is **already assessed** — it appears among the fourteen agencies of the original Digital Maturity Assessment and is listed as Tier B eligible in TO-BE Table 10. That session is a **re-baseline**, not a first capture, and is more valuable framed as such: the dashboard should support overlaying a prior radar alongside the live one. Worth stating explicitly to the agency and to the IDB.

### Note on BSS

If BSS is the Barbados Statistical Service, expect `B1 = "Secondary data"` — a consumer rather than a producer of geospatial data. Block C still applies in full: a consuming agency has data management, metadata and access practices that score. No conditional skip is implemented for this case.

---

## 8. Recommended review gate

Before the build, the specification passes the standard two-agent review:

- **Technical architect review** — traceability of every question to a TO-BE component or roadmap decision; validity of the tier assignment logic; soundness of the scoring model
- **Design director review** — respondent comprehension at the target register; mobile ergonomics; visual impact of the live reveal; brand authenticity

Both critiques are resolved before any code is written.
