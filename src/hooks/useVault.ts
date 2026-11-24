/**
 * useVault — the shared stateful core of every MindVault variant.
 *
 * All five variants (V1 journal-first, V2 mood-first, V3 focused writer,
 * V4 timeline feed, V5 vault-first) run on this one hook: notes from
 * IndexedDB, the autosave draft, the device model, every AI action, the
 * consent flow, photos, and the Privacy Ledger. Variants differ only in
 * layout and navigation — never in data, AI behavior, or the privacy
 * contract.
 *
 * Two flavours of AI action exist:
 *  - the "selected note" flavour (runOnDevice / requestCloud) works on the
 *    note the user is editing (via the autosave draft) — used by V1/V2/V3/V5;
 *  - the "any note" flavour (runOnDeviceForNote / requestCloudForNote /
 *    describePhotoForNote) works on a note passed in explicitly — used by
 *    V4's inline feed cards, where the user acts on a card without opening
 *    an editor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { CloudAction } from '../components/AiPanel';
import { useDeviceModel } from './useDeviceModel';
import { getAIProvider, getProviderInitError } from '../lib/ai';
import {
  addPhotoToNote,
  clearCloudResults as clearCloudResultsInDb,
  createNote,
  db,
  deleteNoteAndLedger,
  fileToStoredPhoto,
  recordLedgerEntry,
  removePhotoFromNote,
  saveAnalysis,
  savePhotoDescription,
  updateNoteFields,
} from '../lib/db';
import type { Note, StoredPhoto } from '../lib/db';
import { ensureSeeded } from '../lib/seed';

const SAVE_DEBOUNCE_MS = 800;

export type { CloudAction };

export function useVault() {
  const provider = useMemo(() => getAIProvider(), []);
  // Non-null when the Firebase provider was requested but failed to start
  // (the app fell back to the mock provider instead of crashing).
  const providerInitError = getProviderInitError();
  const device = useDeviceModel(provider);

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [draft, setDraft] = useState<{ noteId: number; title: string; content: string } | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState({ summary: false, sentiment: false, cloud: false });
  /**
   * Errors are tracked separately by source so the UI can show each one in
   its own card: on-device failures under the on-device panel, cloud
   failures inside the Cloud insights card. A single shared error used to
   render every failure under the on-device panel, so a cloud 500/429
   looked like an on-device problem.
   */
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [describingPhotoId, setDescribingPhotoId] = useState<string | null>(null);
  const [pendingCloud, setPendingCloud] = useState<CloudAction | null>(null);
  /** When set, the consent modal targets this note instead of the selected one (V4 feed cards). */
  const [pendingCloudNote, setPendingCloudNote] = useState<Note | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notes: Note[] =
    useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), []) ??
    [];

  const selected: Note | null =
    notes.find((note) => note.id === selectedId) ?? notes[0] ?? null;

  // Seed demo data once, then reveal the UI.
  useEffect(() => {
    let cancelled = false;
    void ensureSeeded().then(() => {
      if (!cancelled) setSeeded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the editor draft in sync with the selection.
  useEffect(() => {
    if (!selected || selected.id === undefined) {
      setDraft(null);
      return;
    }
    const id = selected.id;
    setDraft((current) =>
      current && current.noteId === id
        ? current
        : { noteId: id, title: selected.title, content: selected.content },
    );
    setDeviceError(null);
    setCloudError(null);
    setPhotoError(null);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const flushSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (!draft) return;
    setSaveState('saving');
    await updateNoteFields(draft.noteId, {
      title: draft.title,
      content: draft.content,
    });
    setSaveState('saved');
    setSavedAt(Date.now());
  }, [draft]);

  const scheduleSave = useCallback((next: { noteId: number; title: string; content: string }) => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        await updateNoteFields(next.noteId, {
          title: next.title,
          content: next.content,
        });
        setSaveState('saved');
        setSavedAt(Date.now());
      })();
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const handleTitleChange = useCallback(
    (title: string) => {
      setDraft((current) => {
        if (!current) return current;
        const next = { ...current, title };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const handleContentChange = useCallback(
    (content: string) => {
      setDraft((current) => {
        if (!current) return current;
        const next = { ...current, content };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  // Ctrl/Cmd+S saves immediately.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        void flushSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [flushSave]);

  const selectNote = useCallback(
    async (id: number) => {
      await flushSave();
      setSelectedId(id);
    },
    [flushSave],
  );

  const handleNewNote = useCallback(async (): Promise<number | null> => {
    await flushSave();
    const id = await createNote();
    setSelectedId(id);
    setSearch('');
    return id;
  }, [flushSave]);

  const handleDeleteNote = useCallback(async () => {
    if (!selected?.id) return;
    const id = selected.id;
    // Read the next note straight from IndexedDB: the live `notes` array
    // gets a new identity every render, so callbacks must not depend on it.
    const remaining = (
      await db.notes.orderBy('updatedAt').reverse().toArray()
    ).filter((note) => note.id !== id);
    setSelectedId(remaining[0]?.id ?? null);
    setDraft(null);
    await deleteNoteAndLedger(id);
  }, [selected?.id]);

  /** Shared on-device implementation: run + persist + ledger, for one input. */
  const runOnDeviceImpl = useCallback(
    async (input: { id: number; title: string; content: string }, kind: 'summary' | 'sentiment') => {
      if (kind === 'summary') {
        const result = await provider.summarizeOnDevice(input);
        await saveAnalysis(input.id, { summary: result });
        await recordLedgerEntry({
          noteId: input.id,
          noteTitle: input.title,
          action: 'on-device-summary',
          source: 'ON_DEVICE',
          detail: 'Summary generated on this device — the note never left the browser.',
          authorized: false,
          charsSent: 0,
        });
      } else {
        const result = await provider.analyzeSentimentOnDevice(input);
        await saveAnalysis(input.id, { sentiment: result });
        await recordLedgerEntry({
          noteId: input.id,
          noteTitle: input.title,
          action: 'on-device-sentiment',
          source: 'ON_DEVICE',
          detail: 'Mood analysis ran on this device — the note never left the browser.',
          authorized: false,
          charsSent: 0,
        });
      }
    },
    [provider],
  );

  const runOnDevice = useCallback(
    async (kind: 'summary' | 'sentiment') => {
      if (!selected?.id || !draft) return;
      await flushSave();
      setDeviceError(null);
      setBusy((b) => ({ ...b, [kind]: true }));
      try {
        await runOnDeviceImpl(
          { id: selected.id, title: draft.title, content: draft.content },
          kind,
        );
      } catch (err) {
        setDeviceError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy((b) => ({ ...b, [kind]: false }));
      }
    },
    [selected?.id, draft, flushSave, runOnDeviceImpl],
  );

  /** Run an on-device action on any note (V4 feed cards) — reads fresh content from the DB. */
  const runOnDeviceForNote = useCallback(
    async (note: Note, kind: 'summary' | 'sentiment') => {
      if (!note.id) return;
      await flushSave();
      const fresh = await db.notes.get(note.id);
      if (!fresh) return;
      setDeviceError(null);
      setBusy((b) => ({ ...b, [kind]: true }));
      try {
        await runOnDeviceImpl(
          { id: fresh.id as number, title: fresh.title, content: fresh.content },
          kind,
        );
      } catch (err) {
        setDeviceError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy((b) => ({ ...b, [kind]: false }));
      }
    },
    [flushSave, runOnDeviceImpl],
  );

  /** Open the consent modal for the selected note (editor flows). */
  const requestCloud = useCallback((action: CloudAction) => {
    setPendingCloudNote(null);
    setPendingCloud(action);
  }, []);

  /** Open the consent modal for a specific note (V4 feed cards). */
  const requestCloudForNote = useCallback((note: Note, action: CloudAction) => {
    setPendingCloudNote(note);
    setPendingCloud(action);
  }, []);

  const cancelCloud = useCallback(() => {
    setPendingCloud(null);
    setPendingCloudNote(null);
  }, []);

  /** What the consent modal shows: the targeted note, or the selected draft. */
  const cloudTarget =
    pendingCloudNote !== null
      ? { title: pendingCloudNote.title, content: pendingCloudNote.content }
      : draft !== null
        ? { title: draft.title, content: draft.content }
        : { title: '', content: '' };

  const confirmCloud = useCallback(async () => {
    if (!pendingCloud) return;
    const targetId = pendingCloudNote?.id ?? selected?.id;
    const target = pendingCloudNote ?? draft;
    if (!targetId || !target) return;
    const authorizedAt = Date.now();
    setConsentBusy(true);
    setCloudError(null);
    setBusy((b) => ({ ...b, cloud: true }));
    try {
      const input = { id: targetId, title: target.title, content: target.content };
      const opts = { authorized: true, authorizedAt };
      if (pendingCloud === 'deep-summary') {
        const result = await provider.deepSummaryInCloud(input, opts);
        await saveAnalysis(targetId, { deepSummary: result });
        await recordLedgerEntry({
          noteId: targetId,
          noteTitle: target.title,
          action: 'cloud-deep-summary',
          source: 'IN_CLOUD',
          detail: `Deep summary generated in the cloud with your explicit approval — ${result.charsSent} characters sent.`,
          authorized: true,
          charsSent: result.charsSent,
        });
      } else {
        const result = await provider.writingSuggestionsInCloud(input, opts);
        await saveAnalysis(targetId, { suggestions: result });
        await recordLedgerEntry({
          noteId: targetId,
          noteTitle: target.title,
          action: 'cloud-suggestions',
          source: 'IN_CLOUD',
          detail: `Writing suggestions generated in the cloud with your explicit approval — ${result.charsSent} characters sent.`,
          authorized: true,
          charsSent: result.charsSent,
        });
      }
      setPendingCloud(null);
      setPendingCloudNote(null);
    } catch (err) {
      setCloudError(err instanceof Error ? err.message : String(err));
    } finally {
      setConsentBusy(false);
      setBusy((b) => ({ ...b, cloud: false }));
    }
  }, [pendingCloud, pendingCloudNote, selected?.id, draft, provider]);

  const handleAddPhoto = useCallback(
    async (file: File) => {
      if (!selected?.id) return;
      setPhotoError(null);
      try {
        const photo = await fileToStoredPhoto(file);
        await addPhotoToNote(selected.id, photo);
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : String(err));
      }
    },
    [selected?.id],
  );

  /** Shared photo-description implementation: run + persist + ledger. */
  const describePhotoImpl = useCallback(
    async (note: Note, photo: StoredPhoto) => {
      if (!note.id) return;
      const result = await provider.describePhotoOnDevice({
        name: photo.name,
        mimeType: photo.mimeType,
        dataUrl: photo.dataUrl,
      });
      await savePhotoDescription(note.id, photo.id, result);
      await recordLedgerEntry({
        noteId: note.id,
        noteTitle: note.title,
        action: 'on-device-photo',
        source: 'ON_DEVICE',
        detail: 'Photo described on this device — the image never left the browser.',
        authorized: false,
        charsSent: 0,
      });
    },
    [provider],
  );

  const handleDescribePhoto = useCallback(
    async (photoId: string) => {
      if (!selected?.id) return;
      const photo = selected.photos.find((p) => p.id === photoId);
      if (!photo) return;
      setPhotoError(null);
      setDescribingPhotoId(photoId);
      try {
        await describePhotoImpl(selected, photo);
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : String(err));
      } finally {
        setDescribingPhotoId(null);
      }
    },
    [selected, describePhotoImpl],
  );

  /** Describe a photo on any note (V4 feed cards). */
  const describePhotoForNote = useCallback(
    async (note: Note, photoId: string) => {
      if (!note.id) return;
      const photo = note.photos.find((p) => p.id === photoId);
      if (!photo) return;
      setPhotoError(null);
      setDescribingPhotoId(photoId);
      try {
        await describePhotoImpl(note, photo);
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : String(err));
      } finally {
        setDescribingPhotoId(null);
      }
    },
    [describePhotoImpl],
  );

  const handleRemovePhoto = useCallback(
    async (photoId: string) => {
      if (!selected?.id) return;
      await removePhotoFromNote(selected.id, photoId);
    },
    [selected?.id],
  );

  /**
   * Per-entry privacy control (V5): delete a note's cloud results (deep
   * summary + writing suggestions). The ledger keeps its entries — the
   * audit trail is append-only, so deleting results never erases the
   * record that a cloud call happened.
   */
  const clearCloudResults = useCallback(async (noteId: number) => {
    await clearCloudResultsInDb(noteId);
  }, []);

  return {
    provider,
    providerInitError,
    device,
    seeded,
    notes,
    selected,
    selectedId,
    search,
    setSearch,
    draft,
    saveState,
    savedAt,
    busy,
    deviceError,
    cloudError,
    photoError,
    describingPhotoId,
    pendingCloud,
    cloudTarget,
    consentBusy,
    flushSave,
    selectNote,
    handleNewNote,
    handleDeleteNote,
    handleTitleChange,
    handleContentChange,
    runOnDevice,
    runOnDeviceForNote,
    requestCloud,
    requestCloudForNote,
    cancelCloud,
    confirmCloud,
    handleAddPhoto,
    handleDescribePhoto,
    describePhotoForNote,
    handleRemovePhoto,
    clearCloudResults,
    resetSelection: () => setSelectedId(null),
  };
}

export type Vault = ReturnType<typeof useVault>;
