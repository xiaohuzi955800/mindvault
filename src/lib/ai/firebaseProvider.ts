/**
 * Firebase AI Logic provider (phase 2).
 *
 * Real implementation against the installed Firebase JS SDK (v13.4.0,
 * verified against `node_modules/@firebase/ai/dist/ai.d.ts`). It is NOT
 * active until a Firebase config is present and `VITE_AI_PROVIDER=firebase`
 * — see `index.ts`. Until then the mock provider serves the app.
 *
 * Design (see RESEARCH.md §3 — all verified against the SDK types):
 *  - On-device model: `getGenerativeModel(ai, { mode: InferenceMode.ONLY_ON_DEVICE })`.
 *    ONLY_ON_DEVICE — never PREFER_ON_DEVICE: if the device model cannot
 *    run, the call throws instead of silently sending private diary content
 *    to the cloud. That silent fallback would violate the product's core
 *    privacy promise.
 *  - Cloud model: `getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD,
 *    inCloudParams: { model: 'gemini-3.8-flash' } })` — free-tier text model,
 *    so core features never depend on paid quota. (Was gemini-2.5-flash
 *    until 2026-11-24, when a live production test showed Google had
 *    retired it for new users — 404, "no longer available to new users",
 *    recommending gemini-3.8-flash. See NOTES.md.)
 *  - Every response's `inferenceSource` is read and surfaced honestly in the
 *    UI badges. If the SDK ever reported IN_CLOUD for an on-device call, the
 *    badge would say so — privacy here is verifiable, not assumed.
 *  - `initializeDeviceModel` is a method on the on-device model and must be
 *    called from a user gesture (the "Enable on-device AI" button).
 *  - App Check is initialized BEFORE the AI service, using reCAPTCHA
 *    Enterprise. App Check is mandatory for Firebase AI Logic since
 *    2026-11-02 and cannot be disabled.
 *  - Local development (DEV builds only): the App Check debug provider is
 *    used instead of reCAPTCHA, because the production reCAPTCHA key
 *    deliberately excludes localhost. When `VITE_APPCHECK_DEBUG_TOKEN` is
 *    set, that exact token is used; otherwise the SDK generates one,
 *    prints it to the browser console ("Firebase App Check debug token:
 *    ..."), and persists it in the browser profile's IndexedDB. Register
 *    the token once in the Firebase console (App Check > Apps > Manage
 *    debug tokens) for local AI calls to be accepted. Debug tokens are
 *    local-only secrets — never commit one to the repo. This branch is
 *    dead code in production builds (`import.meta.env.DEV` is replaced
 *    at build time), so production always uses reCAPTCHA Enterprise.
 *  - Sentiment uses prompt-requested JSON (single-turn text generation —
 *    on-device does not support multi-turn chat). The JSON is parsed with a
 *    tolerant extractor and validated; a future upgrade can move the cloud
 *    calls to `responseSchema`.
 */
import { initializeApp } from 'firebase/app';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from 'firebase/app-check';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
} from 'firebase/ai';
import type { GenerativeModel } from 'firebase/ai';
import type { FirebaseWebConfig } from '../firebaseConfig';
import {
  CloudNotAuthorizedError,
  OnDeviceUnavailableError,
} from './types';
import type {
  AIProvider,
  CloudOptions,
  CloudResult,
  DeviceAvailability,
  NoteInput,
  PhotoDescriptionResult,
  PhotoInput,
  SentimentResult,
  SummaryResult,
} from './types';

export const FIREBASE_ON_DEVICE_MODEL = 'Gemini Nano';
export const FIREBASE_CLOUD_MODEL = 'gemini-3.8-flash';

const ON_DEVICE_UNAVAILABLE_GUIDANCE =
  'On-device AI is not available in this browser. It needs Chrome for desktop v139+ with the Prompt API enabled (chrome://flags/#prompt-api-for-gemini-nano). Your notes still work fully — only the on-device insights are paused, and nothing is sent to the cloud.';

/** Minimal shape of Chrome's Prompt API (not in the TS DOM lib yet). */
interface ChromeLanguageModel {
  availability: (options?: unknown) => Promise<string>;
}

function getChromeLanguageModel(): ChromeLanguageModel | null {
  const candidate = (
    globalThis as unknown as { LanguageModel?: ChromeLanguageModel }
  ).LanguageModel;
  return candidate && typeof candidate.availability === 'function'
    ? candidate
    : null;
}

