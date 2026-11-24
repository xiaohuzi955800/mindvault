/**
 * V6 — the merged submission version (V5 vault + V2 dashboard + V1 notes).
 *
 * The winner of the 5-variant comparison (see NOTES.md): V5 had the
 * highest total (18/20) and the strongest Idea/Impact; V2 had the best
 * Design and an equal first-30-seconds score. The merge takes both:
 *
 *   - Vault tab (home) = the V5 vault: privacy-score ring ("100% of
 *     sensitive insights stayed on this device"), on-device status,
 *     per-entry privacy controls, and the full Privacy Ledger as the
 *     hero section. The idea lands in the first 5 seconds.
 *   - Notes tab = the V1 three-column workspace (list | editor | AI
 *     panel) — the complete, familiar writing experience.
 *   - Dashboard tab = the V2 dashboard: mood chart + clickable calendar
 *     heatmap + recent insight cards — the visual showpiece and the
 *     reason to come back daily.
 *
 * No separate ledger tab: the ledger lives on the Vault home. All three
 * tabs reuse the shared view pieces (`VaultHome`, `NotesWorkspace`,
 * `DashboardView`) and the shared `useVault` core — this file is only
 * tab navigation. The V3 lesson (generous whitespace, serif reading
 * surface) lives in the shared editor, so no separate V3 element is
 * needed here.
 */
import { useCallback, useState } from 'react';
import type { Vault } from '../../hooks/useVault';
import { AppFooter, AppHeader } from '../chrome';
import { DashboardView } from '../DashboardView';
import { NotesWorkspace } from '../NotesWorkspace';
import { VaultHome } from '../VaultHome';

type View = 'vault' | 'notes' | 'dashboard';

export default function Variant6({ vault }: { vault: Vault }) {
  const [view, setView] = useState<View>('vault');

  const openEntry = useCallback(
    async (id: number) => {
      await vault.selectNote(id);
      setView('notes');
    },
    [vault],
  );

  const openNewEntry = useCallback(async () => {
    await vault.handleNewNote();
    setView('notes');
  }, [vault]);

  const tabs: Array<{ id: View; label: string }> = [
    { id: 'vault', label: 'Vault' },
    { id: 'notes', label: 'Notes' },
    { id: 'dashboard', label: 'Dashboard' },
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
        onStatusClick={() => setView('vault')}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        {view === 'vault' && (
          <VaultHome
            vault={vault}
            onOpenEntry={(id) => void openEntry(id)}
            onOpenNotes={() => setView('notes')}
          />
        )}

        {view === 'notes' && <NotesWorkspace vault={vault} />}

        {view === 'dashboard' && (
          <DashboardView vault={vault} onOpenEntry={(id) => void openEntry(id)} />
        )}
      </main>

      <AppFooter />
    </div>
  );
}
