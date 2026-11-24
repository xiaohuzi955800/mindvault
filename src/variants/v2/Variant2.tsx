/**
 * V2 — "Mood-first dashboard".
 *
 * The landing view is a dashboard: the mood chart + calendar heatmap are
 * the hero, with recent insight cards below. Notes are reached by clicking
 * a day on the calendar or an insight card, and the editor opens as a
 * focused overlay. The hypothesis: a striking first screen (chart +
 * heatmap) scores higher on Design and Potential Impact than a notes list,
 * and it makes the structured-JSON sentiment output impossible to miss.
 *
 * The dashboard itself is shared with V6 (see `../DashboardView.tsx`).
 */
import { useCallback, useState } from 'react';
import { NoteList } from '../../components/NoteList';
import { PrivacyLedger } from '../../components/PrivacyLedger';
import type { Vault } from '../../hooks/useVault';
import { formatDate } from '../../lib/format';
import { AppFooter, AppHeader } from '../chrome';
import { DashboardView } from '../DashboardView';
import { EditorOverlay } from '../EditorOverlay';

type View = 'dashboard' | 'entries' | 'ledger';

export default function Variant2({ vault }: { vault: Vault }) {
  const [view, setView] = useState<View>('dashboard');
  const [overlayOpen, setOverlayOpen] = useState(false);

  const openEntry = useCallback(
    async (id: number) => {
      await vault.selectNote(id);
      setOverlayOpen(true);
    },
    [vault],
  );

  const openNewEntry = useCallback(async () => {
    await vault.handleNewNote();
    setOverlayOpen(true);
  }, [vault]);

  const closeOverlay = useCallback(() => {
    setOverlayOpen(false);
  }, []);

  const tabs: Array<{ id: View; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'entries', label: 'Entries' },
    { id: 'ledger', label: 'Privacy ledger' },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        providerKind={vault.provider.kind}
        providerInitError={vault.providerInitError}
        deviceAvailability={vault.device.availability}
        tabs={tabs}
        activeTab={view}
        onTabChange={(id) => setView(id as View)}
        trailing={
          <button
            type="button"
            onClick={() => void openNewEntry()}
            className="rounded-full bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            + New entry
          </button>
        }
        onStatusClick={() => setView('dashboard')}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        {view === 'dashboard' && (
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <DashboardView vault={vault} onOpenEntry={(id) => void openEntry(id)} />

            <section aria-label="All entries">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-900">
                  All entries
                </h3>
                <button
                  type="button"
                  onClick={() => setView('entries')}
                  className="text-xs font-semibold text-teal-800 underline hover:text-teal-900"
                >
                  Browse all →
                </button>
              </div>
              <ul className="mt-3 flex flex-col gap-2" role="list">
                {vault.notes.slice(0, 4).map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => note.id !== undefined && void openEntry(note.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-2.5 text-left shadow-sm hover:border-teal-700/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-stone-900">
                          {note.title.trim() || 'Untitled entry'}
                        </span>
                        <span className="block text-xs text-stone-500">
                          {formatDate(note.createdAt)}
                          {note.analysis.summary && ' · summarized'}
                          {note.analysis.deepSummary && ' · deep summary'}
                        </span>
                      </span>
                      <span aria-hidden="true" className="shrink-0 text-stone-400">
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {view === 'entries' && (
          <div className="mx-auto max-w-3xl">
            <NoteList
              notes={vault.notes}
              selectedId={vault.selected?.id ?? null}
              search={vault.search}
              onSearchChange={vault.setSearch}
              onSelect={(id) => void openEntry(id)}
              onNew={() => void openNewEntry()}
            />
          </div>
        )}

        {view === 'ledger' && (
          <div className="mx-auto max-w-4xl">
            <PrivacyLedger onReset={vault.resetSelection} />
          </div>
        )}
      </main>

      <AppFooter />

      {overlayOpen && <EditorOverlay vault={vault} onClose={closeOverlay} />}
    </div>
  );
}
