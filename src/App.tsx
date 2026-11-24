/**
 * MindVault — privacy-first smart notes.
 *
 * Layout: header (brand + view tabs + on-device status) / notes view
 * (list + editor + AI panel) / mood timeline / privacy ledger.
 *
 * Data flow: notes live in IndexedDB (Dexie) and are read with
 * useLiveQuery, so every view updates the moment data changes. Editing
 * writes through a debounced autosave; AI actions go through the provider
 * abstraction and every AI call is written to the Privacy Ledger.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AiPanel, type CloudAction } from './components/AiPanel';
import { CloudConsentModal } from './components/CloudConsentModal';
import { MoodTimeline } from './components/MoodTimeline';
import { NoteEditor } from './components/NoteEditor';
import { NoteList } from './components/NoteList';
import { PrivacyLedger } from './components/PrivacyLedger';
import { useDeviceModel } from './hooks/useDeviceModel';
import { getAIProvider, getProviderInitError } from './lib/ai';
import {
  addPhotoToNote,
  createNote,
  db,
  deleteNoteAndLedger,
  fileToStoredPhoto,
  recordLedgerEntry,
  removePhotoFromNote,
  saveAnalysis,
  savePhotoDescription,
  updateNoteFields,
} from './lib/db';
import type { Note } from './lib/db';
import { ensureSeeded } from './lib/seed';

type View = 'notes' | 'mood' | 'ledger';

const SAVE_DEBOUNCE_MS = 800;

function VaultMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-9 w-9 shrink-0"
      viewBox="0 0 48 48"
      fill="none"
    >
      <rect width="48" height="48" rx="12" fill="#0f766e" />
      <circle cx="24" cy="24" r="12" stroke="#ffffff" strokeWidth="2.5" />
      <circle cx="24" cy="24" r="4" fill="#ffffff" />
      <path
        d="M24 12v6M24 30v6M12 24h6M30 24h6M15.5 15.5l4.2 4.2M28.3 28.3l4.2 4.2M32.5 15.5l-4.2 4.2M19.7 28.3l-4.2 4.2"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function App() {
  const provider = useMemo(() => getAIProvider(), []);
  // Non-null when the Firebase provider was requested but failed to start
  // (the app fell back to the mock provider instead of crashing).
  const providerInitError = getProviderInitError();
  const device = useDeviceModel(provider);

  const [view, setView] = useState<View>('notes');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [draft, setDraft] = useState<{ noteId: number; title: string; content: string } | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState({ summary: false, sentiment: false, cloud: false });
  const [aiError, setAiError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [describingPhotoId, setDescribingPhotoId] = useState<string | null>(null);
  const [pendingCloud, setPendingCloud] = useState<CloudAction | null>(null);
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
    setAiError(null);
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

  const handleNewNote = useCallback(async () => {
    await flushSave();
    const id = await createNote();
    setSelectedId(id);
    setSearch('');
    setView('notes');
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

  const runOnDevice = useCallback(
    async (kind: 'summary' | 'sentiment') => {
      if (!selected?.id || !draft) return;
      await flushSave();
      setAiError(null);
      setBusy((b) => ({ ...b, [kind]: true }));
      try {
        const input = { id: selected.id, title: draft.title, content: draft.content };
        if (kind === 'summary') {
          const result = await provider.summarizeOnDevice(input);
          await saveAnalysis(selected.id, { summary: result });
          await recordLedgerEntry({
            noteId: selected.id,
            noteTitle: draft.title,
            action: 'on-device-summary',
            source: 'ON_DEVICE',
            detail: 'Summary generated on this device — the note never left the browser.',
            authorized: false,
            charsSent: 0,
          });
        } else {
          const result = await provider.analyzeSentimentOnDevice(input);
          await saveAnalysis(selected.id, { sentiment: result });
          await recordLedgerEntry({
            noteId: selected.id,
            noteTitle: draft.title,
            action: 'on-device-sentiment',
            source: 'ON_DEVICE',
            detail: 'Mood analysis ran on this device — the note never left the browser.',
            authorized: false,
            charsSent: 0,
          });
        }
      } catch (err) {
        setAiError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy((b) => ({ ...b, [kind]: false }));
      }
    },
    [selected?.id, draft, flushSave, provider],
  );

  const confirmCloud = useCallback(async () => {
    if (!pendingCloud || !selected?.id || !draft) return;
    const authorizedAt = Date.now();
    setConsentBusy(true);
    setAiError(null);
    setBusy((b) => ({ ...b, cloud: true }));
    try {
      const input = { id: selected.id, title: draft.title, content: draft.content };
      const opts = { authorized: true, authorizedAt };
      if (pendingCloud === 'deep-summary') {
        const result = await provider.deepSummaryInCloud(input, opts);
        await saveAnalysis(selected.id, { deepSummary: result });
        await recordLedgerEntry({
          noteId: selected.id,
          noteTitle: draft.title,
          action: 'cloud-deep-summary',
          source: 'IN_CLOUD',
          detail: `Deep summary generated in the cloud with your explicit approval — ${result.charsSent} characters sent.`,
          authorized: true,
          charsSent: result.charsSent,
        });
      } else {
        const result = await provider.writingSuggestionsInCloud(input, opts);
        await saveAnalysis(selected.id, { suggestions: result });
        await recordLedgerEntry({
          noteId: selected.id,
          noteTitle: draft.title,
          action: 'cloud-suggestions',
          source: 'IN_CLOUD',
          detail: `Writing suggestions generated in the cloud with your explicit approval — ${result.charsSent} characters sent.`,
          authorized: true,
          charsSent: result.charsSent,
        });
      }
      setPendingCloud(null);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setConsentBusy(false);
      setBusy((b) => ({ ...b, cloud: false }));
    }
  }, [pendingCloud, selected?.id, draft, provider]);

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

  const handleDescribePhoto = useCallback(
    async (photoId: string) => {
      if (!selected?.id) return;
      const photo = selected.photos.find((p) => p.id === photoId);
      if (!photo) return;
      setPhotoError(null);
      setDescribingPhotoId(photoId);
      try {
        const result = await provider.describePhotoOnDevice({
          name: photo.name,
          mimeType: photo.mimeType,
          dataUrl: photo.dataUrl,
        });
        await savePhotoDescription(selected.id, photoId, result);
        await recordLedgerEntry({
          noteId: selected.id,
          noteTitle: selected.title,
          action: 'on-device-photo',
          source: 'ON_DEVICE',
          detail: 'Photo described on this device — the image never left the browser.',
          authorized: false,
          charsSent: 0,
        });
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : String(err));
      } finally {
        setDescribingPhotoId(null);
      }
    },
    [selected, provider],
  );

  const handleRemovePhoto = useCallback(
    async (photoId: string) => {
      if (!selected?.id) return;
      await removePhotoFromNote(selected.id, photoId);
    },
    [selected?.id],
  );

  const statusPill = (() => {
    switch (device.availability) {
      case 'available':
        return { text: 'On-device AI ready', className: 'bg-teal-700 text-white' };
      case 'downloading':
        return { text: 'Downloading on-device AI…', className: 'bg-teal-100 text-teal-900' };
      case 'downloadable':
        return { text: 'On-device AI setup needed', className: 'bg-amber-100 text-amber-900' };
      case 'unavailable':
        return { text: 'On-device AI unavailable', className: 'bg-stone-200 text-stone-700' };
      default:
        return { text: 'Checking on-device AI…', className: 'bg-stone-200 text-stone-700' };
    }
  })();

  const tabs: Array<{ id: View; label: string }> = [
    { id: 'notes', label: 'Notes' },
    { id: 'mood', label: 'Mood timeline' },
    { id: 'ledger', label: 'Privacy ledger' },
  ];

  if (!seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-stone-500" role="status">
          Opening your vault…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <VaultMark />
            <div>
              <h1 className="font-serif text-xl leading-none font-bold text-stone-900">
                MindVault
              </h1>
              <p className="mt-0.5 hidden text-xs text-stone-500 sm:block">
                Private notes. Verifiable privacy.
              </p>
            </div>
          </div>

          <nav aria-label="Views" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto sm:flex-1 sm:justify-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                aria-current={view === tab.id ? 'page' : undefined}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  view === tab.id
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setView('notes')}
            title="See on-device AI status"
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusPill.className}`}
          >
            {statusPill.text}
          </button>
        </div>

        {provider.kind === 'mock' && (
          <p className="border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900">
            Demo build — AI results are simulated locally on this device;
            no content ever leaves the browser in this build.
          </p>
        )}

        {providerInitError && (
          <p
            role="alert"
            className="border-t border-red-200 bg-red-50 px-4 py-1.5 text-center text-xs text-red-900"
          >
            Firebase AI could not start ({providerInitError}). Your notes
            still work fully, and AI is running in demo mode.
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        {view === 'notes' && (
          <div className="grid items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_360px]">
            <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-9rem)] [&>*]:h-full">
              <NoteList
                notes={notes}
                selectedId={selected?.id ?? null}
                search={search}
                onSearchChange={setSearch}
                onSelect={(id) => {
                  void flushSave();
                  setSelectedId(id);
                }}
                onNew={() => void handleNewNote()}
              />
            </div>

            {selected && draft ? (
              <NoteEditor
                note={selected}
                draftTitle={draft.title}
                draftContent={draft.content}
                saveState={saveState}
                savedAt={savedAt}
                describingPhotoId={describingPhotoId}
                photoError={photoError}
                onTitleChange={handleTitleChange}
                onContentChange={handleContentChange}
                onDelete={() => void handleDeleteNote()}
                onAddPhoto={(file) => void handleAddPhoto(file)}
                onDescribePhoto={(photoId) => void handleDescribePhoto(photoId)}
                onRemovePhoto={(photoId) => void handleRemovePhoto(photoId)}
              />
            ) : (
              <section className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
                <h2 className="font-serif text-xl font-semibold text-stone-900">
                  Your vault is empty
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-stone-600">
                  Write your first entry — a thought, a day, a worry. It stays
                  on this device unless you choose otherwise.
                </p>
                <button
                  type="button"
                  onClick={() => void handleNewNote()}
                  className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Write your first entry
                </button>
              </section>
            )}

            {selected && (
              <div className="xl:sticky xl:top-4">
                <AiPanel
                  note={selected}
                  providerKind={provider.kind}
                  cloudModelName={provider.cloudModelName}
                  device={device}
                  busy={busy}
                  error={aiError}
                  onSummarize={() => void runOnDevice('summary')}
                  onAnalyzeSentiment={() => void runOnDevice('sentiment')}
                  onCloudAction={setPendingCloud}
                />
              </div>
            )}
          </div>
        )}

        {view === 'mood' && (
          <div className="mx-auto max-w-4xl">
            <MoodTimeline notes={notes} />
          </div>
        )}

        {view === 'ledger' && (
          <div className="mx-auto max-w-4xl">
            <PrivacyLedger onReset={() => setSelectedId(null)} />
          </div>
        )}
      </main>

      <footer className="border-t border-stone-200 px-4 py-4 text-center text-xs text-stone-400">
        MindVault stores every note in this browser’s IndexedDB. Nothing
        leaves this device unless you explicitly approve it. Built for
        #BuildHybridAI 2026 with Firebase AI Logic.
      </footer>

      <CloudConsentModal
        open={pendingCloud !== null}
        actionLabel={
          pendingCloud === 'deep-summary'
            ? 'Deep summary'
            : 'Writing suggestions'
        }
        noteTitle={draft?.title ?? ''}
        noteContent={draft?.content ?? ''}
        cloudModelName={provider.cloudModelName}
        busy={consentBusy}
        onConfirm={() => void confirmCloud()}
        onCancel={() => setPendingCloud(null)}
      />
    </div>
  );
}
