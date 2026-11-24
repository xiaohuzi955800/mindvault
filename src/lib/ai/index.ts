/**
 * AI provider factory — the single seam between the app and its AI backend.
 *
 * Default: the mock provider (phase 1 — no Firebase config needed).
 * Set `VITE_AI_PROVIDER=firebase` and provide a Firebase config (see
 * `.env.example`) to switch to real Firebase AI Logic. Swapping providers is
 * one config change; no UI or feature code changes.
 */
import { getFirebaseConfig, isFirebaseConfigured } from '../firebaseConfig';
import { createFirebaseAIProvider } from './firebaseProvider';
import { mockProvider } from './mockProvider';
import type { AIProvider } from './types';

let cached: AIProvider | null = null;

/**
 * Non-null when the Firebase provider was requested but failed to start
 * (e.g. App Check initialization threw). The app falls back to the mock
 * provider and shows this reason in a banner — the app must never crash
 * or go blank because Firebase failed to start.
 */
let initError: string | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const wanted = import.meta.env.VITE_AI_PROVIDER ?? 'mock';
  if (wanted === 'firebase' && isFirebaseConfigured()) {
    const config = getFirebaseConfig();
    if (config) {
      try {
        cached = createFirebaseAIProvider(config);
        return cached;
      } catch (err) {
        initError = err instanceof Error ? err.message : String(err);
        console.warn(
          'Firebase AI provider failed to initialize; using the mock provider instead.',
          err,
        );
      }
    }
  }
  cached = mockProvider;
  return cached;
}

/** Reason the Firebase provider failed to start, or null when it started (or was never requested). */
export function getProviderInitError(): string | null {
  return initError;
}

/** Test hook — forget the cached provider so the next call re-resolves. */
export function resetAIProvider(): void {
  cached = null;
  initError = null;
}

export { mockProvider } from './mockProvider';
export { createFirebaseAIProvider } from './firebaseProvider';
export type {
  AIProvider,
  CloudOptions,
  CloudResult,
  DeviceAvailability,
  InferenceSource,
  NoteInput,
  PhotoDescriptionResult,
  PhotoInput,
  SentimentResult,
  SummaryResult,
} from './types';
export {
  CloudNotAuthorizedError,
  OnDeviceUnavailableError,
  ProviderNotConfiguredError,
} from './types';
