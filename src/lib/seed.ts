/**
 * Demo seed data — realistic sample diary entries so a judge can open the
 * app and immediately click through every feature without writing anything
 * first. Seeded once, only when the notes table is empty. Dates are relative
 * to "today" so the mood timeline always looks alive.
 *
 * All seed content is original writing for this project. The pre-computed
 * analyses are labelled with the simulated model name, matching what the
 * mock provider would produce for the same text.
 */
import {
  MOCK_CLOUD_MODEL,
  MOCK_ON_DEVICE_MODEL,
} from './ai/mockProvider';
import { db, recordLedgerEntry } from './db';
import type { NoteAnalysis, StoredPhoto } from './db';

function daysAgo(days: number, hour: number, minute = 0): number {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

interface SeedEntry {
  title: string;
  content: string;
  createdAt: number;
  analysis: NoteAnalysis;
  withPhoto?: boolean;
}

function seedEntries(): SeedEntry[] {
  return [
    {
      title: 'A quiet Sunday',
      content:
        'Slow morning for once. I made tea and actually sat by the window instead of scrolling through my phone. The street was almost empty, and for the first time in weeks my shoulders did not feel tight.\n\nI finished the novel I have been reading since September. The last chapter made me a little sad, but in a good way — the kind of sad that means something mattered. I wrote down three lines I want to remember.\n\nIn the afternoon I walked to the park without headphones. I think I needed the quiet more than I realized.',
      createdAt: daysAgo(12, 10, 24),
      analysis: {
        summary: {
          source: 'ON_DEVICE',
          text: 'A slow, restorative Sunday: tea by the window, finishing a long-read novel, and a quiet walk in the park without headphones.',
          model: MOCK_ON_DEVICE_MODEL,
          createdAt: daysAgo(12, 10, 40),
        },
        sentiment: {
          source: 'ON_DEVICE',
          score: 62,
          label: 'Bright',
          keywords: ['calm', 'grateful', 'quiet'],
          model: MOCK_ON_DEVICE_MODEL,
          createdAt: daysAgo(12, 10, 40),
        },
      },
    },
    {
      title: 'The talk I keep dreading',
      content:
        'The team presentation is on Thursday and I have been dreading it since Monday. I know the material — I built half of it — but the thought of twenty people watching me talk makes my stomach knot.\n\nI rehearsed in the kitchen tonight and kept losing my place at the same slide. I am worried I will sound unsure even though I am not. Maybe I should ask Mei to listen once tomorrow; she always tells me the truth kindly.\n\nI keep telling myself it is forty minutes of my life. It does not feel that small right now.',
      createdAt: daysAgo(8, 21, 12),
      analysis: {
        summary: {
          source: 'ON_DEVICE',
          text: 'Dreading Thursday’s team presentation despite knowing the material well; rehearsal keeps stalling at the same slide, and asking Mei for a practice run feels like the kindest next step.',
          model: MOCK_ON_DEVICE_MODEL,
          createdAt: daysAgo(8, 21, 30),
        },
        sentiment: {
          source: 'ON_DEVICE',
          score: -48,
          label: 'Low',
          keywords: ['anxious', 'dread', 'worried'],
          model: MOCK_ON_DEVICE_MODEL,
          createdAt: daysAgo(8, 21, 30),
        },
      },
    },
    {
      title: 'Rain on the train home',
      content:
        'It rained all the way home and the train was delayed twice. I watched the city blur past the window and thought about how tired I have been lately — not the good kind of tired, the kind that sleep does not quite fix.\n\nMum called while I was underground and I missed it. I will call her back tomorrow; I have been meaning to for days. She always asks if I am eating properly, and lately the honest answer is: not really.\n\nStill, the rain smelled good when I finally got off. Small things count, I suppose.',
      createdAt: daysAgo(4, 19, 48),
      analysis: {
        summary: {
          source: 'ON_DEVICE',
          text: 'A long, rainy commute home; tired in a way sleep does not fix, a missed call from Mum to return, and the small comfort of rain on the walk from the station.',
          model: MOCK_ON_DEVICE_MODEL,
          createdAt: daysAgo(4, 20, 5),
        },
        sentiment: {
          source: 'ON_DEVICE',
          score: -12,
          label: 'Mixed',
          keywords: ['tired', 'rain', 'hopeful'],
          model: MOCK_ON_DEVICE_MODEL,
          createdAt: daysAgo(4, 20, 5),
        },
      },
    },
    {
      title: 'A small win, finally',
      content:
        'The presentation went well. Really well. I did not lose my place once, and afterwards two people came up to say the demo helped them understand the project for the first time. My manager said "clear and confident", and I almost laughed because she has no idea how nervous I was.\n\nMei listened to my rehearsal on Wednesday and fixed the one slide that kept tripping me. I owe her coffee and probably lunch too.\n\nI took a photo of the sunset on the way home. It felt like the day wanted a bookmark.',
      createdAt: daysAgo(1, 18, 36),
      withPhoto: true,
      analysis: {
        summary: {
          source: 'ON_DEVICE',
          text: 'The dreaded presentation went well — no lost places, two colleagues said the demo finally made the project click, and the manager called it "clear and confident".',
          model: MOCK_ON_DEVICE_MODEL,
          createdAt: daysAgo(1, 18, 52),
        },
        sentiment: {
          source: 'ON_DEVICE',
          score: 74,
          label: 'Bright',
          keywords: ['proud', 'relieved', 'grateful'],
          model: MOCK_ON_DEVICE_MODEL,
          createdAt: daysAgo(1, 18, 52),
        },
        deepSummary: {
          source: 'IN_CLOUD',
          text: 'Looking at "A small win, finally" as a whole, the mood comes across as bright, and the thread running through it is proud, relieved, grateful. What stands out is the arc: the same presentation that caused dread a week ago became a moment of proof — preparation plus one kind rehearsal partner turned anxiety into confidence. If you keep writing, a monthly review could trace how these threads change. Nothing here is a diagnosis — just a mirror held up to your own words.',
          model: MOCK_CLOUD_MODEL,
          createdAt: daysAgo(1, 19, 2),
          authorizedAt: daysAgo(1, 19, 1),
          charsSent: 0, // filled in below from the real content length
        },
        suggestions: {
          source: 'IN_CLOUD',
          text: '1. Continue the thread: write two more sentences about proud — what happened right before, and what happened right after?\n2. Zoom out: this entry reads as bright. What would you want to remember about this feeling a month from now?\n3. Small step: end your next entry with one thing you are looking forward to, however small. Future-you will thank you.',
          model: MOCK_CLOUD_MODEL,
          createdAt: daysAgo(1, 19, 3),
          authorizedAt: daysAgo(1, 19, 1),
          charsSent: 0, // filled in below from the real content length
        },
      },
    },
  ];
}

/** Fetch the bundled seed photo and convert it to a local data: URL. */
async function loadSeedPhoto(): Promise<StoredPhoto | null> {
  try {
    const response = await fetch('/seed-photo.jpg');
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('photo read failed'));
      reader.readAsDataURL(blob);
    });
    return {
      id: 'seed-photo-sunset',
      name: 'sunset-on-the-way-home.jpg',
      mimeType: 'image/jpeg',
      dataUrl,
      description:
        'Warm evening light across the sky — the kind of view that asks you to slow down for a minute.',
      moodTags: ['calm', 'warmth', 'pause'],
      source: 'ON_DEVICE',
      describedAt: daysAgo(1, 18, 55),
    };
  } catch {
    return null;
  }
}

