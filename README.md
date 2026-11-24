# MindVault — Private Smart Notes

Privacy-first smart notes for the web, built for **#BuildHybridAI 2026**
(Devpost × Google Firebase). Sensitive insights — diary summaries and mood
analysis — run **on the device** and never leave the browser. Stronger cloud
features (deep summary, writing suggestions) run only with your **explicit
per-request approval**. Every AI result wears an **ON-DEVICE / IN-CLOUD**
badge, and a **Privacy Ledger** records every AI action so you can *see*
that nothing sensitive left the device.

> **Phase 2a status (2026-11-24):** the real Firebase AI Logic provider is
> wired in and active when a local `.env` is present (project
> `mindvault-2026`, Gemini Developer API backend, App Check enforced with
> reCAPTCHA Enterprise). Without `.env` the app still runs fully in mock
> mode. Real cloud/on-device calls have NOT been verified end-to-end yet:
> they need the App Check debug token registered in the console AND a
> networked browser (this VM's headless test browser cannot reach external
> URLs — see [NOTES.md](NOTES.md)). See [NOTES.md](NOTES.md) for what is
> mock vs real, and [ARCHITECTURE.md](ARCHITECTURE.md) for the design.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 — development server
npm run build      # type-check + production build (dist/)
npm run preview    # serve the production build on http://localhost:4173
```

- **Mock mode (no setup):** with no `.env` file, the app uses the
  deterministic mock provider automatically — no Firebase project, no
  network, no secrets needed.
- **Firebase mode:** copy `.env.example` to `.env`, fill in the Firebase
  web config + App Check site key from the Firebase console, and set
  `VITE_AI_PROVIDER=firebase`. `.env` is git-ignored — never commit it.
  Local development uses the App Check debug provider (see below); the
  production reCAPTCHA key deliberately excludes localhost.

## What you can do in the app

- **Write notes** — create, search, edit (autosaved, 800 ms debounce),
  delete (two-step confirm). Everything is stored in this browser's
  IndexedDB; the app works fully offline and without any AI.
- **On-device insights** — summary + mood analysis (score, label,
  keywords) run on the device. A one-click "Enable on-device AI" step
  shows download progress; if the device model is unavailable the UI says
  so plainly and **never** silently sends your diary to the cloud.
- **Cloud insights** — deep summary + writing suggestions. Every request
  opens a consent modal showing exactly what will be sent (with a
  character count) and needs a checkbox + confirm. Nothing is sent by
  default.
- **Mood timeline** — a 42-day mood chart and calendar heatmap built from
  the structured sentiment output, with average mood and entry stats.
- **Photo attachments** — attach JPEG/PNG photos (≤ 5 MB) to entries;
  photos get an on-device description and mood tags.
- **Privacy Ledger** — a per-action record of every AI call (on-device vs
  cloud, authorized or not, characters sent), a "silent uploads: 0"
  counter, JSON export, and a reset-demo-data action.
- **PWA** — installable, offline-capable shell (app shell is precached;
  AI responses are never cached).

Four realistic sample entries are pre-seeded with existing analyses, so
judges can click through every view immediately.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (port 5173) |
| `npm run build` | `tsc` (strict) + Vite production build + PWA assets |
| `npm run preview` | Serve `dist/` on port 4173 |
| `npm run lint` | oxlint (0 errors; 10 documented non-blocking warnings — see NOTES.md) |
| `npm run test:db` | Node tests: Dexie store, seed data, mock-provider privacy contract |
| `npm run test:smoke` | Playwright smoke test against `npm run preview` (needs a built `dist/`) |
| `npm run test:variants` | Scripted walkthrough for one UI variant: `node tests/variants-walkthrough.mjs v2` (needs the matching `VITE_VARIANT` build + `npm run preview`) |
| `node tests/probe-firebase.mjs` | Firebase-mode probe: App Check debug-token capture, on-device availability probe, graceful-failure check (needs `npm run dev` + a real `.env`; uses a persistent Chromium profile so the debug token stays valid across runs) |

## UI variants (5 compared, 2026-11-24)

All five variants run on the same shared core (`useVault` — data, AI,
privacy model) and differ only in layout and navigation. Select one with
`VITE_VARIANT` at build time (default `v1`):

```bash
VITE_VARIANT=v2 VITE_AI_PROVIDER=mock npm run build   # mood-first dashboard
```

- **v1 Journal-first** (baseline): three columns — note list | editor |
  AI panel.
- **v2 Mood-first dashboard**: mood chart + clickable calendar heatmap
  as home; entries open in a focused editor overlay.
- **v3 Focused writer**: single centered column; note list in a
  slide-over drawer; AI in an on-demand bottom sheet.
- **v4 Timeline feed**: notes as chronological cards with inline insight
  cards; the ledger becomes a live counts strip + filter chips.
- **v5 Vault-first**: privacy dashboard + privacy score as home, with
  per-entry privacy controls; notes one tap behind.

Full scores and the recommendation (merge V5 + V2) are in
[NOTES.md](NOTES.md#5-variant-comparison-results-2026-11-24). The merge
is not built yet.

## Tech stack

React 19 + Vite 8 + TypeScript (strict) + Tailwind CSS v4, Dexie
(IndexedDB), Firebase JS SDK 13.4.0 (`firebase/ai`), vite-plugin-pwa.
Tests: Playwright (Chromium) + fake-indexeddb.

## Privacy guarantees (the idea in one paragraph)

Sensitive features use **ONLY_ON_DEVICE** semantics — they run on the
device model or they do not run at all. `PREFER_ON_DEVICE` is deliberately
never used: it silently falls back to the cloud when the device model is
unavailable, which would leak private diary content. Cloud features use
**ONLY_IN_CLOUD** and require explicit per-request authorization. Every AI
result carries its inference source (`ON_DEVICE` / `IN_CLOUD`) and is
recorded in the Privacy Ledger. See
[ARCHITECTURE.md](ARCHITECTURE.md#privacy-model) for the full model.

## Phase 2 status — Firebase setup

Done in phase 2a (2026-11-24):

1. **Firebase project created** (`mindvault-2026`, Spark plan) with a
   registered Web app; the web config lives in a local git-ignored
   `.env` (see `.env.example`) — never commit `.env`.
2. **Firebase AI Logic enabled** (Gemini Developer API backend) and
   **App Check configured** with reCAPTCHA Enterprise, keyed to the
   production domain only (`mindvault-2026.web.app` /
   `mindvault-2026.firebaseapp.com`). App Check initializes **before**
   the AI service in `src/lib/ai/firebaseProvider.ts`, and AI Logic
   enforcement is on (Basic — Enforced).
3. **Provider switch works:** `VITE_AI_PROVIDER=firebase` + config
   selects the real provider; without config (or if Firebase fails to
   start) the app falls back to the mock provider with a visible warning
   banner — it never crashes or goes blank.
4. **App Check debug provider (local development only):** in DEV builds
   the app sets `self.FIREBASE_APPCHECK_DEBUG_TOKEN` before App Check
   initializes — `VITE_APPCHECK_DEBUG_TOKEN` when set, otherwise `true`
   (the SDK then generates a token, prints it to the browser console as
   "Firebase App Check debug token: …", and persists it in that browser
   profile's IndexedDB). Register the token once in the Firebase console
   (App Check > Apps > Manage debug tokens) for local AI calls to be
   accepted. Debug tokens are local-only secrets and must **never** be
   committed to the repo or shipped to production. This code path is
   dead code in production builds; production always uses reCAPTCHA
   Enterprise.

Still to do:

5. **Register the debug token** (from the probe run) in the console, then
   verify real cloud calls + on-device states in a **networked** browser
   — this VM's headless test browser cannot reach external URLs, so
   real-AI verification must happen in a real browser (see NOTES.md).
   Test on-device in Chrome 139+ with the Prompt API flag enabled.
6. **Build + compare the 5 variants** — DONE 2026-11-24 (see NOTES.md):
   recommendation is a V5 + V2 merge (not built yet). Then **deploy**
   to Firebase Hosting and verify on the real domain (App Check +
   production reCAPTCHA, cloud consent flow, on-device states).
7. **Record the demo video** with the **real** provider (never the mock)
   in a compliant Chrome build. The video script needs approval before
   production (standing rule).

## Project layout

```
src/
  main.tsx            entry point, PWA service-worker registration
  App.tsx             variant switch (VITE_VARIANT) + shared consent modal
  index.css           Tailwind v4 theme (paper / teal / brass)
  components/         SourceBadge, OnDevicePanel, CloudConsentModal,
                      NoteList, NoteEditor, AiPanel, MoodTimeline,
                      PrivacyLedger
  hooks/              useDeviceModel (availability state machine),
                      useVault (shared stateful core for all variants)
  variants/           chrome.tsx (header/footer), NotesWorkspace.tsx
                      (three-column view), EditorOverlay.tsx,
                      v1/…v5/ (one view layer per variant)
  lib/
    ai/               types.ts (provider interface), mockProvider.ts,
                      firebaseProvider.ts, index.ts (factory)
    db.ts             Dexie schema + CRUD + ledger helpers
    seed.ts           4 sample entries with pre-computed analyses
    firebaseConfig.ts env-based config (null when unconfigured)
    format.ts, mood.ts
tests/
  db-test.ts          31 Node checks + 1 documented skip
  smoke.mjs           17 browser checks (Playwright)
```

## License

Apache 2.0 — see [LICENSE](LICENSE).