function mapInferenceSource(
  value: string | undefined,
  fallback: 'ON_DEVICE' | 'IN_CLOUD',
): 'ON_DEVICE' | 'IN_CLOUD' {
  if (value === InferenceSource.ON_DEVICE) return 'ON_DEVICE';
  if (value === InferenceSource.IN_CLOUD) return 'IN_CLOUD';
  return fallback;
}

function toOnDeviceError(error: unknown): OnDeviceUnavailableError {
  const detail = error instanceof Error ? error.message : String(error);
  return new OnDeviceUnavailableError(
    `${ON_DEVICE_UNAVAILABLE_GUIDANCE} (Details: ${detail})`,
  );
}

/** Extract and validate the sentiment JSON the model was asked to return. */
function parseSentimentJson(
  text: string,
): { score: number; label: string; keywords: string[] } | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    const score = record['score'];
    const label = record['label'];
    const keywords = record['keywords'];
    if (
      typeof score !== 'number' ||
      typeof label !== 'string' ||
      !Array.isArray(keywords)
    ) {
      return null;
    }
    return {
      score: Math.max(-100, Math.min(100, Math.round(score))),
      label,
      keywords: keywords.filter((k): k is string => typeof k === 'string').slice(0, 5),
    };
  } catch {
    return null;
  }
}

