# MindVault — Phase 1 + 2a notes

Status: **2026-11-24, phase 2a complete + 5-variant comparison done + v6
merged submission version built (default).**
Phase 1 (mock provider, fully working app) is done and verified; phase 2a
wired in the real Firebase AI Logic provider + App Check (see "Phase 2a"
below); the 5 UI variants are built and compared (see "5-variant
comparison (results)"); the winner is merged into **v6** (V5 vault +
V2 dashboard + V1 notes), which is now the default build (see "v6 —
merged submission version"). Real cloud/on-device calls are NOT yet
verified end-to-end — they need the App Check debug token registered in
the console AND a networked browser. This file records what is mock vs
real, what phase 2 needs, known limitations, and the 5-variant proposal
required by the standing rule (at least 5 substantially different
versions, compared and tested, before settling).

## What is mock vs real

### Real (production code, no mocking)

- Notes CRUD, search, autosave, delete — real IndexedDB via Dexie.
- Privacy Ledger — real records of real calls (the calls themselves are
  mock in phase 1, but the ledger, counts, export, and reset are real).
- Mood timeline — real chart/heatmap computed from stored sentiment data.
- Photo storage (data URLs in IndexedDB), validation (JPEG/PNG ≤ 5 MB),
  remove.
- PWA shell — real service worker + manifest, installable, offline UI.
- Seed data — real entries with pre-computed analyses.
- Firebase provider — **real code** written against the installed SDK
  13.4.0 types (`firebaseProvider.ts`), including App Check ordering,
  `only_on_device` / `only_in_cloud` modes, structured JSON sentiment
  output, and `inferenceSource` badge mapping. It is inactive only
  because no Firebase config exists yet.

### Mock (simulated in phase 1)

- AI inference results — the mock provider (`src/lib/ai/mockProvider.ts`)
  generates deterministic, rule-based results: extractive summaries,
  lexicon sentiment, templated photo descriptions and cloud results.
  Results look realistic but are not model output.
- Device-model lifecycle — availability states, download progress, and
  the unavailable toggle are simulated (the toggle exists only in mock
  mode, for the graceful-degradation demo).
- Model names are labelled "(simulated)" everywhere, and a banner states
  the build is a demo. Nothing in the UI pretends mock results are real
  model output.

### What changes in phase 2

One config change activates the real provider
(`VITE_AI_PROVIDER=firebase` + `.env` config). No UI or data-layer code
changes are needed — that is the point of the provider seam. Phase 2 work
is: Firebase project + AI Logic + App Check setup, real-device testing
(Chrome 139+ with Prompt API flag), the 5-variant comparison below,
deployment, and the demo video (script approval required before
production).

## Phase 2a — real Firebase provider wired (2026-11-24)

Done:

- Local `.env` created (git-ignored; `.gitignore` covers `.env` and
  `.env.*` except `.env.example`) with `VITE_AI_PROVIDER=firebase`,
  the `mindvault-2026` web config, and the reCAPTCHA Enterprise site
  key. `.env.example` documents the optional `VITE_APPCHECK_DEBUG_TOKEN`.
- `firebaseProvider.ts`: DEV-only App Check debug path — sets
  `self.FIREBASE_APPCHECK_DEBUG_TOKEN` before `initializeAppCheck`
  (`VITE_APPCHECK_DEBUG_TOKEN` when set, else `true`, letting the SDK
  generate + console-log + persist a token). Dead code in production
  builds; production always uses reCAPTCHA Enterprise.
- `index.ts`: provider creation is wrapped in try/catch — if Firebase
  fails to start, the app falls back to the mock provider and
  `getProviderInitError()` exposes the reason; `App.tsx` shows it in a
  red banner. The app never crashes or goes blank because Firebase
  failed. The mock banner text was updated (phase-2 wording).
- New probe: `tests/probe-firebase.mjs` (Playwright, persistent profile
  at `/tmp/mindvault-debug-profile` so the debug token stays valid
  across runs). It captures the SDK-printed debug token from the
  console, probes `LanguageModel` availability, and attempts a real
  cloud call to check graceful failure. The token is printed to stdout
  ONLY — it is never written to any file under `app/`.

Verified in phase 2a (see "Test results" below): `npm run build` passes
with the Firebase config (bundle ~459 KB JS / ~142 KB gzip — Firebase
SDK now included); `npm run test:db` passes; mock smoke tests 17/17 pass
with no regressions; lint 0 errors (same 10 documented warnings).

### App Check debug token

- Captured from the SDK console log during the probe (two separate
  browser launches printed the SAME token — it is stable for the
  persistent profile). The exact value is held by the parent agent, NOT
  in any file — ask the parent for it, or re-run the probe with a fresh
  profile (`rm -rf /tmp/mindvault-debug-profile` first) to generate a
  new one.
- Register it in the Firebase console (App Check > Apps > Manage debug
  tokens) before local real-AI testing. Alternatively set it as
  `VITE_APPCHECK_DEBUG_TOKEN` in local `.env` (git-ignored) to use the
  same token in every browser/profile.
- The token is stored in the persistent probe profile's IndexedDB
  (`/tmp/mindvault-debug-profile`) — reuse that profile dir for
  follow-up local runs, or the SDK will generate a different token.

### Sandbox network limitation — read before phase 2b

- **This VM's headless test browser cannot reach external URLs.** A
  diagnostic fetch from headless Chromium to google.com, googleapis.com,
  firebasevertexai.googleapis.com, and firebaseappcheck.googleapis.com
  ALL failed fast (~200–300 ms) with `TypeError: Failed to fetch`,
  while `curl` from the same VM reached the same endpoints (vertexai
  returned 401 in ~9 s). So the probe's cloud-call failure
  ("Failed to fetch") is a sandbox networking limit, NOT an App Check
  or Firebase failure — and the app handled it gracefully (clear
  in-app error, no crash, no blank screen, zero page errors).
- **Consequence:** real cloud calls and the App Check token exchange
  CANNOT be verified from this VM's headless browser. Phase 2b must
  verify them in a networked browser — the live cloud browser against
  the deployed site (where reCAPTCHA works without a debug token), or a
  real Chrome on a networked machine.
- **On-device probe result (headless Chromium):** the `LanguageModel`
  global EXISTS but `availability()` reports `"unavailable"` — the
  headless shell has no model component. This is a test-browser
  artifact, not an app bug: the app correctly shows the unavailable
  guidance ("On-device AI unavailable" pill + flag instructions).
  Real on-device verification needs Chrome 139+ desktop with the
  Prompt API flag enabled.

## What phase 2 needs (checklist)

- [x] Firebase project + Web app registration; config into local `.env`
      (see `.env.example`; never commit `.env`).
- [x] Firebase AI Logic enabled (Gemini API backend).
- [x] App Check with reCAPTCHA Enterprise; key bound to the production
      domain only. Debug token for local testing only, never committed.
- [x] `VITE_AI_PROVIDER=firebase`; provider switch verified (mock
      banner absent, no init error, graceful degradation confirmed).
- [ ] Register the App Check debug token in the console (value held by
      the parent agent — not in any file).
- [ ] Verify the cloud consent flow + on-device states against the REAL
      models in a networked browser (blocked in this VM's headless
      browser — see "Sandbox network limitation" above).
- [ ] Real-device test matrix: Chrome 139+ with Prompt API enabled
      (on-device available), Chrome without the flag / older Chrome
      (unavailable state + guidance), and a non-Chrome browser
      (unavailable state — the app must still work as a notes app).
- [ ] Deploy to Firebase Hosting (or another static host) and verify on
      the real domain, including App Check enforcement.
- [x] Build + compare the 5 variants below; pick the strongest (or a
      hybrid) by the judging criteria. — DONE 2026-11-24, see "5-variant
      comparison (results)". Recommendation: merge V5 (vault home) +
      V2 (mood dashboard) as the submission; the merge (v6) is BUILT
      2026-11-24 and is now the default — see "v6 — merged submission
      version".
- [ ] Demo video (≤ 3 min) recorded with the **real** provider in a
      compliant Chrome build; script approved before recording.
- [ ] GitHub public repo + completed Devpost submission (video URL, demo
      URL, Additional Info, eligibility attestations).

## Known limitations (phase 1)

1. **Mock results are rule-based.** Summaries extract the note's own
   sentences; sentiment is lexicon-based. Quality will jump with the real
   models — and must be re-tested then (sentiment bands, keyword quality,
   summary length).
2. **No sync / no multi-device.** Notes live in one browser's IndexedDB
   by design (privacy-first). Export is JSON (ledger only); a full
   notes export is a phase-2 nice-to-have, not required.
3. **Photo storage is data URLs.** Fine for a demo and for a handful of
   photos; a production app would store Blobs. The 5 MB limit keeps this
   safe.
4. **Lint: 9 non-blocking warnings, 0 errors.** (Was 10 in phase 1/2a;
   the refactor dropped one `preserve-manual-memoization` warning.) All
   are intentional patterns flagged by the React Compiler rules:
   - 4× `preserve-manual-memoization` — callbacks in `useVault`
     deliberately depend on `selected?.id` rather than the whole
     `selected` object, so they don't churn when note content changes.
   - 4× `set-state-in-effect` — syncing state to external changes
     (selection change, modal open, initial availability refresh).
   - 1× `purity` — `new Date()` inside a `useMemo` in `MoodTimeline`
     (stable per memo cycle).
   None affects runtime behavior; revisit only if the React Compiler is
   enabled.
5. **Smoke test note-creation race (fixed in the test, not the app).**
   The test fills the title immediately after clicking "+ New entry";
   note creation is async, so the fill could land in the previous note's
   editor. The test now waits for the editor to switch to the empty new
   note first. A human cannot type fast enough to hit this, and the app
   flushes the previous note's save before creating a new one, so no
   data loss is possible.

## The 5-variant proposal (phase 2)

Standing rule: at least 5 **substantially different** versions, compared
and tested — differences in layout, UX flow, and feature emphasis, not
just colors. All five share the same data layer, AI provider seam,
privacy model, and seed data; only the views and flows change. Each
variant tests a different hypothesis about what the judges will value
most. Build order follows the numbering; V1 (current) is the baseline.

### V1 — "Journal-first" (current build, baseline)

- **Layout:** three columns — note list | editor | AI panel. Header tabs
  for Notes / Mood timeline / Privacy ledger.
- **Emphasis:** the writing experience; AI as a side panel you consult
  while writing.
- **Hypothesis:** judges expect a notes app first; the privacy story
  lands through badges + ledger as supporting evidence.
- **Judging lean:** Design (clean, familiar), Technical Implementation.

### V2 — "Mood-first dashboard"

- **Layout:** the landing view is a dashboard — mood chart, calendar
  heatmap, streaks, and recent insight cards. Notes are reached by
  clicking a day on the calendar or an insight card; the editor opens as
  a focused overlay.
- **Emphasis:** the mood timeline as the visual showpiece and the reason
  to come back daily. Sentiment becomes the product's front door.
- **Hypothesis:** a striking first screen (chart + heatmap) scores higher
  on Design and Potential Impact than a notes list, and it makes the
  structured-JSON sentiment output impossible to miss.
- **Differs from V1 in:** information architecture (dashboard-first vs
  list-first), navigation model (calendar-driven), editor presentation
  (overlay vs permanent pane).

### V3 — "Focused writer" (single-column, mobile-first)

- **Layout:** one centered column, full-width editor, generous whitespace,
  serif body. The note list becomes a slide-over drawer; AI appears as a
  bottom sheet on demand ("Insights" button) instead of a permanent panel.
- **Emphasis:** writing flow and mobile usability; AI stays out of the
  way until asked for.
- **Hypothesis:** judges on laptops and phones both reward a calm,
  distraction-free writing surface, and the on-demand AI sheet makes the
  on-device/cloud distinction feel deliberate rather than incidental.
- **Differs from V1 in:** layout (single column vs three), AI
  presentation (on-demand sheet vs always-visible panel), navigation
  (drawer vs sidebar), responsive story (mobile-first).

### V4 — "Timeline feed"

- **Layout:** notes as a vertical chronological feed (newest first), each
  entry a card with its text, photos, and inline AI insight cards
  (summary / mood / cloud results) attached beneath it. The Privacy
  Ledger becomes a filter on the feed ("show only cloud actions") rather
  than a separate view.
- **Emphasis:** browsing and reflection — reading your past week as a
  story, with insights woven into the narrative instead of parked in a
  side panel.
- **Hypothesis:** the feed makes the ON-DEVICE / IN-CLOUD badges visible
  in context everywhere (every card wears them), which sells "privacy
  verifiable" harder than a separate ledger page does.
- **Differs from V1 in:** browsing model (feed vs list+editor), AI
  placement (inline cards vs side panel), ledger presentation (feed
  filter vs dedicated view).

### V5 — "Vault-first" (privacy as the product)

- **Layout:** the home screen is the vault — on-device status, a privacy
  score ("100% of sensitive insights stayed on this device"), the ledger
  as the hero section, and per-entry privacy controls. Notes are one tap
  behind ("Open vault").
- **Emphasis:** the differentiator itself. The first thing a judge sees
  is the privacy story, quantified; the notes app proves the product is
  real underneath.
- **Hypothesis:** the competition rewards the *idea* (Quality of the
  Idea is 25% of the score) — leading with verifiable privacy makes the
  idea unmissable, and the privacy score gives judges a memorable number
  to quote.
- **Differs from V1 in:** home screen (privacy dashboard vs notes),
  primary metric (privacy score vs notes), entry point to writing
  (behind the vault vs immediate).

### How to compare them (phase 2)

1. Build all five on the same branch structure (one variant per
   `variants/vN/` view layer, shared `lib/` + `components/` where
   possible).
2. Same seed data, same scripted walkthrough for each: create a note →
   on-device summary → sentiment → photo → cloud deep summary with
   consent → mood timeline → ledger.
3. Score each variant 1–5 on the four official criteria (Technical
   Implementation, Design, Potential Impact, Quality of the Idea) plus
   a "first-30-seconds" impression note — the demo video will show the
   winner, so the opening matters.
4. Pick the winner, or merge the strongest elements (e.g. V2's dashboard
   landing + V5's privacy score) into the final submission. Record the
   decision and the scores in this file.

## 5-variant comparison (results, 2026-11-24)

### Variant mechanism

- One build, one switch: `VITE_VARIANT=v1|v2|v3|v4|v5|v6` (default
  `v6` since the merge — see "v6 — merged submission version").
  `src/App.tsx` renders the selected variant from
  `src/variants/vN/VariantN.tsx` and adds `data-variant="<id>"` to the
  root (the walkthrough asserts it). Build any variant with, e.g.:
  `VITE_VARIANT=v2 VITE_AI_PROVIDER=mock npm run build`. Shell env vars
  override `.env`, so the mock provider can be forced at build time
  without touching `.env` (verified: the mock banner appears in every
  walkthrough run).
- Shared core: all five variants run on one hook, `src/hooks/useVault.ts`
  (extracted from the old `App.tsx` — notes, autosave draft, device
  model, all AI actions, consent flow, photos, ledger). Variants differ
  ONLY in layout and navigation — never in data, AI behavior, or the
  privacy contract. Shared view pieces: `src/variants/chrome.tsx`
  (header/footer), `src/variants/NotesWorkspace.tsx` (V1 three-column
  view, reused by V5), `src/variants/EditorOverlay.tsx` (focused
  editor + AI panel, used by V2/V4).
- New shared capabilities added for the variants (all in the shared
  layer, available to every variant): note-parameterized AI actions
  (`runOnDeviceForNote`, `requestCloudForNote`, `describePhotoForNote`
  — needed by V4's inline feed cards), `clearCloudResults` in `db.ts`
  (V5's per-entry control; the ledger keeps its entries — the audit
  trail is append-only), and clickable calendar days in `MoodTimeline`
  (optional `onDayClick` prop, used by V2).
- NOTE: all six variants ship in one bundle (the switch is runtime).
  Before final submission, delete the losing variants (or keep only
  v6) so the shipped bundle contains only the submitted UX.

### What each variant is

- **V1 "Journal-first" (baseline):** three columns — note list | editor |
  AI panel; tabs Notes / Mood timeline / Privacy ledger. Everything
  visible at once; the privacy story is present (badges + ledger) but
  not leading.
- **V2 "Mood-first dashboard":** home is a dashboard — "How have your
  days felt?" + stat cards + mood chart + clickable calendar heatmap +
  recent insight cards; entries open in a focused editor overlay.
- **V3 "Focused writer":** single centered column, full-width serif
  editor; note list in a slide-over drawer; AI in an on-demand bottom
  sheet ("Insights" button, header + floating). Calmest writing
  surface; best mobile story.
- **V4 "Timeline feed":** notes as chronological cards with inline
  insight cards (summary/mood/deep summary/suggestions, each badged)
  and per-card AI buttons; the ledger becomes a live counts strip +
  filter chips (All / On-device / Cloud / Not yet analyzed) instead of
  a separate view; editor opens as an overlay.
- **V5 "Vault-first":** home is the vault — a privacy-score ring
  ("100% of sensitive insights stayed on this device"), on-device
  status, per-entry privacy controls (badges + "Remove cloud results"
  with two-step confirm), and the full ledger as the hero section;
  notes are one tap behind ("Open vault", V1 workspace).

### Scores (1–5 per official criterion + first-30-seconds impression)

Same seed data, same scripted walkthrough for each (see
`tests/variants-walkthrough.mjs`); scores are comparative, judged
against the official criteria and the winner research in RESEARCH.md.
First-30-seconds scores come from the home screenshots
(`/tmp/mindvault-vN-home.png`).

| Variant | Technical | Design | Impact | Idea | Total /20 | First 30s /5 |
|---|---:|---:|---:|---:|---:|---:|
| V1 Journal-first | 4 | 4 | 4 | 3 | 15 | 3 |
| V2 Mood-first dashboard | 4 | 5 | 4 | 4 | 17 | 5 |
| V3 Focused writer | 4 | 4 | 3 | 3 | 14 | 2 |
| V4 Timeline feed | 5 | 4 | 4 | 4 | 17 | 4 |
| V5 Vault-first | 4 | 4 | 5 | 5 | 18 | 5 |

Justifications (one line per score):

- **V1** — Technical 4: complete and correct, but the baseline adds
  nothing beyond the core. Design 4: clean, familiar, everything
  visible — but conventional. Impact 4: the story is there via badges
  and ledger, but you have to look for it. Idea 3: reads as "the
  official example" at first glance; privacy is supporting, not
  leading. First 30s 3: "a nice notes app"; privacy visible in badges
  only if you look.
- **V2** — Technical 4: same core + clickable calendar + overlay editor.
  Design 5: the most striking first screen — chart + heatmap showpiece,
  best visual hook. Impact 4: mood as the front door makes the
  self-reflection value immediate and gives a reason to return daily.
  Idea 4: reframing mood as the product's front door is a genuine
  reframing, but privacy is still supporting. First 30s 5: the chart +
  "How have your days felt?" hooks immediately.
- **V3** — Technical 4: same core; drawer/sheet are standard patterns.
  Design 4: calmest, best writing surface and mobile story — but the AI
  is hidden until clicked. Impact 3: the differentiator is buried; a
  judge in a hurry sees a notes app. Idea 3: hides the idea; the
  on-demand sheet is deliberate but the privacy story isn't visible.
  First 30s 2: beautiful editor, but nothing says "hybrid AI" or
  "privacy" — the differentiator is one click away.
- **V4** — Technical 5: the most additional engineering —
  note-parameterized AI actions, inline insight cards, ledger-as-filter
  + live strip. Design 4: coherent modern feed, badges everywhere in
  context; the top of the feed is a bit panel-heavy. Impact 4: badges
  in context make the privacy story tangible while browsing; the ledger
  filter is a novel interaction. Idea 4: ledger-as-filter is a
  genuinely novel take on "privacy verifiable"; the feed makes badges
  unavoidable. First 30s 4: ledger strip + filter chips + on-device
  panel all visible immediately; slightly busy.
- **V5** — Technical 4: same core + privacy score + per-entry cloud
  removal; solid but less new machinery than V4. Design 4: the vault
  home is striking; notes behind one tap is a deliberate trade-off.
  Impact 5: the privacy score + "100% stayed on device" is the most
  quotable, memorable articulation of the value; per-entry controls
  make it actionable. Idea 5: leads with the differentiator — the idea
  IS the home screen; the privacy score is a memorable, original
  mechanism. First 30s 5: the idea lands in 5 seconds.

### Recommendation: merge V5 + V2 (BUILT 2026-11-24 as v6 — see below)

**Winner: a V5 + V2 merge (call it v6).** V5 has the highest total
(18/20) and the strongest Idea/Impact; V2 has the best Design and an
equal first-30-seconds score. The merge takes both:

- **Home = V5 vault** (privacy score ring + on-device status +
  per-entry controls + ledger hero) — the idea lands in the first 5
  seconds, and it is the most quotable thing a judge can take away.
- **Second tab = V2 dashboard** (mood chart + clickable calendar +
  recent insights) instead of the plain mood view — the visual
  showpiece, and the "reason to come back daily".
- **Notes tab = V1 three-column workspace** (already shared as
  `NotesWorkspace`) — the complete, familiar writing experience.
- Tabs: Vault / Notes / Dashboard. No separate ledger tab (the ledger
  is the vault home's hero section).
- Optional later fold-in (only if time allows): V4's inline insight
  badges on the notes list — the feed idea is good, but the merge
  already covers the differentiator; don't let it bloat the scope.
- V3's focused-writer lesson to keep: generous whitespace and the serif
  reading surface — already present in the shared editor; no separate
  V3 element needed in the merge.

## v6 — merged submission version (built 2026-11-24, now the default)

The merge spec from the comparison above, built exactly as specified.
Tabs: **Vault / Notes / Dashboard** — no separate ledger tab (the ledger
is the Vault home's hero section).

- **Vault tab (home)** = the V5 vault: privacy-score ring ("100% of
  sensitive insights stayed on this device"), on-device status panel,
  per-entry privacy controls (badges + "Remove cloud results" with
  two-step confirm), and the full Privacy Ledger as the hero section.
- **Notes tab** = the V1 three-column workspace (list | editor | AI
  panel), reused via the shared `NotesWorkspace`.
- **Dashboard tab** = the V2 dashboard: mood chart + clickable calendar
  heatmap + recent insight cards. Clicking a calendar day or insight
  card opens that entry in the Notes tab (v6 has no overlay editor).
- Header: the same brand header + status pill as the other variants,
  with a **+ New entry** button (creates a note and switches to the
  Notes tab) on every tab. The status pill navigates to the Vault tab,
  where the on-device panel lives.
- The V3 lesson (generous whitespace, serif reading surface) is kept in
  the shared editor; no separate V3 element was needed. The optional
  V4 fold-in (inline insight badges on the notes list) was NOT built —
  the merge already covers the differentiator, and the spec said not to
  let it bloat the scope.

### How it is built (no duplicated logic)

The merge reuses the shared layer; `Variant6.tsx` is only tab
navigation (~100 lines):

- `src/variants/VaultHome.tsx` (new, shared by V5 + V6): the whole
  vault view — `PrivacyScore`, `EntryPrivacyControls`, the on-device
  panel, the ledger, and the "Open vault" call to action. Extracted
  verbatim from `Variant5.tsx`, which now just renders it. V5's UI is
  unchanged (its walkthrough re-run passes — see below).
- `src/variants/DashboardView.tsx` (new, shared by V2 + V6): the
  dashboard — heading, `MoodTimeline` with `onDayClick`, and the
  recent-insights strip. Extracted verbatim from `Variant2.tsx`,
  which now renders it plus its own "All entries" section (V2-only;
  the merge spec lists only chart + calendar + insights for the
  Dashboard tab). V2's UI is unchanged (its walkthrough re-run passes).
- `src/App.tsx`: `VITE_VARIANT=v6` registered, and **v6 is now the
  default** — a plain build with no `VITE_VARIANT` renders v6. v1–v5
  are kept intact and still selectable (`VITE_VARIANT=v1` … `v5`);
  deleting the losing variants is a pre-submission cleanup step (the
  note in "Variant mechanism" above still applies — all six ship in
  one bundle until then).

### Test results (v6, 2026-11-24)

- `tests/variants-walkthrough.mjs v6` (new `flowV6`, mock provider):
  **23/23 pass, zero page errors.** Covers: shell + `data-variant="v6"`
  + mock banner, vault home + privacy score 100, on-device enable,
  notes workspace from the vault, new-note autosave, on-device summary
  (ON-DEVICE badge) + sentiment, consent modal gating + cloud deep
  summary (IN-CLOUD badge), ledger entries + score still 100 after
  cloud actions, per-entry cloud-result removal (two-step confirm),
  Dashboard tab (mood hero + chart + recent insights), calendar day
  opening the entry in the Notes tab.
- `npm run test:smoke` — **17/17 pass** (run 2× after the fix below;
  one pre-fix run also passed after a single flaky failure — see below).
  The smoke test now drives the DEFAULT build (v6): it was adapted to
  the v6 tabs (Vault home for the ledger, Dashboard for the mood
  chart). The "Silent uploads" check is scoped to the ledger section —
  the privacy-score card shows the same counter.
- `npm run test:db` — ALL DB TESTS PASSED (unchanged).
- `npm run build` — passes in both modes: mock (`VITE_AI_PROVIDER=mock`,
  ~447 KB JS / ~134 KB gzip) and firebase (`.env` config, ~493 KB JS /
  ~148 KB gzip, 17 precache entries). The production bundle contains
  the Firebase SDK + config (public client values, by design); the
  App Check debug-token code path is DEV-only dead code, and no debug
  token value is present in `.env` or in the bundle (verified).
- `npm run lint` — 0 errors, same 9 documented warnings (no new ones).
- Regression re-runs after the shared-component extraction:
  `flowV5` 21/21 pass, `flowV2` 18/18 pass — V5 and V2 are unchanged
  in behavior.
- Screenshots: `/tmp/mindvault-v6-home.png` (Vault home) and
  `/tmp/mindvault-v6.png` (end of walkthrough, Notes tab).
- One test bug found and fixed during v6 (test bug, not app bug):
  the ledger-entry checks in `smoke.mjs` and `checkLedgerView`
  waited only for the section heading, but entries load via a live
  IndexedDB query — the heading renders immediately even with zero
  entries, so the check was racy (smoke failed once on "ledger lists
  the on-device summary", then passed on re-run). Both tests now wait
  for the entry text itself before asserting.

### Test results (5-variant comparison, 2026-11-24)

- `tests/variants-walkthrough.mjs` (Playwright, mock provider, fresh
  browser context per run, same scripted walkthrough each time):
  **V1 16/16, V2 18/18, V3 18/18, V4 19/19, V5 21/21 — all pass.**
  Every variant verified end-to-end: shell + variant id + mock banner,
  seeded notes, on-device enable + summary (ON-DEVICE badge) +
  sentiment, consent modal (excerpt + checkbox-gated confirm) + cloud
  deep summary (IN-CLOUD badge), ledger check, mood chart, zero
  pageerrors. Variant-specific checks: V2 calendar-day overlay opening,
  V3 bottom-sheet + drawer navigation, V4 ledger filters (cloud filter
  keeps analyzed entries, unanalyzed filter drops them), V5 privacy
  score 100 before/after cloud actions + per-entry cloud-result removal.
- `npm run test:smoke` (V1, fixed — see below): **17/17 pass.**
- `npm run test:db`: ALL DB TESTS PASSED. `npm run build` passes for
  every variant (V1 mock bundle ~446 KB JS / ~134 KB gzip; all variants
  share one bundle). `npm run lint`: 0 errors, 9 warnings (see "Known
  limitations" §4).
- Screenshots: `/tmp/mindvault-vN-home.png` (first screen) and
  `/tmp/mindvault-vN.png` (end of walkthrough) for N = 1..5.
- Two test bugs found and fixed during the comparison (both were test
  bugs, not app bugs):
  1. `getByText('ON-DEVICE')` substring-matches the "On-device AI"
     panel heading, so the wait returned before the summary existed
     (caught by V3, where the summary was still "Summarizing…").
     Fixed in both `smoke.mjs` and `variants-walkthrough.mjs`: the
     completion signal is now the button flipping to "Re-summarize" /
     "Re-analyze mood", and badge checks use `{ exact: true }`.
  2. In V4 the feed card shows the note body, so waiting on the summary
     text is not a completion signal there — same button-flip fix
     covers it.
  3. V5's two-step "Remove cloud results" confirm: the test's row
     locator filtered on the button's first label, which disappears
     after the first click. Fixed by scoping the row to the controls
     section instead.
- Two visual fixes from the screenshot review (both in shared code):
  1. `MoodTimeline` x-axis date labels were clipped at the chart edges
     ("Nov 23, 2…"). First label now anchors `start`, last anchors
     `end` (single point stays centered).
  2. V4 feed excerpts could leave the "…" dangling on its own line
     after a paragraph break; the excerpt is now `trimEnd()`ed before
     the ellipsis is appended.

## Test results (phase 1, 2026-11-24)

- `npm run build` — passes (tsc strict + Vite + PWA; ~414 KB JS /
  ~130 KB gzip; 17 precache entries).
- `npm run dev` — serves, HTTP 200, correct title.
- `npm run test:db` — **31 checks pass, 1 documented skip** (seed-photo
  fetch needs a static server; the browser smoke test covers the photo
  path). Covers: seed counts/idempotency, CRUD round-trip, analysis
  persistence, ledger growth, delete cascade, mock privacy contract
  (on-device call before init throws, no silent cloud fallback,
  download progress reaches 100, sentiment polarity + determinism,
  cloud without authorization throws, authorized cloud call returns
  `IN_CLOUD` with correct `charsSent`), `clearAllData`.
- `npm run test:smoke` — **17/17 checks pass** (Playwright/Chromium
  against `vite preview`): shell render, seeded notes, mock banner,
  model enable + progress, autosave, on-device summary + sentiment with
  badges, consent-modal gating (confirm disabled until checkbox),
  cloud deep summary after approval with `IN-CLOUD` badge, ledger
  entries for both paths, zero silent uploads, seeded photo with
  on-device description, mood chart render, unavailable-state guidance,
  and recovery after un-simulating.
- `npm run lint` — 0 errors, 10 documented warnings (see "Known
  limitations" above).

## Test results (phase 2a, 2026-11-24)

- `npm run build` (with `.env`, firebase provider) — passes (tsc strict
  + Vite + PWA; ~459 KB JS / ~142 KB gzip; 17 precache entries). The
  production bundle contains the Firebase config (public client values,
  by design) and no debug token (verified: 0 matches).
- `npm run test:db` — ALL DB TESTS PASSED (unchanged).
- `npm run test:smoke` (mock build, `.env` moved aside) — **17/17 pass**,
  no regressions from the phase-2a code changes.
- `npm run lint` — 0 errors, same 10 documented warnings (no new ones).
- `node tests/probe-firebase.mjs` (dev server + firebase provider,
  persistent profile) — app loads in firebase mode (mock banner absent,
  no init-error banner, zero page errors); debug token captured from the
  console (identical across two separate launches — stable); raw
  `LanguageModel` probe: global present, `availability()` =
  `"unavailable"` (headless-shell artifact); status pill "On-device AI
  unavailable" + flag guidance shown; mock-only simulate toggle absent;
  real cloud call attempted before token registration → clear in-app
  error shown ("Failed to fetch" — sandbox networking, see above), no
  crash, no blank screen.
- Secret scan — no API key, site key, or debug token in `src/`, `tests/`,
  docs, or config files; `.env.example` holds no real values; `.env`
  is git-ignored (no git repo exists yet — `.gitignore` applies when
  the repo is created).
