# MindVault — Phase 1 + 2a notes

Status: **2026-11-24, phase 2a complete.** Phase 1 (mock provider, fully
working app) is done and verified; phase 2a wired in the real Firebase AI
Logic provider + App Check (see "Phase 2a" below). Real cloud/on-device
calls are NOT yet verified end-to-end — they need the App Check debug
token registered in the console AND a networked browser. This file records
what is mock vs real, what phase 2 needs, known limitations, and the
5-variant proposal required by the standing rule (at least 5 substantially
different versions, compared and tested, before settling).

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
- [ ] Build + compare the 5 variants below; pick the strongest (or a
      hybrid) by the judging criteria.
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
4. **Lint: 10 non-blocking warnings, 0 errors.** All are intentional
   patterns flagged by the React Compiler rules:
   - 5× `preserve-manual-memoization` — callbacks deliberately depend on
     `selected?.id` rather than the whole `selected` object, so they
     don't churn when note content changes.
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