export function createFirebaseAIProvider(
  config: FirebaseWebConfig,
): AIProvider {
  const app = initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });

  // Local development only: use the App Check debug provider, because the
  // production reCAPTCHA Enterprise key deliberately excludes localhost.
  // The global MUST be set before initializeAppCheck runs — the SDK reads
  // it during initialization. `import.meta.env.DEV` is replaced at build
  // time, so this branch is dead code in production builds.
  if (import.meta.env.DEV) {
    const globals = globalThis as unknown as Record<string, unknown>;
    const explicit = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN as
      | string
      | undefined;
    globals['FIREBASE_APPCHECK_DEBUG_TOKEN'] =
      explicit && explicit.length > 0 ? explicit : true;
  }

  // App Check MUST be initialized before the AI service is used.
  if (config.appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(config.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });

  // ONLY_ON_DEVICE: throws when the device model cannot run. Never falls back.
  const onDeviceModel: GenerativeModel = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
  });
  // ONLY_IN_CLOUD: free-tier text model; core features never need paid quota.
  const cloudModel: GenerativeModel = getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: FIREBASE_CLOUD_MODEL },
  });

  return {
    kind: 'firebase',
    onDeviceModelName: FIREBASE_ON_DEVICE_MODEL,
    cloudModelName: FIREBASE_CLOUD_MODEL,

    async getDeviceAvailability(): Promise<DeviceAvailability> {
      const lm = getChromeLanguageModel();
      if (!lm) return 'unavailable';
      try {
        const state = await lm.availability();
        if (
          state === 'available' ||
          state === 'downloading' ||
          state === 'downloadable' ||
          state === 'unavailable'
        ) {
          return state;
        }
        return 'unknown';
      } catch {
        return 'unknown';
      }
    },

    async initializeDeviceModel(
      onProgress?: (progress: number) => void,
    ): Promise<void> {
      try {
        // Must be called from a user gesture; the UI only calls it from a
        // button click. First use triggers a model download (progress 0–1).
        await onDeviceModel.initializeDeviceModel((value: number) => {
          onProgress?.(Math.round(value * 100));
        });
      } catch (error) {
        throw toOnDeviceError(error);
      }
    },

    async summarizeOnDevice(note: NoteInput): Promise<SummaryResult> {
      if (note.content.trim().length === 0) {
        throw new Error('Write something first — there is nothing to summarize yet.');
      }
      try {
        const result = await onDeviceModel.generateContent(
          `Summarize this private diary entry in one or two plain sentences. Do not add facts that are not in the entry.\n\nTitle: ${note.title}\n\n${note.content}`,
        );
        return {
          source: mapInferenceSource(result.response.inferenceSource, 'ON_DEVICE'),
          text: result.response.text().trim(),
          model: FIREBASE_ON_DEVICE_MODEL,
          createdAt: Date.now(),
        };
      } catch (error) {
        throw toOnDeviceError(error);
      }
    },

    async analyzeSentimentOnDevice(note: NoteInput): Promise<SentimentResult> {
      if (note.content.trim().length === 0) {
        throw new Error('Write something first — there is no mood to sense yet.');
      }
      try {
        const result = await onDeviceModel.generateContent(
          `Analyze the mood of this private diary entry. Reply with JSON only, no other text: {"score": <integer from -100 (very low) to 100 (bright)>, "label": "<one of: Very low, Low, Mixed, Positive, Bright>", "keywords": ["<up to 5 feeling or theme words from the entry>"]}.\n\nTitle: ${note.title}\n\n${note.content}`,
        );
        const parsed = parseSentimentJson(result.response.text());
        if (!parsed) {
          throw new Error(
            'The on-device model returned an unreadable mood analysis. Please try again.',
          );
        }
        return {
          source: mapInferenceSource(result.response.inferenceSource, 'ON_DEVICE'),
          ...parsed,
          model: FIREBASE_ON_DEVICE_MODEL,
          createdAt: Date.now(),
        };
      } catch (error) {
        if (error instanceof OnDeviceUnavailableError) throw error;
        if (
          error instanceof Error &&
          /unreadable mood analysis/.test(error.message)
        ) {
          throw error;
        }
        throw toOnDeviceError(error);
      }
    },

    async describePhotoOnDevice(
      photo: PhotoInput,
    ): Promise<PhotoDescriptionResult> {
      const base64 = photo.dataUrl.split(',')[1] ?? '';
      if (!base64) {
        throw new Error('This photo could not be read. Try attaching it again.');
      }
      try {
        const result = await onDeviceModel.generateContent([
          'Describe this personal photo in one warm sentence, then list up to 3 mood tags as a comma-separated list on a second line starting with "Tags:". Do not identify any person.',
          {
            type: 'inlineData',
            inlineData: { mimeType: photo.mimeType, data: base64 },
          },
        ]);
        const text = result.response.text().trim();
        const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
        const tagLine = lines.find((line) => /^tags:/i.test(line));
        const moodTags = tagLine
          ? tagLine
              .replace(/^tags:/i, '')
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
              .slice(0, 3)
          : [];
        const description =
          lines.filter((line) => !/^tags:/i.test(line)).join(' ') || text;
        return {
          source: mapInferenceSource(result.response.inferenceSource, 'ON_DEVICE'),
          description,
          moodTags,
          model: FIREBASE_ON_DEVICE_MODEL,
          createdAt: Date.now(),
        };
      } catch (error) {
        throw toOnDeviceError(error);
      }
    },

    async deepSummaryInCloud(
      note: NoteInput,
      opts: CloudOptions,
    ): Promise<CloudResult> {
      if (!opts.authorized) throw new CloudNotAuthorizedError();
      const result = await cloudModel.generateContent(
        `You are a thoughtful journaling companion. Read this diary entry and write a short reflective deep summary (2–3 short paragraphs): what thread runs through it, what matters most in it, and one gentle observation about the writer's week. Never claim medical or psychological diagnosis — this is self-reflection support only.\n\nTitle: ${note.title}\n\n${note.content}`,
      );
      return {
        source: 'IN_CLOUD',
        text: result.response.text().trim(),
        model: FIREBASE_CLOUD_MODEL,
        createdAt: Date.now(),
        authorizedAt: opts.authorizedAt ?? Date.now(),
        charsSent: note.content.length,
      };
    },

    async writingSuggestionsInCloud(
      note: NoteInput,
      opts: CloudOptions,
    ): Promise<CloudResult> {
      if (!opts.authorized) throw new CloudNotAuthorizedError();
      const result = await cloudModel.generateContent(
        `You are a thoughtful journaling companion. Based on this diary entry, suggest exactly 3 short writing prompts to help the writer continue their journal — each one sentence, warm and specific to what they wrote. Number them 1–3. Never claim medical or psychological diagnosis.\n\nTitle: ${note.title}\n\n${note.content}`,
      );
      return {
        source: 'IN_CLOUD',
        text: result.response.text().trim(),
        model: FIREBASE_CLOUD_MODEL,
        createdAt: Date.now(),
        authorizedAt: opts.authorizedAt ?? Date.now(),
        charsSent: note.content.length,
      };
    },
  };
}
