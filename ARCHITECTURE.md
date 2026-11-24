# MindVault — Architecture

## Design goals

1. **Local-first.** Notes work fully without AI and without a network.
   AI is an enhancement layer, never a dependency.
2. **Privacy is verifiable, not promised.** Every AI result carries its
   inference source, and every AI call is written to a user-visible
   Privacy Ledger. The user never has to take our word for it.
3. **No silent failure, no silent fallback.** Unavailable on-device AI is
   a visible state with guidance — never a quiet cloud call.
4. **One seam for AI.** All inference goes through a provider interface;
   swapping the mock for the real Firebase provider is a config change,
   not a refactor.

## System overview

```
┌──────────────────────────────────────────────────────────────┐
│ Browser (PWA shell, precached app shell only)                │
│                                                              │
│  React UI — v6 (default): Vault / Notes / Dashboard tabs;     │
│  v1–v5 remain selectable via VITE_VARIANT (see NOTES.md)     │
│      │                                                       │
│      ├─ Dexie (IndexedDB) ─ notes, analyses, photos, ledger  │
│      │                                                       │
│      └─ AI provider interface (src/lib/ai/types.ts)          │
│            ├─ MockProvider (phase 1, default)                │
│            └─ FirebaseProvider (phase 2, firebase/ai)        │
│                  ├─ Gemini Nano on-device (ONLY_ON_DEVICE)   │
│                  └─ Gemini 3.8 Flash in cloud (ONLY_IN_CLOUD)│
└──────────────────────────────────────────────────────────────┘
```

No backend of our own. The only network calls in phase 2 are the
Firebase AI Logic SDK's calls to Google's models (cloud features only,
after per-request authorization) and App Check verification.

## Data model (Dexie, database `mindvault`, version 1)

**`notes`** — `++id, updatedAt, createdAt`

```ts
interface Note {
  id?: number;
  title: string;
  content: string;
  createdAt: number;          // epoch ms
  updatedAt: number;          // epoch ms; drives list order
  photos: StoredPhoto[];      // embedded, see below
  analysis: NoteAnalysis;     // embedded, see below
}

interface StoredPhoto {
  id: string;                 // crypto.randomUUID()
  name: string;               // original file name
  mimeType: 'image/jpeg' | 'image/png';
  dataUrl: string;            // base64 data URL, ≤ 5 MB source file
  description?: PhotoDescription; // on-device result
}

interface NoteAnalysis {
  summary?: SummaryResult;    // ON_DEVICE
  sentiment?: SentimentResult;// ON_DEVICE
  deepSummary?: CloudResult;  // IN_CLOUD, authorized
  suggestions?: CloudResult;  // IN_CLOUD, authorized
}
```

Photos and analyses are embedded in the note document (one read gets the
whole entry). Photos are stored as data URLs so the entry is fully
self-contained and works offline; the 5 MB per-file limit keeps IndexedDB
usage reasonable.

**`ledger`** — `++id, createdAt, noteId, source`

```ts
interface LedgerEntry {
  id?: number;
  noteId: number;
  noteTitle: string;
  action: 'on-device-summary' | 'on-device-sentiment'
        | 'on-device-photo' | 'cloud-deep-summary'
        | 'cloud-suggestions';
  source: 'ON_DEVICE' | 'IN_CLOUD';
  detail: string;             // human-readable explanation
  authorized: boolean;        // true only for cloud calls (user approved)
  charsSent: number;          // 0 for every on-device action
  createdAt: number;
}
```

Deleting a note deletes its ledger entries (`deleteNoteAndLedger`).
"Reset demo data" clears both tables and re-seeds the sample entries.

## AI abstraction (`src/lib/ai/`)

### Provider interface (`types.ts`)

