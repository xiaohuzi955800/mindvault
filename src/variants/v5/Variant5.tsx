/**
 * V5 — "Vault-first" (privacy as the product).
 *
 * The home screen is the vault: on-device status, a privacy score ("100%
 * of sensitive insights stayed on this device"), the ledger as the hero
 * section, and per-entry privacy controls. Notes are one tap behind
 * ("Open vault"). The hypothesis: the competition rewards the idea
 * (Quality of the Idea is 25% of the score) — leading with verifiable
 * privacy makes the idea unmissable, and the privacy score gives judges a
 * memorable number to quote.
 *
 * The vault view itself is shared with V6 (see `../VaultHome.tsx`).
 */
import { useState } from 'react';
import { MoodTimeline } from '../../components/MoodTimeline';
import type { Vault } from '../../hooks/useVault';
import { AppFooter, AppHeader } from '../chrome';
import { NotesWorkspace } from '../NotesWorkspace';
import { VaultHome } from '../VaultHome';

type View = 'vault' | 'notes' | 'mood';

export default function Variant5({ vault }: { vault: Vault }) {
  const [view, setView] = useState<View>('vault');

  const openEntry = async (id: number) => {
    await vault.selectNote(id);
    setView('notes');
  };

  const tabs: Array<{ id: View; label: string }> = [
    { id: 'vault', label: 'Vault' },
    { id: 'notes', label: 'Notes' },
    { id: 'mood', label: 'Mood timeline' },
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
            onClick={() => setView('notes')}
            className="rounded-full bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
          >
            Open vault →
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

        {view === 'mood' && (
          <div className="mx-auto max-w-4xl">
            <MoodTimeline notes={vault.notes} />
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
