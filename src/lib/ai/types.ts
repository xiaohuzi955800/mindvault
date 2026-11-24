/**
 * AI provider contract for MindVault.
 *
 * Every AI call in the app goes through this interface — nothing calls a
 * model API directly. The interface is implemented twice:
 *  - MockAIProvider (phase 1): deterministic, simulated results that run
 *    entirely in the browser with no Firebase config.
 *  - FirebaseAIProvider (phase 2): real Firebase AI Logic (Gemini Nano
 *    on-device + Gemini cloud models), swapped in by one config change.
 *
 * Privacy contract encoded in this interface:
 *  - On-device methods use ONLY_ON_DEVICE semantics. They must NEVER fall
 *    back to the cloud: if the device model is unavailable they throw
 *    OnDeviceUnavailableError and the UI explains why.
 *  - Cloud methods require an explicit `authorized` flag for EVERY call.
 *    Without it they throw CloudNotAuthorizedError. The UI obtains that
 *    authorization through a consent dialog that shows exactly what will
 *    be sent.
 *  - Every result carries its inference source so the UI can badge it
 *    ON-DEVICE or IN-CLOUD — privacy the user can verify, not just trust.
 */

export type InferenceSource = 'ON_DEVICE' | 'IN_CLOUD';

/** Mirrors the Chrome Prompt API availability states. */
export type DeviceAvailability =
  | 'available'
  | 'downloading'
  | 'downloadable'
  | 'unavailable'
  | 'unknown';

export interface NoteInput {
  id: number;
  title: string;
  content: string;
}

export interface PhotoInput {
  name: string;
  mimeType: string;
  /** data: URL (JPEG/PNG only — the only formats on-device inference accepts). */
  dataUrl: string;
}

export interface SummaryResult {
  source: InferenceSource;
  text: string;
  model: string;
  createdAt: number;
}

export interface SentimentResult {
  source: InferenceSource;
  /** -100 (very low) to +100 (bright). */
  score: number;
  label: string;
  keywords: string[];
  model: string;
  createdAt: number;
}

export interface PhotoDescriptionResult {
  source: InferenceSource;
  description: string;
  moodTags: string[];
  model: string;
  createdAt: number;
}

export interface CloudResult {
  source: 'IN_CLOUD';
  text: string;
  model: string;
  createdAt: number;
  authorizedAt: number;
  /** Characters of user content sent to the cloud for this call. */
  charsSent: number;
}

export interface CloudOptions {
  /** Must be true — set only after the user approves in the consent dialog. */
  authorized: boolean;
  authorizedAt?: number;
}

export interface AIProvider {
  readonly kind: 'mock' | 'firebase';
  readonly onDeviceModelName: string;
  readonly cloudModelName: string;

  getDeviceAvailability(): Promise<DeviceAvailability>;
  /**
   * Downloads/initializes the on-device model. MUST be called from a user
   * gesture (button click). Calls onProgress with 0–100 while downloading.
   */
  initializeDeviceModel(onProgress?: (progress: number) => void): Promise<void>;

  summarizeOnDevice(note: NoteInput): Promise<SummaryResult>;
  analyzeSentimentOnDevice(note: NoteInput): Promise<SentimentResult>;
  describePhotoOnDevice(photo: PhotoInput): Promise<PhotoDescriptionResult>;

  deepSummaryInCloud(note: NoteInput, opts: CloudOptions): Promise<CloudResult>;
  writingSuggestionsInCloud(
    note: NoteInput,
    opts: CloudOptions,
  ): Promise<CloudResult>;
}

/** The on-device model cannot run here (unsupported browser, missing flag, …). */
export class OnDeviceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnDeviceUnavailableError';
  }
}

/** A cloud call was attempted without the user's explicit authorization. */
export class CloudNotAuthorizedError extends Error {
  constructor() {
    super('Cloud processing needs your explicit approval for this note.');
    this.name = 'CloudNotAuthorizedError';
  }
}

/** The Firebase provider was selected but no Firebase config is present. */
export class ProviderNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}