```ts
interface AIProvider {
  readonly name: string;                    // e.g. "Gemini Nano (simulated)"
  readonly cloudModelName: string;
  getDeviceAvailability(): Promise<DeviceAvailability>;
  initializeDeviceModel(onProgress?: (p: number) => void): Promise<void>;
  summarizeOnDevice(note: NoteInput): Promise<SummaryResult>;
  analyzeSentimentOnDevice(note: NoteInput): Promise<SentimentResult>;
  describePhotoOnDevice(image: PhotoInput): Promise<PhotoDescription>;
  deepSummaryInCloud(note: NoteInput, opts: CloudOptions): Promise<CloudResult>;
  writingSuggestionsInCloud(note: NoteInput, opts: CloudOptions): Promise<CloudResult>;
}
```

Every result carries its source:

```ts
type InferenceSource = 'ON_DEVICE' | 'IN_CLOUD';
```

- `DeviceAvailability` is a discriminated union over
  `available | downloading | downloadable | unavailable`, each with a
  human-readable `detail` string for the UI.
- Error classes encode the privacy contract:
  `OnDeviceUnavailableError` (on-device call before init / model
  missing), `CloudNotAuthorizedError` (cloud call without
  `authorized: true`), `ProviderNotConfiguredError` (Firebase provider
  selected without config).

### Mock provider (`mockProvider.ts`)

Deterministic and rule-based so tests are reproducible:

- **Summary:** extractive — picks the note's own most informative
  sentences (scored by length and keyword density).
- **Sentiment:** lexicon scoring over positive/negative word lists,
  seeded by a djb2 hash of the content so repeated calls are stable;
  outputs a score (−100…100), a label band, and up to 5 keywords.
- **Photo description:** templated from the file name (sunset, meal,
  people, …) with mood tags.
- **Cloud results:** templated deep summaries / suggestions that quote
  the note's own sentiment and keywords.
- Simulates the full device-model lifecycle: `downloadable` →
  `downloading` (progress 0→100 in steps) → `available`; and an
  `unavailable` state toggled via `localStorage`
  (`mindvault.simulateUnavailable`) for the graceful-degradation demo.

The mock is **not** a toy stub: it exercises the same UI states, badges,
ledger writes, and error paths as the real provider.

### Firebase provider (`firebaseProvider.ts`, phase 2)

Written against the installed Firebase SDK 13.4.0 types
(`node_modules/@firebase/ai/dist/ai.d.ts`), not from memory:

- `getAI(app, { backend: new GoogleAIBackend() })`;
  `initializeDeviceModel` is a **method on `GenerativeModel`**, not a
  standalone function.
- `InferenceMode` values: `prefer_on_device` / `only_on_device` /
  `only_in_cloud` / `prefer_in_cloud`; `HybridParams` =
  `{ mode, onDeviceParams?, inCloudParams?: ModelParams }`.
- `GenerateContentResponse.inferenceSource` is `on_device` / `in_cloud`
  and is mapped to the app's `ON_DEVICE` / `IN_CLOUD` badges.
- Structured sentiment output uses `GenerationConfig.responseMimeType`
  + `responseSchema` (JSON: score, label, keywords).
- **App Check is initialized before the AI service** (required order),
  using reCAPTCHA Enterprise; the key comes from env, never from code.

### Provider selection (`index.ts`)

`getAIProvider()` returns the Firebase provider only when
`VITE_AI_PROVIDER=firebase` **and** a complete Firebase config is
present; otherwise it returns the mock (with a console warning if
`firebase` was requested but config is missing). The UI never knows
which provider is behind the interface.

## On-device / cloud split

| Feature | Where it runs | Mode | Authorization |
| --- | --- | --- | --- |
| Diary summary | Device (Gemini Nano) | `only_on_device` | None needed — nothing leaves the device |
| Sentiment analysis | Device (Gemini Nano) | `only_on_device` | None needed |
| Photo description | Device (Gemini Nano) | `only_on_device` | None needed |
| Deep summary | Cloud (Gemini 3.8 Flash) | `only_in_cloud` | Per-request consent modal |
| Writing suggestions | Cloud (Gemini 3.8 Flash) | `only_in_cloud` | Per-request consent modal |

### Why never `prefer_on_device`

`prefer_on_device` falls back to the cloud when the device model is
unavailable. For a diary app that fallback would silently upload private
content — the exact failure the product exists to prevent. So sensitive
features use `only_on_device` and degrade to a clear "unavailable" state
with guidance (Chrome version / flags) instead of falling back.

