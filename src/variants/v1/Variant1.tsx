/**
 * V1 — "Journal-first" (baseline).
 *
 * Layout: three columns — note list | editor | AI panel. Header tabs for
 * Notes / Mood timeline / Privacy ledger. The writing experience comes
 * first; AI is a side panel you consult while writing, and the privacy
 * story lands through badges + ledger as supporting evidence.
 */
import { useState } from 'react';
import { MoodTimeline } from '../../components/MoodTimeline';
import { PrivacyLedger } from '../../components/PrivacyLedger';
import type { Vault } from '../../hooks/useVault';
import { AppFooter, AppHeader } from '../chrome';
import { NotesWorkspace } from '../NotesWorkspace';

type View = 'notes' | 'mood' | 'ledger';

export default function Variant1({ vault }: { vault: Vault }) {
  const [view, setView] = useState<View>('notes');

  const tabs: Array<{ id: View; label: string }> = [
    { id: 'notes', label: 'Notes' },
    { id: 'mood', label: 'Mood timeline' },
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
        onStatusClick={() => setView('notes')}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4">
        {view === 'notes' && <NotesWorkspace vault={vault} />}

        {view === 'mood' && (
          <div className="mx-auto max-w-4xl">
            <MoodTimeline notes={vault.notes} />
          </div>
        )}

        {view === 'ledger' && (
          <div className="mx-auto max-w-4xl">
            <PrivacyLedger onReset={vault.resetSelection} />
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
