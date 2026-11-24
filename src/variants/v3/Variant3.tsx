/**
 * V3 — "Focused writer" (single-column, mobile-first).
 *
 * One centered column, full-width editor, generous whitespace, serif body.
 * The note list becomes a slide-over drawer; AI appears as a bottom sheet
 * on demand ("Insights" button) instead of a permanent panel. The
 * hypothesis: judges on laptops and phones both reward a calm,
 * distraction-free writing surface, and the on-demand AI sheet makes the
 * on-device/cloud distinction feel deliberate rather than incidental.
 */
import { useCallback, useState } from 'react';
import { AiPanel } from '../../components/AiPanel';
import { MoodTimeline } from '../../components/MoodTimeline';
import { NoteEditor } from '../../components/NoteEditor';
import { NoteList } from '../../components/NoteList';
import { PrivacyLedger } from '../../components/PrivacyLedger';
import type { Vault } from '../../hooks/useVault';
import { AppFooter, AppHeader } from '../chrome';

type View = 'write' | 'mood' | 'ledger';

const NAV: Array<{ id: View; label: string }> = [
  { id: 'write', label: 'Write' },
  { id: 'mood', label: 'Mood timeline' },
  { id: 'ledger', label: 'Privacy ledger' },
];

export default function Variant3({ vault }: { vault: Vault }) {
  const [view, setView] = useState<View>('write');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const goTo = useCallback((next: View) => {
    setView(next);
    setDrawerOpen(false);
    setSheetOpen(false);
  }, []);

  const openEntry = useCallback(
    async (id: number) => {
      await vault.selectNote(id);
      setDrawerOpen(false);
      setView('write');
    },
    [vault],
  );

  const newEntry = useCallback(async () => {
    await vault.handleNewNote();
    setDrawerOpen(false);
    setView('write');
  }, [vault]);

  const { selected, draft } = vault;

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        providerKind={vault.provider.kind}
        providerInitError={vault.providerInitError}
        deviceAvailability={vault.device.availability}
        leading={
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open notes and navigation"
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
          >
            ☰ Entries
          </button>
        }
        trailing={
          view === 'write' && selected ? (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="rounded-full bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
            >
              Insights
            </button>
          ) : undefined
        }
        onStatusClick={() => {
          setView('write');
          setSheetOpen(true);
        }}
      />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {view === 'write' &&
          (selected && draft ? (
            <NoteEditor
              note={selected}
              draftTitle={draft.title}
              draftContent={draft.content}
              saveState={vault.saveState}
              savedAt={vault.savedAt}
              describingPhotoId={vault.describingPhotoId}
              photoError={vault.photoError}
              onTitleChange={vault.handleTitleChange}
              onContentChange={vault.handleContentChange}
              onDelete={() => void vault.handleDeleteNote()}
              onAddPhoto={(file) => void vault.handleAddPhoto(file)}
              onDescribePhoto={(photoId) => void vault.handleDescribePhoto(photoId)}
              onRemovePhoto={(photoId) => void vault.handleRemovePhoto(photoId)}
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
                onClick={() => void newEntry()}
                className="mt-4 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Write your first entry
              </button>
            </section>
          ))}

        {view === 'mood' && <MoodTimeline notes={vault.notes} />}

        {view === 'ledger' && <PrivacyLedger onReset={vault.resetSelection} />}
      </main>

      <AppFooter />

      {/* Floating Insights button (write view only). */}
      {view === 'write' && selected && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="fixed right-4 bottom-6 z-30 rounded-full bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-teal-800"
        >
          ✦ Insights
        </button>
      )}

      {/* Slide-over drawer: navigation + note list. */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 flex animate-fade-in"
          role="presentation"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-sm flex-col bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Entries and navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <p className="font-serif text-lg font-bold text-stone-900">
                MindVault
              </p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                ✕ Close
              </button>
            </div>
            <nav aria-label="Views" className="flex gap-1 border-b border-stone-200 p-3">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.id)}
                  aria-current={view === item.id ? 'page' : undefined}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    view === item.id
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="min-h-0 flex-1 p-3 [&>*]:h-full">
              <NoteList
                notes={vault.notes}
                selectedId={selected?.id ?? null}
                search={vault.search}
                onSearchChange={vault.setSearch}
                onSelect={(id) => void openEntry(id)}
                onNew={() => void newEntry()}
              />
            </div>
          </div>
          <div className="flex-1 bg-black/30" />
        </div>
      )}

      {/* On-demand AI bottom sheet. */}
      {sheetOpen && selected && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 animate-fade-in"
          role="presentation"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-stone-100 p-4 shadow-xl animate-fade-up slim-scroll sm:rounded-t-3xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="AI insights"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg font-bold text-stone-900">
                  Insights
                </h2>
                <p className="text-xs text-stone-500">
                  {selected.title.trim() || 'Untitled entry'} — on-device
                  first, cloud only with your approval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close insights"
                className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-100"
              >
                ✕ Close
              </button>
            </div>
            <AiPanel
              note={selected}
              providerKind={vault.provider.kind}
              cloudModelName={vault.provider.cloudModelName}
              device={vault.device}
              busy={vault.busy}
              deviceError={vault.deviceError}
              cloudError={vault.cloudError}
              onSummarize={() => void vault.runOnDevice('summary')}
              onAnalyzeSentiment={() => void vault.runOnDevice('sentiment')}
              onCloudAction={vault.requestCloud}
            />
          </div>
        </div>
      )}
    </div>
  );
}