### Consent flow (cloud)

1. User clicks "Deep summary" / "Writing suggestions".
2. `CloudConsentModal` opens showing the **exact** title + body that will
   be sent, the character count, the model name, and what happens next.
3. Confirm is disabled until the user ticks "I understand this note will
   be sent to the cloud".
4. On confirm, the provider call runs with `{ authorized: true,
   authorizedAt }`; the result and a ledger entry (with `charsSent`) are
   saved. Esc / Cancel aborts with no network call.

## Components

| Component | Responsibility |
| --- | --- |
| `App.tsx` | Variant switch (`VITE_VARIANT`, default v6) + shared consent modal; the variants own their tab navigation |
| `useVault` | Shared stateful core for all variants: notes, autosave draft, device model, all AI actions, consent flow, photos, ledger |
| `variants/` | Shared view pieces (`VaultHome`, `DashboardView`, `NotesWorkspace`, `EditorOverlay`, `chrome`) + one view layer per variant (`v1/`…`v6/`) |
| `NoteList` | Search filter, mood dots, per-note analysis indicators, entry count |
| `NoteEditor` | Title/body editing, save state, photo attach/remove, two-step delete |
| `AiPanel` | On-device + cloud insight sections, source badges, sentiment bar, keyword chips, error surface (`role="alert"`) |
| `OnDevicePanel` | Availability state machine UI: enable button, progress bar, unavailable guidance, mock-only simulate toggle |
| `CloudConsentModal` | Per-request authorization dialog (exact content preview, checkbox-gated confirm) |
| `MoodTimeline` | SVG line chart + 42-day calendar heatmap + stats from sentiment output |
| `PrivacyLedger` | Counts (incl. "Silent uploads: 0"), entry list, JSON export, reset demo data |
| `SourceBadge` | `ON-DEVICE` (teal) / `IN-CLOUD` (amber) pill |
| `useDeviceModel` | Availability polling + init + progress state for the provider |

## Privacy model

1. **Default-deny cloud.** No network call carrying note content exists
   in the on-device path. The mock provider makes zero network calls at
   all; the Firebase provider only calls the cloud for the two
   explicitly authorized features.
2. **Source is data, not decoration.** The badge comes from the
   provider's reported inference source (the Firebase SDK's
   `inferenceSource` in phase 2), not from which button was clicked.
3. **The ledger is the audit trail.** Every AI call — on-device or
   cloud — writes an entry with source, authorization, and characters
   sent. "Silent uploads" counts cloud entries with
   `authorized === false`; it must always be 0, and the UI shows the
   number.
4. **App Check gates the cloud.** In phase 2, cloud calls require a
   valid App Check token (reCAPTCHA Enterprise), bound to the production
   domain. Debug tokens are local-only and never committed.
5. **PWA caching is app-shell only.** The service worker precaches the
   shell; AI responses and note content are never cached by the worker
   (they live in IndexedDB, on the device).

## Seed data (`src/lib/seed.ts`)

Four original sample entries with relative dates (12 / 8 / 4 / 1 days
ago) and pre-computed analyses + ledger entries, so every view is
populated on first load. One entry carries a sunset photo with an
on-device description. Seeding is idempotent (module-level promise guard
+ a check for existing notes) and skipped when notes already exist.

## Build & test

- Production bundle (v6, 2026-11-24): firebase mode ~493 KB JS /
  ~148 KB gzip; mock mode ~448 KB JS / ~134 KB gzip. PWA precache: 17
  entries (`sw.js` + Workbox runtime).
- `npm run test:db` — 31 Node checks (Dexie CRUD, seed idempotency,
  mock privacy contract) + 1 documented skip (seed photo fetch needs a
  static server; covered by the browser test).
- `npm run test:smoke` — 17 Playwright checks against `vite preview`:
  shell render, seed, mock banner, model enable + progress, autosave,
  on-device summary + sentiment with badges, consent modal gating,
  cloud call after approval with `IN-CLOUD` badge, ledger entries,
  seeded photo, mood chart, unavailable-state degradation and recovery.
