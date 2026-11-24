/**
 * Local-first data layer (Dexie / IndexedDB).
 *
 * Every note, photo, analysis result, and ledger entry lives in the
 * browser's IndexedDB. Nothing here ever touches a server — the app works
 * fully offline, and AI is an enhancement, not a dependency.
 */
import Dexie, { type EntityTable } from 'dexie';
import type {
  CloudResult,
  InferenceSource,
  PhotoDescriptionResult,
  SentimentResult,
  SummaryResult,
} from './ai/types';

export interface StoredPhoto {
  id: string;
  name: string;
  mimeType: string;
  /** data: URL — stored locally so photos work offline. */
  dataUrl: string;
  description?: string;
  moodTags?: string[];
  source?: InferenceSource;
  describedAt?: number;
}

export interface NoteAnalysis {
  summary?: SummaryResult;
  sentiment?: SentimentResult;
  deepSummary?: CloudResult;
  suggestions?: CloudResult;
}

export interface Note {
  id?: number;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  photos: StoredPhoto[];
  analysis: NoteAnalysis;
}

export type LedgerAction =
  | 'on-device-summary'
  | 'on-device-sentiment'
  | 'on-device-photo'
  | 'cloud-deep-summary'
  | 'cloud-suggestions';

export interface LedgerEntry {
  id?: number;
  noteId: number;
  noteTitle: string;
  action: LedgerAction;
  source: InferenceSource;
  createdAt: number;
  /** Human-readable, verifiable account of what happened to the content. */
  detail: string;
  /** True only for cloud actions the user explicitly approved. */
  authorized: boolean;
  /** Characters of user content sent off-device (0 for on-device actions). */
  charsSent: number;
}

export const db = new Dexie('mindvault') as Dexie & {
  notes: EntityTable<Note, 'id'>;
  ledger: EntityTable<LedgerEntry, 'id'>;
};

db.version(1).stores({
  notes: '++id, updatedAt, createdAt',
  ledger: '++id, createdAt, noteId, source',
});

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export async function createNote(): Promise<number> {
  const now = Date.now();
  const id = await db.notes.add({
    title: '',
    content: '',
    createdAt: now,
    updatedAt: now,
    photos: [],
    analysis: {},
  });
  if (id === undefined) throw new Error('Could not create the note.');
  return id;
}

export async function updateNoteFields(
  id: number,
  patch: Partial<Pick<Note, 'title' | 'content'>>,
): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteNoteAndLedger(id: number): Promise<void> {
  await db.transaction('rw', db.notes, db.ledger, async () => {
    await db.notes.delete(id);
    await db.ledger.where('noteId').equals(id).delete();
  });
}

export async function saveAnalysis(
  id: number,
  patch: Partial<NoteAnalysis>,
): Promise<void> {
  const note = await db.notes.get(id);
  if (!note) return;
  await db.notes.update(id, {
    analysis: { ...note.analysis, ...patch },
    updatedAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Photos (JPEG/PNG only — the formats on-device inference accepts)
// ---------------------------------------------------------------------------

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function fileToStoredPhoto(file: File): Promise<StoredPhoto> {
  return new Promise((resolve, reject) => {
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      reject(
        new Error('Only JPEG or PNG photos are supported for on-device description.'),
      );
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      reject(new Error('Photos must be smaller than 5 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        mimeType: file.type,
        dataUrl: String(reader.result),
      });
    };
    reader.onerror = () => reject(new Error('Could not read that photo.'));
    reader.readAsDataURL(file);
  });
}

export async function addPhotoToNote(
  noteId: number,
  photo: StoredPhoto,
): Promise<void> {
  const note = await db.notes.get(noteId);
  if (!note) return;
  await db.notes.update(noteId, {
    photos: [...note.photos, photo],
    updatedAt: Date.now(),
  });
}

export async function savePhotoDescription(
  noteId: number,
  photoId: string,
  result: PhotoDescriptionResult,
): Promise<void> {
  const note = await db.notes.get(noteId);
  if (!note) return;
  await db.notes.update(noteId, {
    photos: note.photos.map((photo) =>
      photo.id === photoId
        ? {
            ...photo,
            description: result.description,
            moodTags: result.moodTags,
            source: result.source,
            describedAt: result.createdAt,
          }
        : photo,
    ),
    updatedAt: Date.now(),
  });
}

export async function removePhotoFromNote(
  noteId: number,
  photoId: string,
): Promise<void> {
  const note = await db.notes.get(noteId);
  if (!note) return;
  await db.notes.update(noteId, {
    photos: note.photos.filter((photo) => photo.id !== photoId),
    updatedAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Privacy ledger
// ---------------------------------------------------------------------------

export async function recordLedgerEntry(
  entry: Omit<LedgerEntry, 'id' | 'createdAt'> & { createdAt?: number },
): Promise<void> {
  await db.ledger.add({ ...entry, createdAt: entry.createdAt ?? Date.now() });
}

export async function getLedgerCounts(): Promise<{
  onDevice: number;
  inCloud: number;
  total: number;
}> {
  const [onDevice, inCloud, total] = await Promise.all([
    db.ledger.where('source').equals('ON_DEVICE').count(),
    db.ledger.where('source').equals('IN_CLOUD').count(),
    db.ledger.count(),
  ]);
  return { onDevice, inCloud, total };
}

/** Clears everything (used by "Reset demo data"). */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.notes, db.ledger, async () => {
    await db.notes.clear();
    await db.ledger.clear();
  });
}
