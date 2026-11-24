/**
 * Mock AI provider (phase 1).
 *
 * Deterministic, rule-based simulations of the on-device and cloud models so
 * the whole product — UI, variants, tests, demo video rehearsal — works with
 * no Firebase config and no network. Every result is clearly labelled
 * "(simulated)" in its model name, and the app shows a "Demo mode" banner
 * while this provider is active.
 *
 * The mock deliberately mirrors the real provider's behaviour:
 *  - on-device calls fail with OnDeviceUnavailableError when the simulated
 *    model is unavailable (toggle in the on-device panel);
 *  - initializeDeviceModel simulates a download with progress callbacks;
 *  - cloud calls throw CloudNotAuthorizedError without authorization.
 */
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

export const MOCK_ON_DEVICE_MODEL = 'Gemini Nano (simulated)';
export const MOCK_CLOUD_MODEL = 'Gemini 3.8 Flash (simulated)';

const SIMULATE_UNAVAILABLE_KEY = 'mindvault.simulateUnavailable';
const DOWNLOAD_STEPS = [8, 19, 34, 47, 61, 74, 86, 95, 100];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Deterministic hash so the same note always yields the same mock result. */
function hashString(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function readSimulateUnavailable(): boolean {
  try {
    return (
      typeof localStorage !== 'undefined' &&
      localStorage.getItem(SIMULATE_UNAVAILABLE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function setSimulateUnavailable(value: boolean): void {
  try {
    localStorage.setItem(SIMULATE_UNAVAILABLE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable — simulation toggle simply won't persist.
  }
}

export function getSimulateUnavailable(): boolean {
  return readSimulateUnavailable();
}

// ---------------------------------------------------------------------------
// Sentiment lexicon (small, transparent, deterministic)
// ---------------------------------------------------------------------------

const POSITIVE_WORDS = [
  'happy', 'joy', 'joyful', 'grateful', 'thankful', 'excited', 'calm',
  'peaceful', 'proud', 'love', 'loved', 'wonderful', 'great', 'amazing',
  'beautiful', 'relieved', 'hopeful', 'content', 'glad', 'delighted',
  'energized', 'confident', 'warm', 'light', 'free', 'safe', 'comforted',
  'inspired', 'accomplished', 'better', 'good', 'lovely', 'sweet', 'fun',
  'laugh', 'smile', 'win', 'success', 'progress', 'brave', 'strong',
];

const NEGATIVE_WORDS = [
  'sad', 'anxious', 'anxiety', 'angry', 'tired', 'exhausted', 'stressed',
  'lonely', 'frustrated', 'worried', 'afraid', 'scared', 'upset', 'hurt',
  'pain', 'painful', 'difficult', 'hard', 'heavy', 'dark', 'lost',
  'overwhelmed', 'drained', 'empty', 'numb', 'guilty', 'ashamed', 'regret',
  'miss', 'missing', 'cry', 'crying', 'tears', 'fear', 'dread', 'panic',
  'stuck', 'hopeless', 'helpless', 'bad', 'awful', 'terrible', 'rough',
];

function sentimentLabel(score: number): string {
  if (score >= 60) return 'Bright';
  if (score >= 20) return 'Positive';
  if (score > -20) return 'Mixed';
  if (score > -60) return 'Low';
  return 'Very low';
}

function analyzeTextSentiment(content: string): {
  score: number;
  label: string;
  keywords: string[];
} {
  const words = content.toLowerCase().match(/[a-z']+/g) ?? [];
  const counts = new Map<string, number>();
  let positive = 0;
  let negative = 0;
  const positiveSet = new Set(POSITIVE_WORDS);
  const negativeSet = new Set(NEGATIVE_WORDS);
  for (const word of words) {
    if (positiveSet.has(word)) {
      positive++;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    } else if (negativeSet.has(word)) {
      negative++;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  const jitter = (hashString(content) % 11) - 5;
  const score = Math.max(
    -100,
    Math.min(100, (positive - negative) * 14 + jitter),
  );
  const keywords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([word]) => word);
  return { score, label: sentimentLabel(score), keywords };
}

// ---------------------------------------------------------------------------
// Extractive summary: pick the sentences most connected to the title
// ---------------------------------------------------------------------------

function splitSentences(content: string): string[] {
  return content
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function summarizeText(title: string, content: string): string {
  const text = content.trim();
  if (text.length === 0) return '';
  const sentences = splitSentences(text);
  if (sentences.length <= 2) return text.slice(0, 500);

  const titleWords = new Set(
    title
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length > 3),
  );
  const scored = sentences.map((sentence) => {
    const words = sentence.toLowerCase().split(/[^a-z]+/);
    let score = 0;
    for (const word of words) {
      if (titleWords.has(word)) score += 3;
      if (word.length > 6) score += 0.5;
    }
    const wordCount = words.filter(Boolean).length;
    if (wordCount >= 8 && wordCount <= 28) score += 1;
    return { sentence, score };
  });
  const picked = scored
    .map((entry, index) => ({ ...entry, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 2)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.sentence);
  return picked.join(' ');
}

// ---------------------------------------------------------------------------
// Photo description (filename-aware, honestly generic)
// ---------------------------------------------------------------------------

const PHOTO_CUES: Array<{ match: RegExp; description: string; tags: string[] }> = [
  {
    match: /sunset|sunrise|evening|dusk|golden/i,
    description:
      'Warm evening light across the sky — the kind of view that asks you to slow down for a minute.',
    tags: ['calm', 'warmth', 'pause'],
  },
  {
    match: /beach|sea|ocean|shore|wave/i,
    description:
      'Open water and a wide horizon — a moment with room to breathe.',
    tags: ['calm', 'space', 'rest'],
  },
  {
    match: /cat|dog|pet|puppy|kitten/i,
    description:
      'A beloved animal companion, caught mid-moment — small, grounding company.',
    tags: ['comfort', 'companionship', 'warmth'],
  },
  {
    match: /mountain|trail|hike|forest|woods|park/i,
    description:
      'Greenery and open air — time spent outside, away from screens and noise.',
    tags: ['outdoors', 'energy', 'clarity'],
  },
  {
    match: /food|dinner|lunch|coffee|meal|cook/i,
    description:
      'A shared table or a quiet meal — food as a small daily ritual.',
    tags: ['comfort', 'ritual', 'care'],
  },
  {
    match: /friend|family|birthday|party|together/i,
    description:
      'People who matter, together in one frame — connection worth keeping.',
    tags: ['connection', 'joy', 'belonging'],
  },
];

function describePhotoByName(name: string): { description: string; moodTags: string[] } {
  for (const cue of PHOTO_CUES) {
    if (cue.match.test(name)) {
      return { description: cue.description, moodTags: cue.tags };
    }
  }
  return {
    description:
      'A personal photo attached to this entry — a small visual anchor for the day it was taken.',
    moodTags: ['memory', 'moment'],
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let mockAvailability: DeviceAvailability = 'downloadable';

export function resetMockDeviceState(): void {
  mockAvailability = 'downloadable';
}

export const mockProvider: AIProvider = {
  kind: 'mock',
  onDeviceModelName: MOCK_ON_DEVICE_MODEL,
  cloudModelName: MOCK_CLOUD_MODEL,

  async getDeviceAvailability(): Promise<DeviceAvailability> {
    if (readSimulateUnavailable()) return 'unavailable';
    return mockAvailability;
  },

  async initializeDeviceModel(
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    if (readSimulateUnavailable()) {
      throw new OnDeviceUnavailableError(
        'The on-device model is unavailable in this browser (simulated).',
      );
    }
    mockAvailability = 'downloading';
    for (const step of DOWNLOAD_STEPS) {
      await delay(260);
      onProgress?.(step);
    }
    mockAvailability = 'available';
  },

  async summarizeOnDevice(note: NoteInput): Promise<SummaryResult> {
    if (readSimulateUnavailable() || mockAvailability !== 'available') {
      throw new OnDeviceUnavailableError(
        'On-device AI is not ready. Enable it first — your note stays on this device either way.',
      );
    }
    if (note.content.trim().length === 0) {
      throw new Error('Write something first — there is nothing to summarize yet.');
    }
    await delay(500 + (hashString(note.content) % 500));
    return {
      source: 'ON_DEVICE',
      text: summarizeText(note.title, note.content),
      model: MOCK_ON_DEVICE_MODEL,
      createdAt: Date.now(),
    };
  },

  async analyzeSentimentOnDevice(note: NoteInput): Promise<SentimentResult> {
    if (readSimulateUnavailable() || mockAvailability !== 'available') {
      throw new OnDeviceUnavailableError(
        'On-device AI is not ready. Enable it first — your note stays on this device either way.',
      );
    }
    if (note.content.trim().length === 0) {
      throw new Error('Write something first — there is no mood to sense yet.');
    }
    await delay(450 + (hashString(note.content) % 400));
    const { score, label, keywords } = analyzeTextSentiment(note.content);
    return {
      source: 'ON_DEVICE',
      score,
      label,
      keywords,
      model: MOCK_ON_DEVICE_MODEL,
      createdAt: Date.now(),
    };
  },

  async describePhotoOnDevice(photo: PhotoInput): Promise<PhotoDescriptionResult> {
    if (readSimulateUnavailable() || mockAvailability !== 'available') {
      throw new OnDeviceUnavailableError(
        'On-device AI is not ready. Enable it first — your photo stays on this device either way.',
      );
    }
    await delay(600);
    const { description, moodTags } = describePhotoByName(photo.name);
    return {
      source: 'ON_DEVICE',
      description,
      moodTags,
      model: MOCK_ON_DEVICE_MODEL,
      createdAt: Date.now(),
    };
  },

  async deepSummaryInCloud(
    note: NoteInput,
    opts: CloudOptions,
  ): Promise<CloudResult> {
    if (!opts.authorized) throw new CloudNotAuthorizedError();
    await delay(900 + (hashString(note.content) % 500));
    const { label, keywords } = analyzeTextSentiment(note.content);
    const themes =
      keywords.length > 0
        ? keywords.join(', ')
        : 'the small details of an ordinary day';
    const text = [
      `Looking at "${note.title || 'this entry'}" as a whole, the mood comes across as ${label.toLowerCase()}, and the thread running through it is ${themes}.`,
      'What stands out is not a single event but the way the day is remembered: the moments that got written down are the ones that carried feeling. Keeping a short record like this makes the pattern visible over weeks — which days lift you, and which ones weigh on you.',
      'If you keep writing, a monthly review could trace how these threads change. Nothing here is a diagnosis — just a mirror held up to your own words.',
    ].join(' ');
    return {
      source: 'IN_CLOUD',
      text,
      model: MOCK_CLOUD_MODEL,
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
    await delay(800 + (hashString(note.content) % 400));
    const { label, keywords } = analyzeTextSentiment(note.content);
    const focus = keywords[0] ?? 'today';
    const text = [
      `1. Continue the thread: write two more sentences about ${focus} — what happened right before, and what happened right after?`,
      `2. Zoom out: this entry reads as ${label.toLowerCase()}. What would you want to remember about this feeling a month from now?`,
      '3. Small step: end your next entry with one thing you are looking forward to, however small. Future-you will thank you.',
    ].join('\n');
    return {
      source: 'IN_CLOUD',
      text,
      model: MOCK_CLOUD_MODEL,
      createdAt: Date.now(),
      authorizedAt: opts.authorizedAt ?? Date.now(),
      charsSent: note.content.length,
    };
  },
};