let seedPromise: Promise<void> | null = null;

/** Seeds demo data once; concurrent callers share the same run. */
export function ensureSeeded(): Promise<void> {
  seedPromise ??= seedOnce();
  return seedPromise;
}

async function seedOnce(): Promise<void> {
  const existing = await db.notes.count();
  if (existing > 0) return;

  const entries = seedEntries();
  const seedPhoto = await loadSeedPhoto();

  for (const entry of entries) {
    const photos: StoredPhoto[] =
      entry.withPhoto && seedPhoto ? [seedPhoto] : [];
    const analysis: NoteAnalysis = { ...entry.analysis };
    // Fill in the true character counts for the seeded cloud calls.
    if (analysis.deepSummary) {
      analysis.deepSummary = {
        ...analysis.deepSummary,
        charsSent: entry.content.length,
      };
    }
    if (analysis.suggestions) {
      analysis.suggestions = {
        ...analysis.suggestions,
        charsSent: entry.content.length,
      };
    }
    const noteId = await db.notes.add({
      title: entry.title,
      content: entry.content,
      createdAt: entry.createdAt,
      updatedAt: entry.createdAt,
      photos,
      analysis,
    });
    if (noteId === undefined) continue;

    if (analysis.summary) {
      await recordLedgerEntry({
        noteId,
        noteTitle: entry.title,
        action: 'on-device-summary',
        source: 'ON_DEVICE',
        createdAt: analysis.summary.createdAt,
        detail:
          'Summary generated on this device — the note never left the browser.',
        authorized: false,
        charsSent: 0,
      });
    }
    if (analysis.sentiment) {
      await recordLedgerEntry({
        noteId,
        noteTitle: entry.title,
        action: 'on-device-sentiment',
        source: 'ON_DEVICE',
        createdAt: analysis.sentiment.createdAt,
        detail:
          'Mood analysis ran on this device — the note never left the browser.',
        authorized: false,
        charsSent: 0,
      });
    }
    if (photos.length > 0) {
      await recordLedgerEntry({
        noteId,
        noteTitle: entry.title,
        action: 'on-device-photo',
        source: 'ON_DEVICE',
        createdAt: seedPhoto?.describedAt ?? entry.createdAt,
        detail:
          'Photo described on this device — the image never left the browser.',
        authorized: false,
        charsSent: 0,
      });
    }
    if (analysis.deepSummary) {
      await recordLedgerEntry({
        noteId,
        noteTitle: entry.title,
        action: 'cloud-deep-summary',
        source: 'IN_CLOUD',
        createdAt: analysis.deepSummary.createdAt,
        detail: `Deep summary generated in the cloud with your explicit approval — ${entry.content.length} characters sent.`,
        authorized: true,
        charsSent: entry.content.length,
      });
    }
    if (analysis.suggestions) {
      await recordLedgerEntry({
        noteId,
        noteTitle: entry.title,
        action: 'cloud-suggestions',
        source: 'IN_CLOUD',
        createdAt: analysis.suggestions.createdAt,
        detail: `Writing suggestions generated in the cloud with your explicit approval — ${entry.content.length} characters sent.`,
        authorized: true,
        charsSent: entry.content.length,
      });
    }
  }
}
