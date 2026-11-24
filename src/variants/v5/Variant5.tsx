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
 */
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MoodTimeline } from '../../components/MoodTimeline';
import { OnDevicePanel } from '../../components/OnDevicePanel';
import { PrivacyLedger } from '../../components/PrivacyLedger';
import { SourceBadge } from '../../components/SourceBadge';
import type { Vault } from '../../hooks/useVault';
import { db } from '../../lib/db';
import { formatDate } from '../../lib/format';
import { AppFooter, AppHeader } from '../chrome';
import { NotesWorkspace } from '../NotesWorkspace';

type View = 'vault' | 'notes' | 'mood';

/** Sensitive actions are the ones that must never leave the device. */
const SENSITIVE_ACTIONS = new Set([
  'on-device-summary',
  'on-device-sentiment',
  'on-device-photo',
]);

/**
 * The privacy score: the share of sensitive AI actions that ran on-device.
 * By architecture this is always 100 — sensitive features use
 * ONLY_ON_DEVICE and can never silently fall back to the cloud — and the
 * score makes that architectural fact visible and quotable. Cloud actions
 * are shown separately, with their approval status.
 */
function PrivacyScore() {
  const entries = useLiveQuery(() => db.ledger.toArray(), []) ?? [];
  // Computed during render (the ledger is tiny) — no memo needed.
  const sensitive = entries.filter((e) => SENSITIVE_ACTIONS.has(e.action));
  const sensitiveOnDevice = sensitive.filter((e) => e.source === 'ON_DEVICE').length;
  const cloud = entries.filter((e) => e.source === 'IN_CLOUD');
  const cloudApproved = cloud.filter((e) => e.authorized).length;
  const silent = cloud.filter((e) => !e.authorized).length;
  const charsSent = entries.reduce((sum, e) => sum + e.charsSent, 0);
  const score =
    sensitive.length === 0
      ? 100
      : Math.round((sensitiveOnDevice / sensitive.length) * 100);
  const stats = {
    score,
    sensitive: sensitive.length,
    cloud: cloud.length,
    cloudApproved,
    silent,
    charsSent,
  };

  const R = 54;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - stats.score / 100);

  return (
    <section
      aria-label="Privacy score"
      className="rounded-xl border border-teal-700/30 bg-teal-50 p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative shrink-0" role="img" aria-label={`Privacy score ${stats.score} out of 100`}>
          <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r={R} fill="none" stroke="#ccfbf1" strokeWidth="12" />
            <circle
              cx="66"
              cy="66"
              r={R}
              fill="none"
              stroke="#0f766e"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-teal-900">{stats.score}</span>
            <span className="text-[11px] font-semibold tracking-wide text-teal-800 uppercase">
              Privacy score
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-bold text-teal-950">
            {stats.score}% of sensitive insights stayed on this device
          </h2>
          <p className="mt-1 text-sm text-teal-900">
            Summaries, mood analysis, and photo descriptions run on-device
            only — they can never silently fall back to the cloud. That is
            not a promise; it is the architecture, and the ledger below is
            the proof.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-teal-800">Sensitive actions</dt>
              <dd className="text-lg font-semibold text-teal-950">{stats.sensitive}</dd>
            </div>
            <div>
              <dt className="text-xs text-teal-800">Cloud actions</dt>
              <dd className="text-lg font-semibold text-teal-950">
                {stats.cloud}
                <span className="ml-1 text-xs font-normal text-teal-800">
                  ({stats.cloudApproved} approved)
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-teal-800">Silent uploads</dt>
              <dd className="text-lg font-semibold text-teal-950">{stats.silent}</dd>
            </div>
            <div>
              <dt className="text-xs text-teal-800">Characters sent</dt>
              <dd className="text-lg font-semibold text-teal-950">{stats.charsSent}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

/** Per-entry privacy controls: what ran where, and a way to remove cloud results. */
function EntryPrivacyControls({
  vault,
  onOpen,
}: {
  vault: Vault;
  onOpen: (id: number) => void;
}) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  return (
    <section aria-label="Per-entry privacy controls" className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-sm font-semibold text-stone-900">
        Per-entry privacy controls
      </h2>
      <p className="mt-0.5 text-xs text-stone-500">
        Every entry shows where its insights ran. You can remove an entry’s
        cloud results at any time — the ledger keeps the record, because an
        audit trail should never be erasable.
      </p>
      <ul className="mt-4 flex flex-col gap-2" role="list">
        {vault.notes.map((note) => {
          const hasCloud = Boolean(note.analysis.deepSummary || note.analysis.suggestions);
          const hasOnDevice = Boolean(
            note.analysis.summary ||
              note.analysis.sentiment ||
              note.photos.some((p) => p.description),
          );
          const confirming = confirmingId === note.id;
          return (
            <li
              key={note.id}
              className="flex flex-col gap-2 rounded-lg border border-stone-200 p-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-stone-900">
                  {note.title.trim() || 'Untitled entry'}
                  <span className="ml-2 font-normal text-stone-500">
                    {formatDate(note.createdAt)}
                  </span>
                </p>
                <p className="mt-1.5 flex flex-wrap gap-1.5">
                  {hasOnDevice && <SourceBadge source="ON_DEVICE" compact />}
                  {hasCloud && <SourceBadge source="IN_CLOUD" compact />}
                  {!hasOnDevice && !hasCloud && (
                    <span className="text-xs text-stone-500">
                      No AI insights yet — nothing has left this device.
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {hasCloud && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!note.id) return;
                      if (!confirming) {
                        setConfirmingId(note.id);
                        setTimeout(() => setConfirmingId(null), 4000);
                        return;
                      }
                      setConfirmingId(null);
                      void vault.clearCloudResults(note.id);
                    }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      confirming
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'border border-stone-300 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {confirming ? 'Click again to remove' : 'Remove cloud results'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => note.id !== undefined && onOpen(note.id)}
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  Open
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            <div>
              <h2 className="font-serif text-2xl font-bold text-stone-900">
                Your vault, verified
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                MindVault’s promise is simple: sensitive insights never leave
                this device. This page proves it — a live score, the full
                ledger, and controls for every entry.
              </p>
            </div>

            <PrivacyScore />

            <OnDevicePanel
              availability={vault.device.availability}
              progress={vault.device.progress}
              initializing={vault.device.initializing}
              error={vault.device.error}
              modelName={vault.provider.kind === 'mock' ? 'Gemini Nano (simulated)' : 'Gemini Nano'}
              isMock={vault.provider.kind === 'mock'}
              simulated={vault.device.simulated}
              onEnable={vault.device.enable}
              onSetSimulated={vault.device.setSimulated}
            />

            <EntryPrivacyControls vault={vault} onOpen={(id) => void openEntry(id)} />

            <PrivacyLedger onReset={vault.resetSelection} />

            <button
              type="button"
              onClick={() => setView('notes')}
              className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Open vault → write and read your entries
            </button>
          </div>
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
